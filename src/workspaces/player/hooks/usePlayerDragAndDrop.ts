import { useCallback } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isPlayerGroup, isPlayerTrack, PlayerItem as PlayerItemType } from '@core/types/player';
import { Track } from '@core/types/track';
import { useTrackWorkspaceDragAndDrop } from '@shared/hooks';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';
import { logger } from '@shared/utils';

const DEFAULT_GROUP_INSERT_INDEX = 0;

interface UsePlayerDragAndDropParams {
  allTracks: Track[];
  selectedItemIds: Set<string>;
  displayItems: Array<{ item: PlayerItemType }>;
  items: PlayerItemType[];
  handleAddTracks: (newTracks: Omit<Track, 'id'>[]) => void;
  handleAddTracksAt: (newTracks: Omit<Track, 'id'>[], index: number) => void;
  loadDurationsForTracks: (paths: string[]) => void;
  processFilesToGroup: (files: string[], targetGroupId: string) => Promise<void>;
  processDirectoriesToGroup: (directories: string[], targetGroupId: string) => Promise<void>;
  processFilesToPosition: (files: string[], insertIndex: number) => void;
  processDirectoriesToPosition: (directories: string[], insertIndex: number) => Promise<void>;
  processFilesToGroupAtPosition: (
    files: string[],
    targetGroupId: string,
    insertIndex: number,
  ) => Promise<void>;
  processDirectoriesToGroupAtPosition: (
    directories: string[],
    targetGroupId: string,
    insertIndex: number,
  ) => Promise<void>;
  zoneId: string;
}

export function usePlayerDragAndDrop({
  allTracks,
  selectedItemIds,
  displayItems,
  items,
  handleAddTracks,
  handleAddTracksAt,
  loadDurationsForTracks,
  processFilesToGroup,
  processDirectoriesToGroup,
  processFilesToPosition,
  processDirectoriesToPosition,
  processFilesToGroupAtPosition,
  processDirectoriesToGroupAtPosition,
  zoneId,
}: UsePlayerDragAndDropParams) {
  const { findItemById, getItemPath, removeItem, addItem, moveItem } = usePlayerItemsStore(
    (state) => ({
      findItemById: state.findItemById,
      getItemPath: state.getItemPath,
      removeItem: state.removeItem,
      addItem: state.addItem,
      moveItem: state.moveItem,
    }),
  );

  const playerDrag = useTrackWorkspaceDragAndDrop({
    tracks: allTracks,
    selectedTrackIds: selectedItemIds,
    workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
    isValidAudioFile: () => true, // Упрощено, так как валидация уже в processFiles
    onMoveTrack: () => {
      // Не используется, так как используем handleDropWithGroups
    },
    onMoveSelectedTracks: () => {
      // Не используется, так как используем handleDropWithGroups
    },
    onAddTracks: handleAddTracks,
    onAddTracksAt: handleAddTracksAt,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: async () => [], // Упрощено, так как используем processDirectories
  });

  const handleDropWithGroups = useCallback(
    async (e: React.DragEvent, targetItemId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const types = Array.from(e.dataTransfer.types);
      const isFiles = types.includes('application/json');

      if (isFiles) {
        try {
          const rawData = e.dataTransfer.getData('application/json');
          const parsed = JSON.parse(rawData);

          if (parsed.type === 'fileBrowser') {
            const files: string[] = Array.isArray(parsed.paths) ? parsed.paths : [];
            const directories: string[] = Array.isArray(parsed.directories)
              ? parsed.directories
              : [];

            const targetDisplayItem = displayItems.find((di) => di.item.id === targetItemId);
            if (!targetDisplayItem) {
              playerDrag.handleDragEnd();
              return;
            }

            const targetItem = targetDisplayItem.item;
            const insertPosition = playerDrag.insertPosition;

            if (isPlayerGroup(targetItem)) {
              if (insertPosition === 'bottom') {
                const targetGroupId = targetItem.id;
                await processFilesToGroup(files, targetGroupId);
                await processDirectoriesToGroup(directories, targetGroupId);
              } else {
                const targetItemIndex = items.findIndex(
                  (itemInList) => itemInList.id === targetItem.id,
                );
                if (targetItemIndex !== -1) {
                  processFilesToPosition(files, targetItemIndex);
                  await processDirectoriesToPosition(directories, targetItemIndex);
                }
              }
              playerDrag.handleDragEnd();
              return;
            }

            if (isPlayerTrack(targetItem)) {
              const targetPath = getItemPath(targetItem.id);
              const targetParentGroupId =
                targetPath.length > 1 ? targetPath[targetPath.length - 2] : null;

              if (targetParentGroupId) {
                const targetParentGroup = findItemById(targetParentGroupId);
                if (targetParentGroup && isPlayerGroup(targetParentGroup)) {
                  const targetIndexInGroup = targetParentGroup.items.findIndex(
                    (item) => item.id === targetItem.id,
                  );

                  if (targetIndexInGroup !== -1) {
                    let insertIndex = targetIndexInGroup;
                    if (insertPosition === 'bottom') {
                      insertIndex = targetIndexInGroup + 1;
                    }

                    await processFilesToGroupAtPosition(files, targetParentGroupId, insertIndex);
                    await processDirectoriesToGroupAtPosition(
                      directories,
                      targetParentGroupId,
                      insertIndex,
                    );
                  }
                }
              } else {
                const targetItemIndex = items.findIndex(
                  (itemInList) => itemInList.id === targetItem.id,
                );
                if (targetItemIndex !== -1) {
                  let finalIndex = targetItemIndex;
                  if (insertPosition === 'bottom') {
                    finalIndex = targetItemIndex + 1;
                  }

                  processFilesToPosition(files, finalIndex);
                  await processDirectoriesToPosition(directories, finalIndex);
                }
              }
              playerDrag.handleDragEnd();
              return;
            }
          }
        } catch (error) {
          logger.error('Failed to parse file browser data', error);
        }
        playerDrag.handleDragEnd();
        return;
      }

      if (!playerDrag.draggedItems || playerDrag.draggedItems.type !== 'tracks') {
        playerDrag.handleDragEnd();
        return;
      }

      const draggedIds = Array.from(playerDrag.draggedItems.ids);
      if (draggedIds.length === 0) {
        playerDrag.handleDragEnd();
        return;
      }

      const targetDisplayItem = displayItems.find((di) => di.item.id === targetItemId);
      if (!targetDisplayItem) {
        return;
      }

      const targetItem = targetDisplayItem.item;
      const insertPosition = playerDrag.insertPosition;

      const draggedItems: PlayerItemType[] = [];
      draggedIds.forEach((id) => {
        const item = findItemById(id);
        if (item) {
          const itemPath = getItemPath(id);
          const isNested = itemPath.some((pathId) => pathId !== id && draggedIds.includes(pathId));
          if (!isNested) {
            draggedItems.push(item);
          }
        }
      });

      if (draggedItems.length === 0) {
        return;
      }

      if (isPlayerGroup(targetItem)) {
        if (insertPosition === 'bottom') {
          const targetGroupId = targetItem.id;

          const validItemsToAdd = draggedItems.filter((item) => {
            if (isPlayerGroup(item) && item.id === targetGroupId) {
              return false;
            }

            if (isPlayerGroup(item)) {
              const draggedGroupPath = getItemPath(item.id);
              const targetIsInsideDragged = draggedGroupPath.includes(targetGroupId);
              if (targetIsInsideDragged) {
                return false;
              }
            }

            return true;
          });

          if (validItemsToAdd.length === 0) {
            playerDrag.handleDragEnd();
            return;
          }

          const { addItemToGroup } = usePlayerItemsStore.getState();
          validItemsToAdd.forEach((item) => {
            addItemToGroup(targetGroupId, item.id, DEFAULT_GROUP_INSERT_INDEX);
          });
        } else {
          const targetItemIndex = items.findIndex((itemInList) => itemInList.id === targetItem.id);
          if (targetItemIndex !== -1) {
            const itemsToProcess = [...draggedItems].reverse();
            itemsToProcess.forEach((item, idx) => {
              const itemPath = getItemPath(item.id);
              const itemParentGroupId = itemPath.length > 1 ? itemPath[itemPath.length - 2] : null;

              if (!itemParentGroupId) {
                const currentIndex = items.findIndex((itemInList) => itemInList.id === item.id);
                if (currentIndex !== -1) {
                  let adjustedFinalIndex = targetItemIndex;
                  if (currentIndex < targetItemIndex) {
                    adjustedFinalIndex = targetItemIndex - 1 - idx;
                  } else {
                    adjustedFinalIndex = targetItemIndex + idx;
                  }
                  moveItem(currentIndex, adjustedFinalIndex);
                }
              } else {
                removeItem(item.id);
                addItem(item, targetItemIndex + idx);
              }
            });
          }
        }
        playerDrag.handleDragEnd();
        return;
      }

      if (isPlayerTrack(targetItem)) {
        const targetPath = getItemPath(targetItem.id);
        const targetParentGroupId =
          targetPath.length > 1 ? targetPath[targetPath.length - 2] : null;

        if (targetParentGroupId) {
          const targetParentGroup = findItemById(targetParentGroupId);
          if (targetParentGroup && isPlayerGroup(targetParentGroup)) {
            const targetIndexInGroup = targetParentGroup.items.findIndex(
              (item) => item.id === targetItem.id,
            );

            if (targetIndexInGroup !== -1) {
              let insertIndex = targetIndexInGroup;
              if (insertPosition === 'bottom') {
                insertIndex = targetIndexInGroup + 1;
              }

              const itemsToProcess = [...draggedItems].reverse();
              itemsToProcess.forEach((item, idx) => {
                const itemPath = getItemPath(item.id);
                const itemParentGroupId =
                  itemPath.length > 1 ? itemPath[itemPath.length - 2] : null;

                if (itemParentGroupId === targetParentGroupId) {
                  const currentIndexInGroup = targetParentGroup.items.findIndex(
                    (itemInGroup) => itemInGroup.id === item.id,
                  );
                  if (currentIndexInGroup !== -1) {
                    const { moveItemInGroup } = usePlayerItemsStore.getState();
                    let finalIndex = insertIndex;
                    if (currentIndexInGroup < insertIndex) {
                      finalIndex = insertIndex - 1 - idx;
                    } else {
                      finalIndex = insertIndex + idx;
                    }
                    moveItemInGroup(targetParentGroupId, currentIndexInGroup, finalIndex);
                  }
                } else {
                  let isValid = true;
                  if (isPlayerGroup(item)) {
                    if (item.id === targetParentGroupId) {
                      isValid = false;
                    } else {
                      const targetGroupPath = getItemPath(targetParentGroupId);
                      const targetIsInsideDragged = targetGroupPath.includes(item.id);
                      if (targetIsInsideDragged) {
                        isValid = false;
                      }
                    }
                  }

                  if (isValid) {
                    const { addItemToGroup } = usePlayerItemsStore.getState();
                    addItemToGroup(targetParentGroupId, item.id, insertIndex + idx);
                  }
                }
              });
              playerDrag.handleDragEnd();
              return;
            }
          }
        } else {
          const targetItemIndex = items.findIndex((itemInList) => itemInList.id === targetItem.id);
          if (targetItemIndex !== -1) {
            let finalIndex = targetItemIndex;
            if (insertPosition === 'bottom') {
              finalIndex = targetItemIndex + 1;
            }

            const itemsToProcess = [...draggedItems].reverse();
            itemsToProcess.forEach((item, idx) => {
              const itemPath = getItemPath(item.id);
              const itemParentGroupId = itemPath.length > 1 ? itemPath[itemPath.length - 2] : null;

              if (!itemParentGroupId) {
                const currentIndex = items.findIndex((itemInList) => itemInList.id === item.id);
                if (currentIndex !== -1) {
                  let adjustedFinalIndex = finalIndex;
                  if (currentIndex < finalIndex) {
                    adjustedFinalIndex = finalIndex - 1 - idx;
                  } else {
                    adjustedFinalIndex = finalIndex + idx;
                  }
                  moveItem(currentIndex, adjustedFinalIndex);
                }
              } else {
                removeItem(item.id);
                addItem(item, finalIndex + idx);
              }
            });
            playerDrag.handleDragEnd();
            return;
          }
        }
      }

      playerDrag.handleDragEnd();
    },
    [
      displayItems,
      findItemById,
      getItemPath,
      removeItem,
      addItem,
      moveItem,
      items,
      playerDrag,
      processFilesToGroup,
      processDirectoriesToGroup,
      processFilesToPosition,
      processDirectoriesToPosition,
      processFilesToGroupAtPosition,
      processDirectoriesToGroupAtPosition,
    ],
  );

  return {
    playerDrag,
    handleDropWithGroups,
  };
}

