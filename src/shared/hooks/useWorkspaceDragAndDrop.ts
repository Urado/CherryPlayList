import { useCallback, useMemo, useState } from 'react';

import { WorkspaceId } from '@core/types/workspace';

import { isCrossWorkspaceOperation } from '../../core/constants/workspace';
import { Track } from '../../core/types/track';
import { DropContext } from '../../modules/dragDrop/types';
import { useDragDropStore } from '../stores/dragDropStore';
import { getTrackWorkspaceStore } from '../stores/trackWorkspaceStoreFactory';
import { useUIStore } from '../stores/uiStore';
import { logger } from '../utils/logger';
import { createTrackDrafts } from '../utils/trackFactory';

export interface TrackWorkspaceDragOptions {
  tracks: Track[];
  selectedTrackIds: Set<string>;
  workspaceId: WorkspaceId; // Идентификатор текущего workspace
  isValidAudioFile: (path: string) => boolean;
  onMoveTrack: (from: number, to: number) => void;
  onMoveSelectedTracks: (toIndex: number) => void;
  onAddTracks: (tracks: Omit<Track, 'id'>[]) => void;
  onAddTracksAt: (tracks: Omit<Track, 'id'>[], index: number) => void;
  onTracksAdded?: (paths: string[]) => void;
  loadFolderTracks?: (folderPath: string) => Promise<string[]>;
}

export type PlaylistDragOptions = TrackWorkspaceDragOptions;

export function useTrackWorkspaceDragAndDrop(options: TrackWorkspaceDragOptions) {
  const {
    tracks,
    selectedTrackIds,
    workspaceId,
    isValidAudioFile,
    onMoveTrack,
    onMoveSelectedTracks,
    onAddTracks,
    onAddTracksAt,
    onTracksAdded,
    loadFolderTracks,
  } = options;

  const setDragging = useUIStore((state) => state.setDragging);
  const draggedItems = useUIStore((state) => state.draggedItems);
  const setDraggedItems = useUIStore((state) => state.setDraggedItems);
  const { moveTracksBetweenWorkspaces, copyTracksBetweenWorkspaces } = useDragDropStore();

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [insertPosition, setInsertPosition] = useState<'top' | 'bottom' | null>(null);

  const selectedIdsMemo = useMemo(() => new Set(selectedTrackIds), [selectedTrackIds]);

  const clearIndicators = useCallback(() => {
    setDragOverId(null);
    setInsertPosition(null);
  }, []);

  const clearDragState = useCallback(() => {
    setDraggedItems(null);
    clearIndicators();
    setDragging(false);
  }, [clearIndicators, setDragging, setDraggedItems]);

  const ensureFileDragState = useCallback(() => {
    const current = draggedItems;
    // Не перезаписываем состояние треков при перетаскивании файлов
    if (!current) {
      setDraggedItems({ type: 'files', paths: [] });
    } else if (current.type !== 'files') {
      // Если уже есть перетаскиваемые треки, не перезаписываем их
      // Это позволяет перетаскивать файлы и треки одновременно
      return;
    }
  }, [draggedItems, setDraggedItems]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, trackId: string) => {
      const hasTrack = selectedIdsMemo.has(trackId);
      const ids =
        hasTrack && selectedIdsMemo.size > 1
          ? new Set(selectedIdsMemo)
          : new Set<string>([trackId]);

      // Сохраняем sourceWorkspaceId для поддержки cross-workspace операций
      setDraggedItems({ type: 'tracks', ids, sourceWorkspaceId: workspaceId });
      // Разрешаем и копирование (Ctrl), и перемещение
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', trackId);
      setDragging(true);
    },
    [selectedIdsMemo, setDragging, workspaceId, setDraggedItems],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, context: DropContext) => {
      e.preventDefault();
      e.stopPropagation();

      const types = Array.from(e.dataTransfer.types);
      const isFiles = types.includes('application/json');
      const isTracks = types.includes('text/plain');

      // Определяем target workspace (используем из контекста или текущий workspace)
      const targetWorkspaceId = context.workspaceId || workspaceId;

      // Проверяем, является ли это cross-workspace операцией для треков
      const isCrossWorkspace =
        isTracks && draggedItems?.type === 'tracks' && draggedItems.sourceWorkspaceId
          ? isCrossWorkspaceOperation(draggedItems.sourceWorkspaceId, targetWorkspaceId)
          : false;

      // Валидация workspaceId для cross-workspace операций
      if (isCrossWorkspace && draggedItems?.type === 'tracks' && draggedItems.sourceWorkspaceId) {
        // Проверяем, что оба workspace существуют
        const sourceStore = getTrackWorkspaceStore(draggedItems.sourceWorkspaceId);
        const targetStore = getTrackWorkspaceStore(targetWorkspaceId);
        if (!sourceStore || !targetStore) {
          // Не позволяем drop, если stores не найдены
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }

      if (isFiles) {
        e.dataTransfer.dropEffect = 'copy';
        ensureFileDragState();
      } else if (isTracks && draggedItems?.type === 'tracks') {
        // Сохраняем состояние Ctrl в draggedItems для использования в handleDrop
        // (в событии drop e.ctrlKey может быть недоступен)
        // Сбрасываем isCopyMode если это не cross-workspace операция
        const isCopyMode = isCrossWorkspace && (e.ctrlKey || e.metaKey);
        const currentCopyMode = draggedItems.isCopyMode ?? false;
        if (isCopyMode !== currentCopyMode) {
          setDraggedItems({
            ...draggedItems,
            isCopyMode: isCopyMode || undefined, // undefined вместо false для экономии памяти
          });
        }

        // Если cross-workspace и нажат Ctrl, то копирование, иначе перемещение
        if (isCopyMode) {
          e.dataTransfer.dropEffect = 'copy';
        } else {
          e.dataTransfer.dropEffect = 'move';
        }
      }

      if (context.module === 'playlistItem' && context.targetId) {
        if (draggedItems?.type === 'tracks' && draggedItems.ids.has(context.targetId)) {
          return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        setDragOverId(context.targetId);
        setInsertPosition(y < rect.height / 2 ? 'top' : 'bottom');
      } else {
        clearIndicators();
      }
    },
    [clearIndicators, draggedItems, ensureFileDragState, workspaceId, setDraggedItems],
  );

  const dropTracksOnItem = useCallback(
    (dropTrackId: string) => {
      if (!draggedItems || draggedItems.type !== 'tracks') {
        return;
      }

      const dropIndex = tracks.findIndex((track) => track.id === dropTrackId);
      if (dropIndex === -1) {
        return;
      }

      let finalIndex = dropIndex;
      if (insertPosition === 'bottom') {
        finalIndex = dropIndex + 1;
      }

      if (draggedItems.ids.size > 1) {
        let selectedBeforeInsert = 0;
        for (let i = 0; i < finalIndex && i < tracks.length; i++) {
          if (draggedItems.ids.has(tracks[i].id)) {
            selectedBeforeInsert++;
          }
        }
        finalIndex = Math.max(
          0,
          Math.min(finalIndex - selectedBeforeInsert, tracks.length - draggedItems.ids.size),
        );
        onMoveSelectedTracks(finalIndex);
      } else {
        const draggedId = Array.from(draggedItems.ids)[0];
        const fromIndex = tracks.findIndex((track) => track.id === draggedId);
        if (fromIndex === -1) {
          return;
        }
        if (fromIndex < dropIndex && insertPosition !== 'top') {
          finalIndex -= 1;
        }
        finalIndex = Math.max(0, Math.min(finalIndex, tracks.length - 1));
        if (fromIndex !== finalIndex) {
          onMoveTrack(fromIndex, finalIndex);
        }
      }
    },
    [draggedItems, insertPosition, onMoveSelectedTracks, onMoveTrack, tracks],
  );

  const dropTracksOnContainer = useCallback(() => {
    if (!draggedItems || draggedItems.type !== 'tracks') {
      return;
    }
    if (draggedItems.ids.size > 1) {
      onMoveSelectedTracks(tracks.length);
    } else {
      const draggedId = Array.from(draggedItems.ids)[0];
      const fromIndex = tracks.findIndex((track) => track.id === draggedId);
      if (fromIndex !== -1 && fromIndex !== tracks.length - 1) {
        onMoveTrack(fromIndex, tracks.length - 1);
      }
    }
  }, [draggedItems, onMoveSelectedTracks, onMoveTrack, tracks]);

  const addTracksFromPaths = useCallback(
    (paths: string[], insertIndex?: number) => {
      const filteredPaths = paths.filter((path) => isValidAudioFile(path));
      if (filteredPaths.length === 0) {
        return;
      }

      const drafts = createTrackDrafts(filteredPaths);
      if (typeof insertIndex === 'number') {
        onAddTracksAt(drafts, insertIndex);
      } else {
        onAddTracks(drafts);
      }
      onTracksAdded?.(filteredPaths);
    },
    [isValidAudioFile, onAddTracks, onAddTracksAt, onTracksAdded],
  );

  const addFolders = useCallback(
    async (folders: string[], insertIndex?: number) => {
      if (!loadFolderTracks || folders.length === 0) {
        return;
      }

      const aggregated: string[] = [];
      for (const folder of folders) {
        try {
          const paths = await loadFolderTracks(folder);
          aggregated.push(...paths);
        } catch (error) {
          logger.error(`Failed to read folder ${folder}`, error);
        }
      }

      if (aggregated.length === 0) {
        return;
      }

      addTracksFromPaths(aggregated, insertIndex);
    },
    [addTracksFromPaths, loadFolderTracks],
  );

  const parseFileBrowserData = useCallback((rawData: string | undefined) => {
    if (!rawData) {
      return { files: [] as string[], directories: [] as string[] };
    }
    try {
      const parsed = JSON.parse(rawData);
      if (parsed.type === 'fileBrowser') {
        return {
          files: Array.isArray(parsed.paths) ? parsed.paths : [],
          directories: Array.isArray(parsed.directories) ? parsed.directories : [],
        };
      }
      if (parsed.type === 'files' && Array.isArray(parsed.paths)) {
        return { files: parsed.paths, directories: [] };
      }
    } catch {
      // ignore invalid payload
    }
    return { files: [] as string[], directories: [] as string[] };
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, context: DropContext) => {
      e.preventDefault();
      e.stopPropagation();

      // Проверка на наличие draggedItems
      if (!draggedItems) {
        clearDragState();
        return;
      }

      const types = Array.from(e.dataTransfer.types);
      const isFiles = types.includes('application/json');

      // Определяем target workspace (используем из контекста или текущий workspace)
      const targetWorkspaceId = context.workspaceId || workspaceId;

      // Валидация workspaceId перед операцией
      if (draggedItems.type === 'tracks' && draggedItems.sourceWorkspaceId) {
        const sourceStore = getTrackWorkspaceStore(draggedItems.sourceWorkspaceId);
        const targetStore = getTrackWorkspaceStore(targetWorkspaceId);
        if (!sourceStore || !targetStore) {
          logger.error('handleDrop: stores not found', {
            sourceWorkspaceId: draggedItems.sourceWorkspaceId,
            targetWorkspaceId,
          });
          clearDragState();
          useUIStore.getState().addNotification({
            type: 'error',
            message: 'Cannot perform operation: workspace not found',
            duration: 5000,
          });
          return;
        }
      }

      // Проверяем, является ли это cross-workspace операцией для треков
      const isCrossWorkspace =
        draggedItems?.type === 'tracks' &&
        isCrossWorkspaceOperation(draggedItems.sourceWorkspaceId, targetWorkspaceId);

      // Используем сохраненное состояние isCopyMode из draggedItems
      // (e.ctrlKey может быть недоступен в событии drop, поэтому сохраняем его в handleDragOver)
      const isCopyOperation =
        isCrossWorkspace && draggedItems?.type === 'tracks' && (draggedItems.isCopyMode ?? false);

      if (context.module === 'playlistItem' && context.targetId) {
        if (isFiles) {
          const dropIndex = tracks.findIndex((track) => track.id === context.targetId);
          if (dropIndex === -1) {
            clearDragState();
            return;
          }
          let insertIndex = dropIndex;
          if (insertPosition === 'bottom') {
            insertIndex = dropIndex + 1;
          }
          const { files, directories } = parseFileBrowserData(
            e.dataTransfer.getData('application/json'),
          );
          if (files.length) {
            addTracksFromPaths(files, insertIndex);
          }
          if (directories.length) {
            addFolders(directories, insertIndex);
          }
        } else if (draggedItems?.type === 'tracks') {
          // Обработка cross-workspace операций
          if (isCrossWorkspace && draggedItems.sourceWorkspaceId) {
            const trackIds = Array.from(draggedItems.ids);
            const dropIndex = tracks.findIndex((track) => track.id === context.targetId);
            let insertIndex = dropIndex;
            if (insertPosition === 'bottom') {
              insertIndex = dropIndex + 1;
            }

            let success = false;
            if (isCopyOperation) {
              // Копирование треков в другой workspace
              success = copyTracksBetweenWorkspaces(
                trackIds,
                draggedItems.sourceWorkspaceId,
                targetWorkspaceId,
                insertIndex,
              );
            } else {
              // Перемещение треков в другой workspace
              success = moveTracksBetweenWorkspaces(
                trackIds,
                draggedItems.sourceWorkspaceId,
                targetWorkspaceId,
                insertIndex,
              );
            }

            // Очищаем состояние даже при ошибке
            if (!success) {
              clearDragState();
              return;
            }
          } else {
            // Обычная операция внутри workspace
            dropTracksOnItem(context.targetId);
          }
        }
      } else if (context.module === 'playlistContainer') {
        if (isFiles) {
          const { files, directories } = parseFileBrowserData(
            e.dataTransfer.getData('application/json'),
          );
          if (files.length) {
            addTracksFromPaths(files);
          }
          if (directories.length) {
            addFolders(directories);
          }
        } else if (draggedItems?.type === 'tracks') {
          // Обработка cross-workspace операций
          if (isCrossWorkspace && draggedItems.sourceWorkspaceId) {
            const trackIds = Array.from(draggedItems.ids);
            const targetIndex = tracks.length;

            let success = false;
            if (isCopyOperation) {
              // Копирование треков в другой workspace (в конец)
              success = copyTracksBetweenWorkspaces(
                trackIds,
                draggedItems.sourceWorkspaceId,
                targetWorkspaceId,
                targetIndex,
              );
            } else {
              // Перемещение треков в другой workspace (в конец)
              success = moveTracksBetweenWorkspaces(
                trackIds,
                draggedItems.sourceWorkspaceId,
                targetWorkspaceId,
                targetIndex,
              );
            }

            // Очищаем состояние даже при ошибке
            if (!success) {
              clearDragState();
              return;
            }
          } else {
            // Обычная операция внутри workspace
            dropTracksOnContainer();
          }
        }
      }

      clearDragState();
    },
    [
      addFolders,
      addTracksFromPaths,
      clearDragState,
      copyTracksBetweenWorkspaces,
      dropTracksOnContainer,
      dropTracksOnItem,
      draggedItems,
      insertPosition,
      moveTracksBetweenWorkspaces,
      parseFileBrowserData,
      tracks,
      workspaceId,
    ],
  );

  const handleDragEnd = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      const currentTarget = e.currentTarget as HTMLElement;

      if (
        (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) &&
        (!relatedTarget || !currentTarget.contains(relatedTarget))
      ) {
        clearIndicators();
      }
    },
    [clearIndicators],
  );

  return {
    draggedItems,
    dragOverId,
    insertPosition,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleDragLeave,
  };
}

// Временный алиас для обратной совместимости
export const usePlaylistDragAndDrop = useTrackWorkspaceDragAndDrop;
