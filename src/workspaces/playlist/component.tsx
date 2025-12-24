import React, { useCallback, useEffect, useMemo } from 'react';

import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '../../core/constants/workspace';
import { Track } from '../../core/types/track';
import { WorkspaceId } from '../../modules/dragDrop/types';
import { PlaylistItem } from '../../shared/components/PlaylistItem';
import { useTrackDuration } from '../../shared/hooks/useTrackDuration';
import { useTrackWorkspaceDragAndDrop } from '../../shared/hooks/useWorkspaceDragAndDrop';
import { fileService } from '../../shared/services/fileService';
import { ipcService } from '../../shared/services/ipcService';
import { useDemoPlayerStore } from '../../shared/stores/demoPlayerStore';
import { usePlaylistStore } from '../../shared/stores/playlistStore';
import { useUIStore } from '../../shared/stores/uiStore';
import { logger } from '../../shared/utils/logger';

interface PlaylistViewProps {
  zoneId?: string;
  workspaceId?: WorkspaceId;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ zoneId, workspaceId }) => {
  const effectiveWorkspaceId = workspaceId || DEFAULT_PLAYLIST_WORKSPACE_ID;
  const tracks = usePlaylistStore((state) => state.tracks);
  const selectedTrackIds = usePlaylistStore((state) => state.selectedTrackIds);
  const {
    selectTrack,
    deselectTrack,
    toggleTrackSelection,
    selectAll,
    deselectAll,
    removeTrack,
    moveTrack,
    moveSelectedTracks,
    addTracks,
    addTracksAt,
    updateTrackDuration,
  } = usePlaylistStore();

  const { currentTrack, status, loadTrack, play, pause } = useDemoPlayerStore();

  const isValidAudioFile = useCallback((path: string) => fileService.isValidAudioFile(path), []);

  const loadFolderTracks = useCallback(async (folderPath: string): Promise<string[]> => {
    return await ipcService.findAudioFilesRecursive(folderPath);
  }, []);

  const {
    dragOverId,
    insertPosition,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleDragLeave,
    handleContainerDragOver,
    handleContainerDrop,
  } = useTrackWorkspaceDragAndDrop({
    tracks,
    selectedTrackIds,
    workspaceId: effectiveWorkspaceId,
    isValidAudioFile,
    onMoveTrack: moveTrack,
    onMoveSelectedTracks: moveSelectedTracks,
    onAddTracks: addTracks,
    onAddTracksAt: addTracksAt,
    onTracksAdded: (paths) => {
      logger.info(`Added ${paths.length} tracks to playlist`);
    },
    loadFolderTracks,
  });

  const handlePlay = useCallback(
    async (track: Track) => {
      try {
        await loadTrack(track, effectiveWorkspaceId);
        await play();
      } catch (error) {
        logger.error('Failed to play track', error);
      }
    },
    [loadTrack, play, effectiveWorkspaceId],
  );

  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  const handleToggleSelect = useCallback(
    (id: string, e?: React.MouseEvent) => {
      if (e?.ctrlKey || e?.metaKey) {
        toggleTrackSelection(id);
      } else if (e?.shiftKey) {
        const trackIds = tracks.map((t) => t.id);
        const currentIndex = trackIds.indexOf(id);
        const lastSelectedIndex = Array.from(selectedTrackIds)
          .map((selectedId) => trackIds.indexOf(selectedId))
          .filter((idx) => idx !== -1)
          .sort((a, b) => a - b)[0];

        if (lastSelectedIndex !== undefined && lastSelectedIndex !== -1) {
          const start = Math.min(currentIndex, lastSelectedIndex);
          const end = Math.max(currentIndex, lastSelectedIndex);
          const rangeIds = trackIds.slice(start, end + 1);
          rangeIds.forEach((rangeId) => {
            if (!selectedTrackIds.has(rangeId)) {
              selectTrack(rangeId);
            }
          });
        } else {
          selectTrack(id);
        }
      } else {
        if (selectedTrackIds.has(id)) {
          deselectTrack(id);
        } else {
          deselectAll();
          selectTrack(id);
        }
      }
    },
    [tracks, selectedTrackIds, selectTrack, deselectTrack, toggleTrackSelection, deselectAll],
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeTrack(id);
    },
    [removeTrack],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        selectAll();
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedTrackIds.size > 0) {
          event.preventDefault();
          selectedTrackIds.forEach((id) => removeTrack(id));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectAll, selectedTrackIds, removeTrack]);

  // Load track durations
  useTrackDuration({
    tracks,
    isAudioFile: isValidAudioFile,
    requestDuration: (path: string) => ipcService.getAudioDuration(path),
    resolveTrackByPath: (path: string) => tracks.find((t) => t.path === path),
    onDurationResolved: (trackId: string, duration: number) => {
      updateTrackDuration(trackId, duration);
    },
  });

  const dragging = useUIStore((state) => state.dragging);

  const playlistItems = useMemo(
    () =>
      tracks.map((track, index) => {
        const isSelected = selectedTrackIds.has(track.id);
        const isDragOver = dragOverId === track.id;
        const isActive = currentTrack?.id === track.id;
        const isPlaying = isActive && status === 'playing';

        return (
          <PlaylistItem
            key={track.id}
            track={track}
            index={index}
            isSelected={isSelected}
            isDragging={dragging}
            isDragOver={isDragOver}
            insertPosition={insertPosition}
            onToggleSelect={handleToggleSelect}
            onRemove={handleRemove}
            onDragStart={(e, id) => handleDragStart(e, id)}
            onDragOver={(e) => {
              handleDragOver(e, {
                module: 'playlistItem',
                targetId: track.id,
                workspaceId: effectiveWorkspaceId,
                zoneId,
              });
            }}
            onDrop={(e, id) => {
              handleDrop(e, {
                module: 'playlistItem',
                targetId: id,
                workspaceId: effectiveWorkspaceId,
                zoneId,
              });
            }}
            onDragEnd={handleDragEnd}
            isActive={isActive}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
          />
        );
      }),
    [
      tracks,
      selectedTrackIds,
      dragOverId,
      insertPosition,
      dragging,
      currentTrack,
      status,
      handleToggleSelect,
      handleRemove,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      handlePlay,
      handlePause,
      effectiveWorkspaceId,
      zoneId,
    ],
  );

  return (
    <div className="playlist-view">
      <div
        className="playlist-container"
        onDragOver={handleContainerDragOver}
        onDrop={(e) => {
          handleContainerDrop(e, {
            module: 'playlistContainer',
            workspaceId: effectiveWorkspaceId,
            zoneId,
          });
        }}
        onDragLeave={handleDragLeave}
      >
        {playlistItems.length > 0 ? (
          playlistItems
        ) : (
          <div className="empty-state">
            <p>Плейлист пуст. Перетащите файлы сюда или используйте браузер файлов.</p>
          </div>
        )}
      </div>
    </div>
  );
};
