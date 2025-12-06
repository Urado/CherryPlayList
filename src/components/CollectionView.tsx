import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import TimerIcon from '@mui/icons-material/Timer';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTrackWorkspaceDragAndDrop } from '../hooks/usePlaylistDragAndDrop';
import { useTrackDuration } from '../hooks/useTrackDuration';
import { WorkspaceId } from '../modules/dragDrop/types';
import { exportService } from '../services/exportService';
import { fileService } from '../services/fileService';
import { ipcService } from '../services/ipcService';
import { playlistService } from '../services/playlistService';
import { useDemoPlayerStore } from '../state/demoPlayerStore';
import { ensureTrackWorkspaceStore } from '../state/trackWorkspaceStoreFactory';
import { useUIStore } from '../state/uiStore';
import { Track } from '../types/track';
import { formatDuration } from '../utils/durationUtils';
import { logger } from '../utils/logger';

import { PlaylistItem } from './PlaylistItem';

interface CollectionViewProps {
  workspaceId: WorkspaceId;
  zoneId?: string; // Идентификатор зоны для drag-and-drop
}

export const CollectionView: React.FC<CollectionViewProps> = ({ workspaceId, zoneId }) => {
  // Создаём или получаем store для коллекции
  // Если store уже создан (например, при создании layout), он будет возвращен
  const collectionStore = ensureTrackWorkspaceStore({
    workspaceId,
    initialName: 'New Collection', // Используется только если store создается впервые
    maxTracks: null, // Без ограничений
    historyDepth: 50,
  });
  const collectionStoreRef = useRef(collectionStore);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    collectionStoreRef.current = collectionStore;
  }, [collectionStore]);

  const {
    name,
    tracks,
    selectedTrackIds,
    setName,
    removeTrack,
    addTracks,
    addTracksAt,
    toggleTrackSelection,
    selectAll,
    deselectAll,
    removeSelectedTracks,
    moveTrack,
    moveSelectedTracks,
    undo,
    redo,
    selectRange,
    updateTrackDuration,
  } = collectionStore();

  const resolveTrackByPath = useCallback(
    (path: string) =>
      collectionStoreRef.current.getState().tracks.find((track) => track.path === path),
    [],
  );

  const { loadDurationsForTracks } = useTrackDuration({
    tracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackByPath,
    onDurationResolved: updateTrackDuration,
  });

  const {
    currentTrack: activeTrack,
    status: playerStatus,
    loadTrack: loadDemoTrack,
    play,
    pause,
  } = useDemoPlayerStore();
  const activeTrackId = activeTrack?.id;

  const { addNotification } = useUIStore();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const getSafeFolderName = useCallback(() => {
    const fallback = 'Collection';
    const trimmed = (name || fallback).trim();
    const sanitized = trimmed.replace(/[<>:"/\\|?*]+/g, '_');
    return sanitized.length === 0 ? fallback : sanitized;
  }, [name]);

  const startTrackPlayback = useCallback(
    async (track: Track) => {
      try {
        const isSameTrack = activeTrackId === track.id;
        if (!isSameTrack || playerStatus === 'ended') {
          await loadDemoTrack(track, workspaceId);
        }
        await play();
      } catch (error) {
        logger.error('Failed to start collection track playback', error);
      }
    },
    [activeTrackId, playerStatus, loadDemoTrack, play, workspaceId],
  );

  const pausePlayback = useCallback(() => {
    pause();
  }, [pause]);

  const collectionDrag = useTrackWorkspaceDragAndDrop({
    tracks,
    selectedTrackIds,
    workspaceId,
    isValidAudioFile: fileService.isValidAudioFile.bind(fileService),
    onMoveTrack: moveTrack,
    onMoveSelectedTracks: moveSelectedTracks,
    onAddTracks: addTracks,
    onAddTracksAt: addTracksAt,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: ipcService.findAudioFilesRecursive.bind(ipcService),
  });

  // Обработка горячих клавиш для undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey && e.code === 'KeyY') || (e.ctrlKey && e.code === 'KeyZ' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  const hasSelectedTracks = selectedTrackIds.size > 0;
  const totalDuration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  useEffect(() => {
    if (!exportMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);

  const handleExportAsJSON = useCallback(async () => {
    setExportMenuOpen(false);
    const path = await ipcService.showSaveDialog({
      title: 'Экспортировать коллекцию',
      defaultPath: `${name}.json`,
      filters: [{ name: 'JSON файлы', extensions: ['json'] }],
    });

    if (!path) {
      return;
    }

    const playlistData = {
      name,
      tracks: tracks.map((track) => ({
        path: track.path,
        name: track.name,
        duration: track.duration,
      })),
    };
    await playlistService.savePlaylist(path, playlistData);
    addNotification({ type: 'success', message: 'Коллекция экспортирована в JSON' });
  }, [addNotification, ipcService, name, tracks]);

  const handleCopyTracks = useCallback(async () => {
    setExportMenuOpen(false);
    const targetPath = await ipcService.showFolderDialog({
      title: 'Выберите папку для копирования треков',
    });

    if (!targetPath) {
      return;
    }

    const result = await exportService.copyTracksToFolder(tracks, targetPath, getSafeFolderName());
    if (result.failed.length === 0) {
      addNotification({
        type: 'success',
        message: `Треки скопированы в папку: ${result.folderPath}`,
      });
    } else {
      addNotification({
        type: 'warning',
        message: `Скопировано: ${result.successful.length}. Ошибок: ${result.failed.length}`,
      });
    }
  }, [addNotification, exportService, getSafeFolderName, ipcService, tracks]);

  const toggleExportMenu = useCallback(() => {
    if (tracks.length === 0) {
      addNotification({ type: 'warning', message: 'Коллекция пуста' });
      return;
    }
    setExportMenuOpen((prev) => !prev);
  }, [addNotification, tracks.length]);

  return (
    <div className="playlist-view">
      <div className="playlist-header-section">
        <div className="playlist-header-row">
          <input
            type="text"
            className="playlist-name-input-header"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название коллекции"
          />
          {tracks.length > 0 && (
            <div className="playlist-header-actions">
              {hasSelectedTracks ? (
                <>
                  <button
                    onClick={deselectAll}
                    className="playlist-header-action-icon"
                    title="Deselect All"
                  >
                    <ClearIcon style={{ fontSize: '20px' }} />
                  </button>
                  <button
                    onClick={removeSelectedTracks}
                    className="playlist-header-action-icon delete-button"
                    title={`Delete Selected (${selectedTrackIds.size})`}
                  >
                    <DeleteSweepIcon style={{ fontSize: '20px' }} />
                  </button>
                </>
              ) : (
                <button
                  onClick={selectAll}
                  className="playlist-header-action-icon"
                  title="Select All"
                >
                  <SelectAllIcon style={{ fontSize: '20px' }} />
                </button>
              )}
              <div className="collection-export-wrapper" ref={exportMenuRef}>
                <button
                  onClick={toggleExportMenu}
                  className="playlist-header-action-icon"
                  title="Экспортировать коллекцию"
                >
                  <FileDownloadIcon style={{ fontSize: '20px' }} />
                </button>
                {exportMenuOpen && (
                  <div className="collection-export-menu">
                    <button onClick={handleExportAsJSON}>Экспорт в JSON</button>
                    <button onClick={handleCopyTracks}>Скопировать в папку</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="playlist-stats-header">
          <ListIcon style={{ fontSize: '18px', marginRight: '4px' }} />
          <span>{tracks.length} треков</span>
          {tracks.length > 0 && (
            <>
              <span style={{ margin: '0 8px' }}>•</span>
              <TimerIcon style={{ fontSize: '18px', marginRight: '4px' }} />
              <span>{formatDuration(totalDuration)}</span>
            </>
          )}
        </div>
      </div>

      <div
        className="playlist-tracks"
        onDragOver={(e) =>
          collectionDrag.handleDragOver(e, {
            module: 'playlistContainer',
            workspaceId,
            zoneId,
          })
        }
        onDragLeave={(e) => collectionDrag.handleDragLeave(e)}
        onDragEnd={collectionDrag.handleDragEnd}
        onDrop={(e) =>
          collectionDrag.handleDrop(e, {
            module: 'playlistContainer',
            workspaceId,
            zoneId,
          })
        }
      >
        {tracks.length === 0 ? (
          <div className="empty-state">
            <p>Collection is empty</p>
            <p className="empty-state-hint">Add tracks to get started</p>
          </div>
        ) : (
          <>
            {tracks.map((track, index) => {
              const isDraggedTrack =
                collectionDrag.draggedItems?.type === 'tracks' &&
                collectionDrag.draggedItems.ids.has(track.id);
              const showInsertLine =
                collectionDrag.dragOverId === track.id && collectionDrag.insertPosition !== null;
              const isActive = activeTrackId === track.id;
              const isPlaying = isActive && playerStatus === 'playing';

              return (
                <React.Fragment key={track.id}>
                  {showInsertLine && collectionDrag.insertPosition === 'top' && (
                    <div className="drag-insert-line" />
                  )}
                  <PlaylistItem
                    track={track}
                    index={index}
                    isSelected={selectedTrackIds.has(track.id)}
                    isDragging={isDraggedTrack}
                    isDragOver={collectionDrag.dragOverId === track.id && !isDraggedTrack}
                    insertPosition={
                      collectionDrag.dragOverId === track.id && !isDraggedTrack
                        ? collectionDrag.insertPosition
                        : null
                    }
                    onToggleSelect={(id, event) => {
                      if (event?.ctrlKey || event?.metaKey) {
                        toggleTrackSelection(id);
                      } else if (event?.shiftKey && selectedTrackIds.size > 0) {
                        const lastSelected = Array.from(selectedTrackIds).pop();
                        if (lastSelected) {
                          selectRange(lastSelected, id);
                        } else {
                          toggleTrackSelection(id);
                        }
                      } else {
                        toggleTrackSelection(id);
                      }
                    }}
                    onRemove={removeTrack}
                    onDragStart={(e) => collectionDrag.handleDragStart(e, track.id)}
                    onDragOver={(e) =>
                      collectionDrag.handleDragOver(e, {
                        module: 'playlistItem',
                        targetId: track.id,
                        workspaceId,
                        zoneId,
                      })
                    }
                    onDrop={(e) =>
                      collectionDrag.handleDrop(e, {
                        module: 'playlistItem',
                        targetId: track.id,
                        workspaceId,
                        zoneId,
                      })
                    }
                    onDragEnd={collectionDrag.handleDragEnd}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    onPlay={startTrackPlayback}
                    onPause={pausePlayback}
                  />
                  {showInsertLine && collectionDrag.insertPosition === 'bottom' && (
                    <div className="drag-insert-line" />
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
