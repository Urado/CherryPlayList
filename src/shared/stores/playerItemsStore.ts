import { v4 as uuidv4 } from 'uuid';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { PlayerGroup, PlayerItem, isPlayerGroup, isPlayerTrack } from '@core/types/player';
import { Track } from '@core/types/track';

import { usePlayerStore } from './playerStore';

/**
 * Store для управления items (треки и группы) в плеере
 * Расширяет функциональность playerStore для работы с группами
 */
interface PlayerItemsState {
  items: PlayerItem[];
  selectedItemIds: Set<string>; // ID треков и групп

  // Методы для работы с items
  setItems: (items: PlayerItem[]) => void;
  addItem: (item: PlayerItem, index?: number) => void;
  removeItem: (id: string) => void;
  moveItem: (fromIndex: number, toIndex: number) => void;
  findItemById: (id: string) => PlayerItem | null;
  findItemIndex: (id: string) => number;
  getAllTracksInOrder: (items?: PlayerItem[]) => Track[];
  getItemPath: (itemId: string) => string[]; // Путь к элементу через группы

  // Методы для работы с группами
  createGroup: (itemIds: string[], name?: string) => string;
  ungroupGroup: (groupId: string) => void;
  removeGroup: (groupId: string) => void;
  setGroupName: (groupId: string, name: string) => void;
  addItemToGroup: (groupId: string, itemId: string, index?: number) => void;
  removeItemFromGroup: (groupId: string, itemId: string) => void;
  moveItemInGroup: (groupId: string, fromIndex: number, toIndex: number) => void;

  // Selection
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleItemSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  removeSelectedItems: () => void;
  moveSelectedItems: (toIndex: number) => void;
  selectRange: (fromId: string, toId: string) => void;
}

// Вспомогательная функция для рекурсивного поиска элемента
function findItemRecursive(items: PlayerItem[], id: string): PlayerItem | null {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    if (isPlayerGroup(item)) {
      const found = findItemRecursive(item.items, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Вспомогательная функция для рекурсивного получения всех треков
function getAllTracksRecursive(items: PlayerItem[]): Track[] {
  const tracks: Track[] = [];
  for (const item of items) {
    if (isPlayerTrack(item)) {
      tracks.push(item);
    } else if (isPlayerGroup(item)) {
      tracks.push(...getAllTracksRecursive(item.items));
    }
  }
  return tracks;
}

// Вспомогательная функция для получения пути к элементу
function getItemPathRecursive(
  items: PlayerItem[],
  itemId: string,
  currentPath: string[] = [],
): string[] | null {
  for (const item of items) {
    const newPath = [...currentPath, item.id];
    if (item.id === itemId) {
      return newPath;
    }
    if (isPlayerGroup(item)) {
      const found = getItemPathRecursive(item.items, itemId, newPath);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Вспомогательная функция для обновления группы в items
function updateGroupInItems(
  items: PlayerItem[],
  groupId: string,
  updater: (group: PlayerGroup) => PlayerGroup,
): PlayerItem[] {
  return items.map((item) => {
    if (isPlayerGroup(item) && item.id === groupId) {
      return updater(item);
    }
    if (isPlayerGroup(item)) {
      return {
        ...item,
        items: updateGroupInItems(item.items, groupId, updater),
      };
    }
    return item;
  });
}

// Вспомогательная функция для удаления элемента из items и очистки пустых групп
function removeItemFromItems(items: PlayerItem[], itemId: string): PlayerItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => {
      if (isPlayerGroup(item)) {
        const updatedItems = removeItemFromItems(item.items, itemId);
        // Если группа стала пустой, возвращаем null для последующей фильтрации
        if (updatedItems.length === 0) {
          return null;
        }
        return {
          ...item,
          items: updatedItems,
        };
      }
      return item;
    })
    .filter((item): item is PlayerItem => item !== null);
}

export const usePlayerItemsStore = createWithEqualityFn<PlayerItemsState>()(
  persist(
    (set, get) => {
      // Инициализация: получаем треки из playerStore и преобразуем в items
      const initializeItems = (): PlayerItem[] => {
        const playerState = usePlayerStore.getState();
        return playerState.tracks.map((track) => track as PlayerItem);
      };

      return {
        items: initializeItems(),

        selectedItemIds: new Set<string>(),

        setItems: (items) => {
          set({ items });
          // Синхронизируем треки с playerStore для обратной совместимости
          const tracks = getAllTracksRecursive(items);
          usePlayerStore.getState()._setTracks(tracks);
        },

        addItem: (item, index) => {
          const state = get();
          const newItems = [...state.items];
          if (index !== undefined) {
            newItems.splice(index, 0, item);
          } else {
            newItems.push(item);
          }
          set({ items: newItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        removeItem: (id) => {
          const state = get();
          const newItems = removeItemFromItems(state.items, id);
          const newSelectedIds = new Set(
            [...state.selectedItemIds].filter((selectedId) => selectedId !== id),
          );
          set({ items: newItems, selectedItemIds: newSelectedIds });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        moveItem: (fromIndex, toIndex) => {
          const state = get();
          if (fromIndex === toIndex) return;

          const newItems = [...state.items];
          const [moved] = newItems.splice(fromIndex, 1);
          newItems.splice(toIndex, 0, moved);
          set({ items: newItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        findItemById: (id) => {
          return findItemRecursive(get().items, id);
        },

        findItemIndex: (id) => {
          return get().items.findIndex((item) => item.id === id);
        },

        getAllTracksInOrder: (items) => {
          const itemsToProcess = items || get().items;
          return getAllTracksRecursive(itemsToProcess);
        },

        getItemPath: (itemId) => {
          const path = getItemPathRecursive(get().items, itemId);
          return path || [];
        },

        createGroup: (itemIds, name) => {
          const state = get();
          if (itemIds.length === 0) {
            throw new Error('No items to group');
          }

          // Получаем пути для всех элементов
          const itemPaths = itemIds.map((id) => ({
            id,
            path: getItemPathRecursive(state.items, id) || [],
          }));

          // Проверяем, что все элементы находятся в одном контейнере (корневой список или одна группа)
          const firstPath = itemPaths[0].path;
          const parentId = firstPath.length > 1 ? firstPath[firstPath.length - 2] : null;

          // Проверяем, что все элементы имеют одного родителя
          for (let i = 1; i < itemPaths.length; i++) {
            const currentPath = itemPaths[i].path;
            const currentParentId = currentPath.length > 1 ? currentPath[currentPath.length - 2] : null;
            if (currentParentId !== parentId) {
              throw new Error('Items must be in the same container to create a group');
            }
          }

          // Находим элементы для группировки
          const itemsToGroup: PlayerItem[] = [];
          const itemIndices: number[] = [];

          // Рекурсивная функция для поиска элементов в контейнере
          const findItemsInContainer = (container: PlayerItem[]): void => {
            itemIds.forEach((id) => {
              const index = container.findIndex((item) => item.id === id);
              if (index !== -1) {
                itemsToGroup.push(container[index]);
                itemIndices.push(index);
              }
            });
          };

          if (parentId === null) {
            // Элементы в корневом списке
            findItemsInContainer(state.items);
          } else {
            // Элементы внутри группы - находим группу
            const parentGroup = findItemRecursive(state.items, parentId);
            if (!parentGroup || !isPlayerGroup(parentGroup)) {
              throw new Error('Parent group not found');
            }
            findItemsInContainer(parentGroup.items);
          }

          if (itemsToGroup.length === 0) {
            throw new Error('No items to group');
          }

          // Проверяем, что элементы соседние
          const sortedIndices = [...itemIndices].sort((a, b) => a - b);
          for (let i = 1; i < sortedIndices.length; i++) {
            if (sortedIndices[i] !== sortedIndices[i - 1] + 1) {
              throw new Error('Items must be consecutive to create a group');
            }
          }

          // Создаём группу
          const groupId = uuidv4();
          const group: PlayerGroup = {
            id: groupId,
            name: name || `Group ${itemsToGroup.length}`,
            items: itemsToGroup,
          };

          // Рекурсивная функция для обновления контейнера
          const updateContainer = (container: PlayerItem[]): PlayerItem[] => {
            const newContainer = [...container];
            // Сортируем индексы по убыванию для правильного удаления
            const sortedIndicesDesc = [...itemIndices].sort((a, b) => b - a);
            sortedIndicesDesc.forEach((index) => {
              newContainer.splice(index, 1);
            });
            // Вставляем группу на место первого элемента
            const insertIndex = Math.min(...itemIndices);
            newContainer.splice(insertIndex, 0, group);
            return newContainer;
          };

          let newItems: PlayerItem[];
          if (parentId === null) {
            // Обновляем корневой список
            newItems = updateContainer(state.items);
          } else {
            // Обновляем группу рекурсивно
            newItems = updateGroupInItems(state.items, parentId, (parentGroup) => ({
              ...parentGroup,
              items: updateContainer(parentGroup.items),
            }));
          }

          set({ items: newItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);

          return groupId;
        },

        ungroupGroup: (groupId) => {
          const state = get();

          // Рекурсивная функция для поиска и расформирования группы
          const ungroupRecursive = (items: PlayerItem[]): PlayerItem[] => {
            return items.flatMap((item) => {
              if (isPlayerGroup(item) && item.id === groupId) {
                // Заменяем группу на её элементы
                return item.items;
              }
              if (isPlayerGroup(item)) {
                // Рекурсивно обрабатываем вложенные группы
                return [
                  {
                    ...item,
                    items: ungroupRecursive(item.items),
                  },
                ];
              }
              return [item];
            });
          };

          const newItems = ungroupRecursive(state.items);

          set({ items: newItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        removeGroup: (groupId) => {
          get().removeItem(groupId);
        },

        setGroupName: (groupId, name) => {
          const state = get();
          const newItems = updateGroupInItems(state.items, groupId, (group) => ({
            ...group,
            name,
          }));
          set({ items: newItems });
        },

        addItemToGroup: (groupId, itemId, index) => {
          const state = get();
          const item = findItemRecursive(state.items, itemId);
          if (!item) {
            return;
          }

          // Удаляем элемент из текущего места
          const newItems = removeItemFromItems(state.items, itemId);

          // Добавляем в группу
          const updatedItems = updateGroupInItems(newItems, groupId, (group) => {
            const newGroupItems = [...group.items];
            if (index !== undefined) {
              newGroupItems.splice(index, 0, item);
            } else {
              newGroupItems.push(item);
            }
            return {
              ...group,
              items: newGroupItems,
            };
          });

          set({ items: updatedItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(updatedItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        removeItemFromGroup: (groupId, itemId) => {
          const state = get();
          const updatedItems = updateGroupInItems(state.items, groupId, (group) => ({
            ...group,
            items: group.items.filter((item) => item.id !== itemId),
          }));

          set({ items: updatedItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(updatedItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        moveItemInGroup: (groupId, fromIndex, toIndex) => {
          const state = get();
          const updatedItems = updateGroupInItems(state.items, groupId, (group) => {
            const newItems = [...group.items];
            const [moved] = newItems.splice(fromIndex, 1);
            newItems.splice(toIndex, 0, moved);
            return {
              ...group,
              items: newItems,
            };
          });

          set({ items: updatedItems });
        },

        selectItem: (id) => {
          set((state) => ({
            selectedItemIds: new Set([...state.selectedItemIds, id]),
          }));
        },

        deselectItem: (id) => {
          set((state) => {
            const newSelected = new Set(state.selectedItemIds);
            newSelected.delete(id);
            return { selectedItemIds: newSelected };
          });
        },

        toggleItemSelection: (id) => {
          const state = get();
          if (state.selectedItemIds.has(id)) {
            state.deselectItem(id);
          } else {
            state.selectItem(id);
          }
        },

        selectAll: () => {
          const state = get();
          const allIds = new Set<string>();
          const collectIds = (items: PlayerItem[]) => {
            items.forEach((item) => {
              allIds.add(item.id);
              if (isPlayerGroup(item)) {
                collectIds(item.items);
              }
            });
          };
          collectIds(state.items);
          set({ selectedItemIds: allIds });
        },

        deselectAll: () => {
          set({ selectedItemIds: new Set() });
        },

        removeSelectedItems: () => {
          const state = get();
          let newItems = [...state.items];
          state.selectedItemIds.forEach((id) => {
            newItems = removeItemFromItems(newItems, id);
          });
          set({ items: newItems, selectedItemIds: new Set() });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        moveSelectedItems: (toIndex) => {
          const state = get();
          const selectedIds = Array.from(state.selectedItemIds);
          const itemsToMove: PlayerItem[] = [];
          const indices: number[] = [];

          selectedIds.forEach((id) => {
            const index = state.items.findIndex((item) => item.id === id);
            if (index !== -1) {
              itemsToMove.push(state.items[index]);
              indices.push(index);
            }
          });

          if (itemsToMove.length === 0) {
            return;
          }

          // Сортируем индексы по убыванию
          indices.sort((a, b) => b - a);

          const newItems = [...state.items];
          indices.forEach((index) => {
            newItems.splice(index, 1);
          });

          const insertIndex = Math.min(toIndex, newItems.length);
          newItems.splice(insertIndex, 0, ...itemsToMove);

          set({ items: newItems });
          // Синхронизируем треки
          const tracks = getAllTracksRecursive(newItems);
          usePlayerStore.getState()._setTracks(tracks);
        },

        selectRange: (fromId, toId) => {
          const state = get();
          const fromIndex = state.findItemIndex(fromId);
          const toIndex = state.findItemIndex(toId);

          if (fromIndex === -1 || toIndex === -1) {
            return;
          }

          const start = Math.min(fromIndex, toIndex);
          const end = Math.max(fromIndex, toIndex);
          const newSelected = new Set(state.selectedItemIds);

          for (let i = start; i <= end; i++) {
            newSelected.add(state.items[i].id);
          }

          set({ selectedItemIds: newSelected });
        },
      };
    },
    {
      name: 'cherryplaylist-player-items',
      version: 1,
      partialize: (state) => ({
        items: state.items,
        selectedItemIds: Array.from(state.selectedItemIds),
      }),
      merge: (persistedState: any, currentState: PlayerItemsState) => {
        return {
          ...currentState,
          ...persistedState,
          selectedItemIds: new Set(persistedState?.selectedItemIds || []),
        };
      },
    },
  ),
);

