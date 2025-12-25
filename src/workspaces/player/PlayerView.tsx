import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SettingsIcon from '@mui/icons-material/Settings';
import TimerIcon from '@mui/icons-material/Timer';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isPlayerGroup, isPlayerTrack, PlayerItem } from '@core/types/player';
import { Track } from '@core/types/track';
import { WorkspaceId } from '@core/types/workspace';
import { PlaylistItem } from '@shared/components';
import { useTrackWorkspaceDragAndDrop, useTrackDuration } from '@shared/hooks';
import { fileService, ipcService } from '@shared/services';
import { useDemoPlayerStore, useUIStore } from '@shared/stores';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';
import { usePlayerSessionStore } from '@shared/stores/playerSessionStore';
import { usePlayerSettingsStore } from '@shared/stores/playerSettingsStore';
import { usePlayerStore } from '@shared/stores/playerStore';
import { formatDuration, logger } from '@shared/utils';
import { flattenItemsForDisplay, getTracksFromDisplayItems } from '@shared/utils/playerItemsUtils';

import { PlayerControls } from './PlayerControls';

interface PlayerViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ workspaceId: _workspaceId, zoneId }) => {
  // Используем playerItemsStore для работы с группами
  const {
    items,
    selectedItemIds,
    removeItem,
    addItem,
    toggleItemSelection,
    selectAll,
    deselectAll,
    removeSelectedItems,
    moveItem,
    selectRange,
    getAllTracksInOrder,
    getItemPath,
    createGroup,
    findItemById,
  } = usePlayerItemsStore((state) => state);

  // Получаем имя из playerStore (для обратной совместимости)
  const { name, setName, updateTrackDuration } = usePlayerStore((state) => ({
    name: state.name,
    setName: state.setName,
    updateTrackDuration: state.updateTrackDuration,
  }));

  // Получаем плоский список для отображения
  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);

  // Получаем все треки в правильном порядке для логики воспроизведения
  // Используем порядок из displayItems, чтобы он соответствовал визуальному отображению
  const allTracks = useMemo(() => {
    // Получаем треки из displayItems в визуальном порядке
    return getTracksFromDisplayItems(displayItems);
  }, [displayItems]);

  const resolveTrackByPath = useCallback(
    (path: string) => allTracks.find((track) => track.path === path),
    [allTracks],
  );

  const { loadDurationsForTracks } = useTrackDuration({
    tracks: allTracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackByPath,
    onDurationResolved: updateTrackDuration,
  });

  const handleAddTracks = useCallback(
    (newTracks: Omit<Track, 'id'>[]) => {
      const tracksWithIds = newTracks.map((track) => ({
        ...track,
        id: `track-${Date.now()}-${Math.random()}`,
      })) as Track[];
      tracksWithIds.forEach((track) => addItem(track));
      const paths = tracksWithIds.map((track) => track.path);
      loadDurationsForTracks(paths);
    },
    [addItem, loadDurationsForTracks],
  );

  const handleAddTracksAt = useCallback(
    (newTracks: Omit<Track, 'id'>[], index: number) => {
      const tracksWithIds = newTracks.map((track) => ({
        ...track,
        id: `track-${Date.now()}-${Math.random()}`,
      })) as Track[];
      tracksWithIds.forEach((track) => addItem(track, index));
      const paths = tracksWithIds.map((track) => track.path);
      loadDurationsForTracks(paths);
    },
    [addItem, loadDurationsForTracks],
  );

  const playerDrag = useTrackWorkspaceDragAndDrop({
    tracks: allTracks,
    selectedTrackIds: selectedItemIds,
    workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
    isValidAudioFile: fileService.isValidAudioFile.bind(fileService),
    onMoveTrack: () => {
      // Не используется, так как используем handleDropWithGroups
    },
    onMoveSelectedTracks: () => {
      // Не используется, так как используем handleDropWithGroups
    },
    onAddTracks: handleAddTracks,
    onAddTracksAt: handleAddTracksAt,
    onTracksAdded: loadDurationsForTracks,
    loadFolderTracks: ipcService.findAudioFilesRecursive.bind(ipcService),
  });

  // Кастомная логика drag & drop для работы с группами
  const handleDropWithGroups = useCallback(
    (e: React.DragEvent, targetItemId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (!playerDrag.draggedItems || playerDrag.draggedItems.type !== 'tracks') {
        return;
      }

      const draggedIds = Array.from(playerDrag.draggedItems.ids);
      if (draggedIds.length === 0) {
        return;
      }

      const targetDisplayItem = displayItems.find((di) => di.item.id === targetItemId);
      if (!targetDisplayItem) {
        return;
      }

      const targetItem = targetDisplayItem.item;
      const insertPosition = playerDrag.insertPosition;

      // Получаем перетаскиваемые элементы (только корневые, не вложенные)
      const draggedItems: PlayerItem[] = [];
      draggedIds.forEach((id) => {
        const item = findItemById(id);
        if (item) {
          // Проверяем, не является ли элемент вложенным в другой перетаскиваемый элемент
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

      // Если перетаскиваем на группу
      if (isPlayerGroup(targetItem)) {
        // insertPosition === 'bottom' означает добавление в группу
        // insertPosition === 'top' означает добавление перед группой
        if (insertPosition === 'bottom') {
          // Проверяем, что группа не добавляется внутрь самой себя
          const targetGroupId = targetItem.id;

          // Фильтруем элементы, которые нельзя добавить в эту группу
          const validItemsToAdd = draggedItems.filter((item) => {
            // Нельзя добавлять группу внутрь самой себя
            if (isPlayerGroup(item) && item.id === targetGroupId) {
              return false;
            }

            // Нельзя добавлять группу, если целевая группа находится внутри перетаскиваемой группы
            if (isPlayerGroup(item)) {
              const draggedGroupPath = getItemPath(item.id);
              // Проверяем, находится ли целевая группа внутри перетаскиваемой группы
              const targetIsInsideDragged = draggedGroupPath.includes(targetGroupId);
              if (targetIsInsideDragged) {
                return false;
              }
            }

            return true;
          });

          // Если нет валидных элементов для добавления, ничего не делаем
          if (validItemsToAdd.length === 0) {
            playerDrag.handleDragEnd();
            return;
          }

          // Добавляем в группу только валидные элементы
          // addItemToGroup сам удаляет элемент из текущего места
          const { addItemToGroup } = usePlayerItemsStore.getState();
          validItemsToAdd.forEach((item) => {
            addItemToGroup(targetGroupId, item.id, 0); // Добавляем в начало группы
          });
        } else {
          // Добавляем перед группой (в корневой список)
          const targetItemIndex = items.findIndex((itemInList) => itemInList.id === targetItem.id);
          if (targetItemIndex !== -1) {
            // Обрабатываем в обратном порядке, чтобы индексы не сбились
            const itemsToProcess = [...draggedItems].reverse();
            itemsToProcess.forEach((item, idx) => {
              // Проверяем, находится ли элемент в корневом списке
              const itemPath = getItemPath(item.id);
              const itemParentGroupId = itemPath.length > 1 ? itemPath[itemPath.length - 2] : null;

              if (!itemParentGroupId) {
                // Перемещаем в корневом списке
                const currentIndex = items.findIndex((itemInList) => itemInList.id === item.id);
                if (currentIndex !== -1) {
                  let adjustedFinalIndex = targetItemIndex;
                  // Корректируем индекс, если перемещаем вверх
                  if (currentIndex < targetItemIndex) {
                    adjustedFinalIndex = targetItemIndex - 1 - idx;
                  } else {
                    adjustedFinalIndex = targetItemIndex + idx;
                  }
                  moveItem(currentIndex, adjustedFinalIndex);
                }
              } else {
                // Добавляем в корневой список из группы
                removeItem(item.id);
                addItem(item, targetItemIndex + idx);
              }
            });
          }
        }
        playerDrag.handleDragEnd();
        return;
      }

      // Если перетаскиваем на трек
      if (isPlayerTrack(targetItem)) {
        // Находим родительскую группу трека (если есть)
        const targetPath = getItemPath(targetItem.id);
        const targetParentGroupId =
          targetPath.length > 1 ? targetPath[targetPath.length - 2] : null;

        // Если трек находится в группе
        if (targetParentGroupId) {
          const targetParentGroup = findItemById(targetParentGroupId);
          if (targetParentGroup && isPlayerGroup(targetParentGroup)) {
            // Находим индекс целевого трека в группе
            const targetIndexInGroup = targetParentGroup.items.findIndex(
              (item) => item.id === targetItem.id,
            );

            if (targetIndexInGroup !== -1) {
              // Определяем индекс вставки
              let insertIndex = targetIndexInGroup;
              if (insertPosition === 'bottom') {
                insertIndex = targetIndexInGroup + 1;
              }

              // Перемещаем элементы внутри группы
              // Обрабатываем в обратном порядке, чтобы индексы не сбились
              const itemsToProcess = [...draggedItems].reverse();
              itemsToProcess.forEach((item, idx) => {
                // Проверяем, находится ли элемент уже в этой группе
                const itemPath = getItemPath(item.id);
                const itemParentGroupId =
                  itemPath.length > 1 ? itemPath[itemPath.length - 2] : null;

                if (itemParentGroupId === targetParentGroupId) {
                  // Перемещаем внутри группы
                  const currentIndexInGroup = targetParentGroup.items.findIndex(
                    (itemInGroup) => itemInGroup.id === item.id,
                  );
                  if (currentIndexInGroup !== -1) {
                    const { moveItemInGroup } = usePlayerItemsStore.getState();
                    let finalIndex = insertIndex;
                    // Корректируем индекс, если перемещаем вверх
                    if (currentIndexInGroup < insertIndex) {
                      finalIndex = insertIndex - 1 - idx;
                    } else {
                      finalIndex = insertIndex + idx;
                    }
                    moveItemInGroup(targetParentGroupId, currentIndexInGroup, finalIndex);
                  }
                } else {
                  // Добавляем в группу извне
                  // Проверяем, что группа не добавляется внутрь самой себя
                  let isValid = true;
                  if (isPlayerGroup(item)) {
                    // Нельзя добавлять группу внутрь самой себя
                    if (item.id === targetParentGroupId) {
                      isValid = false;
                    } else {
                      // Проверяем, что целевая группа не находится внутри перетаскиваемой группы
                      const targetGroupPath = getItemPath(targetParentGroupId);
                      const targetIsInsideDragged = targetGroupPath.includes(item.id);
                      if (targetIsInsideDragged) {
                        isValid = false;
                      }
                    }
                  }

                  if (isValid) {
                    // addItemToGroup сам удаляет элемент из текущего места
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
          // Трек находится в корневом списке
          // Находим индекс целевого трека в items
          const targetItemIndex = items.findIndex((itemInList) => itemInList.id === targetItem.id);
          if (targetItemIndex !== -1) {
            let finalIndex = targetItemIndex;
            if (insertPosition === 'bottom') {
              finalIndex = targetItemIndex + 1;
            }

            // Перемещаем элементы в корневом списке
            // Обрабатываем в обратном порядке, чтобы индексы не сбились
            const itemsToProcess = [...draggedItems].reverse();
            itemsToProcess.forEach((item, idx) => {
              // Проверяем, находится ли элемент в корневом списке
              const itemPath = getItemPath(item.id);
              const itemParentGroupId = itemPath.length > 1 ? itemPath[itemPath.length - 2] : null;

              if (!itemParentGroupId) {
                // Перемещаем в корневом списке
                const currentIndex = items.findIndex((itemInList) => itemInList.id === item.id);
                if (currentIndex !== -1) {
                  let adjustedFinalIndex = finalIndex;
                  // Корректируем индекс, если перемещаем вверх
                  if (currentIndex < finalIndex) {
                    adjustedFinalIndex = finalIndex - 1 - idx;
                  } else {
                    adjustedFinalIndex = finalIndex + idx;
                  }
                  moveItem(currentIndex, adjustedFinalIndex);
                }
              } else {
                // Добавляем в корневой список из группы
                removeItem(item.id);
                addItem(item, finalIndex + idx);
              }
            });
            playerDrag.handleDragEnd();
            return;
          }
        }
      }

      // Если не удалось обработать, используем стандартную логику
      playerDrag.handleDragEnd();
    },
    [displayItems, findItemById, getItemPath, removeItem, addItem, moveItem, items, playerDrag],
  );

  // Состояние сессии
  const mode = usePlayerSessionStore((state) => state.mode);
  const startSession = usePlayerSessionStore((state) => state.startSession);
  const resetSession = usePlayerSessionStore((state) => state.resetSession);
  const {
    markTrackAsPlayed,
    setCurrentTrack,
    isTrackPlayed,
    toggleTrackDisabled,
    isTrackDisabled,
    toggleGroupDisabled,
    isGroupDisabled,
  } = usePlayerSessionStore();
  const isPreparationMode = mode === 'preparation';

  // Вспомогательная функция для проверки, отключен ли трек (с учетом родительских групп)
  const isTrackOrGroupDisabled = useCallback(
    (itemId: string): boolean => {
      // Проверяем, отключен ли сам трек
      if (isTrackDisabled(itemId)) {
        return true;
      }

      // Проверяем родительские группы
      const path = getItemPath(itemId);
      // Путь содержит: [rootGroupId, innerGroupId, ..., itemId]
      // Проверяем все элементы пути кроме последнего (самого элемента)
      if (path.length > 1) {
        for (let i = path.length - 2; i >= 0; i--) {
          const groupId = path[i];
          // Убеждаемся, что это действительно группа, а не трек
          const item = findItemById(groupId);
          if (item && isPlayerGroup(item) && isGroupDisabled(groupId)) {
            return true;
          }
        }
      }

      return false;
    },
    [isTrackDisabled, isGroupDisabled, getItemPath, findItemById],
  );

  // Демо-плеер для режима подготовки
  const {
    currentTrack: activeDemoTrack,
    status: demoPlayerStatus,
    loadTrack: loadDemoTrack,
    play: playDemo,
    pause: pauseDemo,
  } = useDemoPlayerStore();
  const activeDemoTrackId = activeDemoTrack?.id;

  // Плеер для режима сессии
  const {
    currentTrack: activePlayerTrack,
    status: playerAudioStatus,
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    pause: pausePlayer,
    stop,
    setOnTrackEnded,
    setPauseTimer,
    clearPauseTimer,
  } = usePlayerAudioStore();
  const activePlayerTrackId = activePlayerTrack?.id;

  // Флаг для предотвращения race condition при обработке окончания трека
  const isProcessingTrackEndRef = useRef(false);

  // Определяем активный трек в зависимости от режима
  const activeTrackId = isPreparationMode ? activeDemoTrackId : activePlayerTrackId;
  const playerStatus = isPreparationMode ? demoPlayerStatus : playerAudioStatus;

  const startTrackPlayback = useCallback(
    async (track: Track) => {
      try {
        if (isPreparationMode) {
          // В режиме подготовки используем демо-плеер
          const isSameTrack = activeDemoTrackId === track.id;
          if (!isSameTrack || demoPlayerStatus === 'ended') {
            await loadDemoTrack(track, DEFAULT_PLAYER_WORKSPACE_ID);
          }
          await playDemo();
        } else {
          // В режиме сессии используем playerAudioStore
          const isSameTrack = activePlayerTrackId === track.id;
          if (!isSameTrack || playerAudioStatus === 'ended') {
            await loadPlayerTrack(track);
          }
          await playPlayer();
        }
      } catch (error) {
        logger.error('Failed to start track playback', error);
      }
    },
    [
      isPreparationMode,
      activeDemoTrackId,
      activePlayerTrackId,
      demoPlayerStatus,
      playerAudioStatus,
      loadDemoTrack,
      loadPlayerTrack,
      playDemo,
      playPlayer,
    ],
  );

  const pausePlayback = useCallback(() => {
    if (isPreparationMode) {
      pauseDemo();
    } else {
      pausePlayer();
    }
  }, [isPreparationMode, pauseDemo, pausePlayer]);

  const handleStartSession = useCallback(async () => {
    if (allTracks.length === 0) {
      return;
    }

    // Проверяем наличие активных (не отключённых) треков
    const hasActiveTracks = allTracks.some(
      (track) => !isTrackPlayed(track.id) && !isTrackOrGroupDisabled(track.id),
    );
    if (!hasActiveTracks) {
      return;
    }

    // Начинаем сессию
    startSession();

    // Находим первый активный трек (не проигранный, не отключённый)
    const firstActiveTrack = allTracks.find(
      (track) => !isTrackPlayed(track.id) && !isTrackOrGroupDisabled(track.id),
    );

    if (firstActiveTrack) {
      try {
        // Загружаем трек в плеер
        await loadPlayerTrack(firstActiveTrack);
        // Устанавливаем его как текущий
        setCurrentTrack(firstActiveTrack.id);
        // Запускаем воспроизведение
        await playPlayer();
      } catch (error) {
        logger.error('Failed to start first track playback', error);
      }
    }
  }, [
    startSession,
    allTracks,
    isTrackPlayed,
    isTrackOrGroupDisabled,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
  ]);

  const handleResetSession = useCallback(() => {
    clearPauseTimer(); // Очищаем таймер паузы при сбросе
    resetSession();
    pausePlayer(); // Останавливаем плеер при сбросе
    isProcessingTrackEndRef.current = false; // Сбрасываем флаг обработки
  }, [resetSession, pausePlayer, clearPauseTimer]);

  const openModal = useUIStore((state) => state.openModal);
  const {
    getTrackSettings,
    getGroupSettings,
    setEditingTrack,
    setEditingGroup,
    setEditingGlobal,
    defaultActionAfterTrack,
    defaultPauseBetweenTracks,
  } = usePlayerSettingsStore();

  const handleOpenTrackSettings = useCallback(
    (itemId: string) => {
      const item = findItemById(itemId);
      if (item) {
        if (isPlayerGroup(item)) {
          setEditingGroup(itemId);
        } else {
          setEditingTrack(itemId);
        }
        openModal('trackSettings');
      }
    },
    [openModal, setEditingTrack, setEditingGroup, findItemById],
  );

  const handleOpenGlobalSettings = useCallback(() => {
    setEditingGlobal(true);
    openModal('trackSettings');
  }, [openModal, setEditingGlobal]);

  // Функция для получения эффективных настроек трека (с учетом иерархии)
  const getEffectiveTrackSettings = useCallback(
    (trackId: string) => {
      const trackSettings = getTrackSettings(trackId);

      // Если у трека есть индивидуальные настройки, используем их
      if (trackSettings.actionAfterTrack !== null && trackSettings.actionAfterTrack !== undefined) {
        return {
          actionAfterTrack: trackSettings.actionAfterTrack,
          pauseBetweenTracks: trackSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks,
        };
      }

      // Получаем путь к треку через группы
      const path = getItemPath(trackId);

      // Ищем настройки групп в порядке от ближайшей к дальней
      for (let i = path.length - 1; i >= 0; i--) {
        const itemId = path[i];
        const item = findItemById(itemId);
        if (item && isPlayerGroup(item)) {
          const groupSettings = getGroupSettings(itemId);
          if (
            groupSettings.actionAfterTrack !== null &&
            groupSettings.actionAfterTrack !== undefined
          ) {
            return {
              actionAfterTrack: groupSettings.actionAfterTrack,
              pauseBetweenTracks: groupSettings.pauseBetweenTracks ?? defaultPauseBetweenTracks,
            };
          }
        }
      }

      // Используем настройки по умолчанию
      return {
        actionAfterTrack: defaultActionAfterTrack,
        pauseBetweenTracks: defaultPauseBetweenTracks,
      };
    },
    [
      getTrackSettings,
      getGroupSettings,
      getItemPath,
      findItemById,
      defaultActionAfterTrack,
      defaultPauseBetweenTracks,
    ],
  );

  // Функция для получения следующего активного трека
  const getNextActiveTrack = useCallback(() => {
    const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
    if (currentIndex === -1) {
      // Если текущего трека нет, ищем первый активный трек
      for (let i = 0; i < allTracks.length; i++) {
        const track = allTracks[i];
        if (!isTrackPlayed(track.id) && !isTrackOrGroupDisabled(track.id)) {
          return track;
        }
      }
      return null;
    }

    // Ищем следующий активный трек (не проигранный, не отключенный)
    for (let i = currentIndex + 1; i < allTracks.length; i++) {
      const track = allTracks[i];
      if (!isTrackPlayed(track.id) && !isTrackOrGroupDisabled(track.id)) {
        return track;
      }
    }

    return null;
  }, [allTracks, activePlayerTrackId, isTrackPlayed, isTrackOrGroupDisabled]);

  // Функция для пометки пропущенных отключённых треков как проигранных
  const markSkippedDisabledTracks = useCallback(
    (fromIndex: number, toIndex: number) => {
      for (let i = fromIndex + 1; i < toIndex; i++) {
        const track = allTracks[i];
        if (track && isTrackOrGroupDisabled(track.id) && !isTrackPlayed(track.id)) {
          markTrackAsPlayed(track.id);
        }
      }
    },
    [allTracks, isTrackOrGroupDisabled, isTrackPlayed, markTrackAsPlayed],
  );

  // Обработчик окончания трека
  const handleTrackEnded = useCallback(async () => {
    if (!activePlayerTrackId || isPreparationMode) {
      return;
    }

    // Предотвращаем race condition - если уже обрабатываем окончание, игнорируем
    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentTrack = allTracks.find((t) => t.id === activePlayerTrackId);
      if (!currentTrack) {
        return;
      }

      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);

      // Помечаем текущий трек как проигранный
      markTrackAsPlayed(activePlayerTrackId);

      // Получаем настройки для текущего трека
      const settings = getEffectiveTrackSettings(activePlayerTrackId);

      // Применяем действие после трека
      if (settings.actionAfterTrack === 'pause') {
        // Пауза после трека - переходим к следующему и ставим на паузу
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          // Трек уже на паузе после загрузки
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      } else if (settings.actionAfterTrack === 'pauseAndNext') {
        // Пауза между треками - ждем время паузы, затем переходим
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          // Запускаем таймер паузы через store
          setPauseTimer(async () => {
            const currentStatus = usePlayerAudioStore.getState().status;
            const currentTrackId = usePlayerAudioStore.getState().currentTrack?.id;
            // Проверяем, что трек все еще тот же и все еще на паузе
            if (currentStatus === 'paused' && currentTrackId === nextTrack.id) {
              await playPlayer();
            }
          }, settings.pauseBetweenTracks * 1000);
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      } else {
        // Сплошное воспроизведение (next) - сразу переходим к следующему
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          await playPlayer();
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    activePlayerTrackId,
    isPreparationMode,
    allTracks,
    markTrackAsPlayed,
    getEffectiveTrackSettings,
    getNextActiveTrack,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    markSkippedDisabledTracks,
    setPauseTimer,
  ]);

  // Обработчик Next
  const handleNext = useCallback(async () => {
    if (isPreparationMode || !activePlayerTrackId) {
      return;
    }

    // Очищаем таймер паузы при ручном переходе
    clearPauseTimer();

    // Предотвращаем race condition
    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
      markTrackAsPlayed(activePlayerTrackId);
      const nextTrack = getNextActiveTrack();
      if (nextTrack) {
        const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
        markSkippedDisabledTracks(currentIndex, nextIndex);
        await loadPlayerTrack(nextTrack);
        setCurrentTrack(nextTrack.id);
        await playPlayer();
      } else {
        markSkippedDisabledTracks(currentIndex, allTracks.length);
        stop();
        setCurrentTrack(null);
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    isPreparationMode,
    activePlayerTrackId,
    allTracks,
    markTrackAsPlayed,
    getNextActiveTrack,
    markSkippedDisabledTracks,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    stop,
    clearPauseTimer,
  ]);

  // Устанавливаем обработчик окончания трека
  useEffect(() => {
    if (!isPreparationMode) {
      setOnTrackEnded(handleTrackEnded);
    } else {
      setOnTrackEnded(undefined);
    }
    return () => {
      setOnTrackEnded(undefined);
    };
  }, [isPreparationMode, handleTrackEnded, setOnTrackEnded]);

  // Обработчик отключения/включения трека или группы
  const handleToggleDisabled = useCallback(
    (itemId: string) => {
      // Запрещаем отключение текущего трека
      if (itemId === activePlayerTrackId) {
        return;
      }
      const item = findItemById(itemId);
      if (item) {
        if (isPlayerGroup(item)) {
          toggleGroupDisabled(itemId);
        } else {
          toggleTrackDisabled(itemId);
        }
      }
    },
    [activePlayerTrackId, toggleTrackDisabled, toggleGroupDisabled, findItemById],
  );

  const hasSelectedItems = selectedItemIds.size > 0;

  // Проверка, можно ли удалить выбранные элементы (не должно быть проигранных или текущего в режиме сессии)
  const canRemoveSelectedItems = useMemo(() => {
    if (isPreparationMode) {
      return true;
    }
    return Array.from(selectedItemIds).every((itemId) => {
      const item = findItemById(itemId);
      if (!item) {
        return true;
      }
      // Для треков проверяем проигранность и текущий статус
      if (isPlayerTrack(item)) {
        const trackIsPlayed = isTrackPlayed(itemId);
        const isCurrentTrack = itemId === activePlayerTrackId;
        return !trackIsPlayed && !isCurrentTrack;
      }
      // Для групп проверяем, что внутри нет проигранных или текущего трека
      if (isPlayerGroup(item)) {
        const groupTracks = getAllTracksInOrder([item]);
        return groupTracks.every((track) => {
          const trackIsPlayed = isTrackPlayed(track.id);
          const isCurrentTrack = track.id === activePlayerTrackId;
          return !trackIsPlayed && !isCurrentTrack;
        });
      }
      return true;
    });
  }, [
    isPreparationMode,
    selectedItemIds,
    findItemById,
    isTrackPlayed,
    activePlayerTrackId,
    getAllTracksInOrder,
  ]);

  // Обработчик удаления выбранных элементов с проверкой
  const handleRemoveSelectedItems = useCallback(() => {
    if (!canRemoveSelectedItems) {
      return;
    }
    removeSelectedItems();
  }, [canRemoveSelectedItems, removeSelectedItems]);

  // Мемоизация вычисления общей длительности с учетом пауз между треками
  const totalDuration = useMemo(() => {
    let total = 0;
    for (let i = 0; i < allTracks.length; i++) {
      const track = allTracks[i];
      // Пропускаем отключённые треки
      if (isTrackOrGroupDisabled(track.id)) {
        continue;
      }
      // Добавляем длительность трека
      total += track.duration || 0;
      // Добавляем паузу между треками, если это не последний трек
      if (i < allTracks.length - 1) {
        const settings = getEffectiveTrackSettings(track.id);
        // Если действие "pauseAndNext", добавляем время паузы
        if (settings.actionAfterTrack === 'pauseAndNext') {
          total += settings.pauseBetweenTracks;
        }
        // Если действие "next" или "pause", пауза не добавляется
        // (для "next" - сплошное воспроизведение, для "pause" - пауза не учитывается в общем времени)
      }
    }
    return total;
  }, [allTracks, isTrackOrGroupDisabled, getEffectiveTrackSettings]);

  // Функция для проверки, являются ли выбранные элементы соседними
  const areItemsConsecutive = useCallback(
    (itemIds: string[]): boolean => {
      if (itemIds.length < 2) return false;

      const indices = itemIds
        .map((id) => displayItems.findIndex((di) => di.item.id === id))
        .filter((idx) => idx !== -1)
        .sort((a, b) => a - b);

      if (indices.length !== itemIds.length) return false;

      // Проверяем, что индексы идут подряд
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) {
          return false;
        }
      }

      return true;
    },
    [displayItems],
  );

  // Обработчик создания группы
  const handleCreateGroup = useCallback(() => {
    if (selectedItemIds.size < 2) return;

    const selectedIds = Array.from(selectedItemIds);
    if (!areItemsConsecutive(selectedIds)) return;

    try {
      createGroup(selectedIds);
      deselectAll();
    } catch (error) {
      logger.error('Failed to create group', error);
    }
  }, [selectedItemIds, areItemsConsecutive, createGroup, deselectAll]);

  return (
    <div className="playlist-view player-view">
      <div className="playlist-header-section">
        <div className="playlist-header-row">
          <input
            type="text"
            className="playlist-name-input-header"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player"
          />
          {hasSelectedItems && (
            <>
              <button
                onClick={deselectAll}
                className="playlist-header-action-icon"
                title="Deselect All"
              >
                <ClearIcon style={{ fontSize: '20px' }} />
              </button>
              {isPreparationMode &&
                selectedItemIds.size >= 2 &&
                areItemsConsecutive(Array.from(selectedItemIds)) && (
                  <button
                    onClick={handleCreateGroup}
                    className="playlist-header-action-icon"
                    title="Создать группу"
                  >
                    <GroupAddIcon style={{ fontSize: '20px' }} />
                  </button>
                )}
              <button
                onClick={handleRemoveSelectedItems}
                className="playlist-header-action-icon delete-button"
                disabled={!canRemoveSelectedItems}
                title={
                  canRemoveSelectedItems
                    ? `Delete Selected (${selectedItemIds.size})`
                    : 'Нельзя удалить проигранные или текущий трек в режиме сессии'
                }
              >
                <DeleteSweepIcon style={{ fontSize: '20px' }} />
              </button>
            </>
          )}
          {!hasSelectedItems && displayItems.length > 0 && (
            <button onClick={selectAll} className="playlist-header-action-icon" title="Select All">
              <SelectAllIcon style={{ fontSize: '20px' }} />
            </button>
          )}
        </div>
        <div className="playlist-stats-header">
          <ListIcon style={{ fontSize: '18px', marginRight: '4px' }} />
          <span>{allTracks.length} треков</span>
          {allTracks.length > 0 && (
            <>
              <span style={{ margin: '0 8px' }}>•</span>
              <TimerIcon style={{ fontSize: '18px', marginRight: '4px' }} />
              <span>{formatDuration(totalDuration)}</span>
            </>
          )}
        </div>

        <div className="player-header-actions">
          {/* Кнопка Начать сессию / Сбросить */}
          <div className="player-session-controls">
            {isPreparationMode ? (
              <button
                onClick={handleStartSession}
                disabled={allTracks.length === 0}
                className="player-session-button player-session-button--start"
              >
                Начать сессию
              </button>
            ) : (
              <button
                onClick={handleResetSession}
                className="player-session-button player-session-button--reset"
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Иконка глобальных настроек */}
          <button
            onClick={handleOpenGlobalSettings}
            className="player-settings-icon"
            title="Глобальные настройки"
          >
            <SettingsIcon style={{ fontSize: '20px' }} />
          </button>
        </div>
      </div>

      <div
        className="playlist-tracks"
        onDragOver={(e) =>
          playerDrag.handleDragOver(e, {
            module: 'playlistContainer',
            workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
            zoneId,
          })
        }
        onDragLeave={(e) => playerDrag.handleDragLeave(e)}
        onDragEnd={playerDrag.handleDragEnd}
        onDrop={(e) => {
          // Для контейнера используем стандартную логику (добавление в конец)
          playerDrag.handleDrop(e, {
            module: 'playlistContainer',
            workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
            zoneId,
          });
        }}
      >
        {displayItems.length === 0 ? (
          <div className="empty-state">
            <p>Player is empty</p>
            <p className="empty-state-hint">Перетащите треки сюда для воспроизведения</p>
          </div>
        ) : (
          <>
            {displayItems.map((displayItem) => {
              const { item, level, displayIndex } = displayItem;
              const isGroup = isPlayerGroup(item);
              const track = isPlayerTrack(item) ? item : null;

              const isDraggedTrack =
                playerDrag.draggedItems?.type === 'tracks' &&
                playerDrag.draggedItems.ids.has(item.id);
              const showInsertLine =
                playerDrag.dragOverId === item.id && playerDrag.insertPosition !== null;
              const isActive = activeTrackId === item.id;
              const isPlaying = isActive && playerStatus === 'playing';

              // Получаем настройки для отображения индикатора
              let hasCustomSettings = false;
              let settingsActionAfterTrack: string | null = null;
              if (isGroup) {
                const groupSettings = getGroupSettings(item.id);
                hasCustomSettings =
                  groupSettings.actionAfterTrack !== null &&
                  groupSettings.actionAfterTrack !== undefined;
                settingsActionAfterTrack = groupSettings.actionAfterTrack || null;
              } else if (track) {
                const trackSettings = getTrackSettings(track.id);
                hasCustomSettings =
                  trackSettings.actionAfterTrack !== null &&
                  trackSettings.actionAfterTrack !== undefined;
                settingsActionAfterTrack = trackSettings.actionAfterTrack || null;
              }

              // Определяем состояние элемента
              let itemIsPlayed = false;
              let itemIsDisabled = false;
              if (isGroup) {
                // Для группы проверяем состояние всех треков внутри
                const groupTracks = getAllTracksInOrder([item]);
                itemIsPlayed =
                  groupTracks.length > 0 && groupTracks.every((t) => isTrackPlayed(t.id));
                itemIsDisabled = isGroupDisabled(item.id);
              } else if (track) {
                itemIsPlayed = isTrackPlayed(track.id);
                // Используем isTrackOrGroupDisabled, чтобы учитывать родительские группы
                itemIsDisabled = isTrackOrGroupDisabled(track.id);
              }

              const isCurrentTrack = track?.id === activePlayerTrackId;
              // Группа заблокирована, если содержит проигранные или текущий трек
              const isLocked =
                !isPreparationMode &&
                (itemIsPlayed ||
                  isCurrentTrack ||
                  (isGroup &&
                    getAllTracksInOrder([item]).some(
                      (t) => isTrackPlayed(t.id) || t.id === activePlayerTrackId,
                    )));

              return (
                <React.Fragment key={item.id}>
                  {showInsertLine && playerDrag.insertPosition === 'top' && (
                    <div className="drag-insert-line" />
                  )}
                  <PlaylistItem
                    item={item}
                    index={displayIndex}
                    level={level}
                    isSelected={selectedItemIds.has(item.id)}
                    isDragging={isDraggedTrack}
                    isDragOver={playerDrag.dragOverId === item.id && !isDraggedTrack}
                    insertPosition={
                      playerDrag.dragOverId === item.id && !isDraggedTrack
                        ? playerDrag.insertPosition
                        : null
                    }
                    onToggleSelect={(id, event) => {
                      if (event?.ctrlKey || event?.metaKey) {
                        toggleItemSelection(id);
                      } else if (event?.shiftKey && selectedItemIds.size > 0) {
                        const lastSelected = Array.from(selectedItemIds).pop();
                        if (lastSelected) {
                          selectRange(lastSelected, id);
                        } else {
                          toggleItemSelection(id);
                        }
                      } else {
                        toggleItemSelection(id);
                      }
                    }}
                    onRemove={removeItem}
                    onDragStart={(e) => playerDrag.handleDragStart(e, item.id)}
                    onDragOver={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'none';
                        return;
                      }
                      playerDrag.handleDragOver(e, {
                        module: 'playlistItem',
                        targetId: item.id,
                        workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
                        zoneId,
                      });
                    }}
                    onDrop={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        return;
                      }
                      // Используем кастомную логику для работы с группами
                      handleDropWithGroups(e, item.id);
                    }}
                    onDragEnd={playerDrag.handleDragEnd}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    onPlay={startTrackPlayback}
                    onPause={pausePlayback}
                    hidePlayButton={!isPreparationMode || isGroup}
                    isPlayed={itemIsPlayed}
                    isDisabled={itemIsDisabled}
                    isCurrent={isCurrentTrack}
                    onToggleDisabled={handleToggleDisabled}
                    isLocked={isLocked}
                    showDisableButton={!isPreparationMode}
                    settingsButton={
                      <button
                        className="playlist-item-settings"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTrackSettings(item.id);
                        }}
                        title={isGroup ? 'Настройки группы' : 'Настройки трека'}
                      >
                        <SettingsIcon style={{ fontSize: '18px' }} />
                        {hasCustomSettings && settingsActionAfterTrack && (
                          <span className="player-settings-indicator">
                            {settingsActionAfterTrack === 'pause'
                              ? '⏸'
                              : settingsActionAfterTrack === 'pauseAndNext'
                                ? '⏸⏭'
                                : '⏭'}
                          </span>
                        )}
                      </button>
                    }
                  />
                  {showInsertLine && playerDrag.insertPosition === 'bottom' && (
                    <div className="drag-insert-line" />
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Панель управления плеером */}
      <PlayerControls onNext={handleNext} />
    </div>
  );
};
