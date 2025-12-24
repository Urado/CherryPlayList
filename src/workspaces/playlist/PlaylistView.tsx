import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import TimerIcon from '@mui/icons-material/Timer';
import React, { useCallback, useEffect, useMemo } from 'react';

import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '@core/constants/workspace';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { PlaylistItem } from '@shared/components';
import { useTrackWorkspaceDragAndDrop, useTrackDuration } from '@shared/hooks';
import { fileService, ipcService } from '@shared/services';
import { useDemoPlayerStore, usePlaylistStore, useSettingsStore } from '@shared/stores';
import { formatDuration, logger } from '@shared/utils';

interface PlaylistViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  workspaceId: _workspaceId,
  zoneId,
}) => {
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
  } = usePlaylistStore();

  const resolveTrackByPath = useCallback(
    (path: string) => usePlaylistStore.getState().tracks.find((track) => track.path === path),
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

  const startTrackPlayback = useCallback(
    async (track: Track) => {
      try {
        const isSameTrack = activeTrackId === track.id;
        if (!isSameTrack || playerStatus === 'ended') {
          await loadDemoTrack(track, DEFAULT_PLAYLIST_WORKSPACE_ID);
        }
        await play();
      } catch (error) {
        logger.error('Failed to start track playback', error);
      }
    },
    [activeTrackId, playerStatus, loadDemoTrack, play],
  );

  const pausePlayback = useCallback(() => {
    pause();
  }, [pause]);

  const playlistDrag = useTrackWorkspaceDragAndDrop({
    tracks,
    selectedTrackIds,
    workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
    isValidAudioFile: fileService.isValidAudioFile.bind(fileService),
    onMoveTrack: moveTrack,
    onMoveSelectedTracks: moveSelectedTracks,
    onAddTracks: addTracks,
    onAddTracksAt: addTracksAt,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: ipcService.findAudioFilesRecursive.bind(ipcService),
  });

  // Обработка горячих клавиш для undo/redo
  // Используем e.code для работы независимо от раскладки клавиатуры
  // e.code возвращает физическую позицию клавиши (KeyZ, KeyY), а не символ
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+Z для undo (работает и в русской, и в английской раскладке)
      // KeyZ - это физическая позиция клавиши Z/Я
      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y или Ctrl+Shift+Z для redo (работает и в русской, и в английской раскладке)
      // KeyY - это физическая позиция клавиши Y/Н
      if ((e.ctrlKey && e.code === 'KeyY') || (e.ctrlKey && e.code === 'KeyZ' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const { hourDividerInterval, showHourDividers } = useSettingsStore();

  // Функция для вычисления позиций отсечек с настраиваемым интервалом
  const calculateDividerMarkers = useMemo(() => {
    const markers: number[] = [];
    let accumulatedDuration = 0;

    tracks.forEach((track, index) => {
      accumulatedDuration += track.duration || 0;
      const intervals = Math.floor(accumulatedDuration / hourDividerInterval);

      // Если перешли через новый интервал, добавляем маркер после этого трека
      if (intervals > markers.length) {
        markers.push(index);
      }
    });

    return markers;
  }, [tracks, hourDividerInterval]);

  // Форматирование метки отсечки в формат "hh:mm"
  const formatDividerLabel = useCallback(
    (index: number): string => {
      const accumulatedDuration = tracks
        .slice(0, index + 1)
        .reduce((sum, track) => sum + (track.duration || 0), 0);

      const hours = Math.floor(accumulatedDuration / 3600);
      const minutes = Math.floor((accumulatedDuration % 3600) / 60);

      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    },
    [tracks],
  );

  const hasSelectedTracks = selectedTrackIds.size > 0;

  // Мемоизация вычисления общей длительности
  const totalDuration = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
    [tracks],
  );

  return (
    <div className="playlist-view">
      <div className="playlist-header-section">
        <div className="playlist-header-row">
          <input
            type="text"
            className="playlist-name-input-header"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название плейлиста"
          />
          {hasSelectedTracks && (
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
          )}
          {!hasSelectedTracks && tracks.length > 0 && (
            <button onClick={selectAll} className="playlist-header-action-icon" title="Select All">
              <SelectAllIcon style={{ fontSize: '20px' }} />
            </button>
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
          playlistDrag.handleDragOver(e, {
            module: 'playlistContainer',
            workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
            zoneId,
          })
        }
        onDragLeave={(e) => playlistDrag.handleDragLeave(e)}
        onDragEnd={playlistDrag.handleDragEnd}
        onDrop={(e) =>
          playlistDrag.handleDrop(e, {
            module: 'playlistContainer',
            workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
            zoneId,
          })
        }
      >
        {tracks.length === 0 ? (
          <div className="empty-state">
            <p>Playlist is empty</p>
            <p className="empty-state-hint">Add tracks to get started</p>
          </div>
        ) : (
          <>
            {tracks.map((track, index) => {
              const isDraggedTrack =
                playlistDrag.draggedItems?.type === 'tracks' &&
                playlistDrag.draggedItems.ids.has(track.id);
              const showInsertLine =
                playlistDrag.dragOverId === track.id && playlistDrag.insertPosition !== null;
              const isActive = activeTrackId === track.id;
              const isPlaying = isActive && playerStatus === 'playing';
              const showDivider = calculateDividerMarkers.includes(index);

              return (
                <React.Fragment key={track.id}>
                  {showInsertLine && playlistDrag.insertPosition === 'top' && (
                    <div className="drag-insert-line" />
                  )}
                  <PlaylistItem
                    track={track}
                    index={index}
                    isSelected={selectedTrackIds.has(track.id)}
                    isDragging={isDraggedTrack}
                    isDragOver={playlistDrag.dragOverId === track.id && !isDraggedTrack}
                    insertPosition={
                      playlistDrag.dragOverId === track.id && !isDraggedTrack
                        ? playlistDrag.insertPosition
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
                    onDragStart={(e) => playlistDrag.handleDragStart(e, track.id)}
                    onDragOver={(e) =>
                      playlistDrag.handleDragOver(e, {
                        module: 'playlistItem',
                        targetId: track.id,
                        workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
                        zoneId,
                      })
                    }
                    onDrop={(e) =>
                      playlistDrag.handleDrop(e, {
                        module: 'playlistItem',
                        targetId: track.id,
                        workspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,
                        zoneId,
                      })
                    }
                    onDragEnd={playlistDrag.handleDragEnd}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    onPlay={startTrackPlayback}
                    onPause={pausePlayback}
                  />
                  {showInsertLine && playlistDrag.insertPosition === 'bottom' && (
                    <div className="drag-insert-line" />
                  )}
                  {/* Отсечка после трека */}
                  {showHourDividers && showDivider && (
                    <div className="playlist-hour-divider">
                      <span className="playlist-hour-divider-label">
                        {formatDividerLabel(index)}
                      </span>
                    </div>
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
