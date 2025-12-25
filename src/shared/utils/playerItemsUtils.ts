import { PlayerGroup, PlayerItem, isPlayerGroup, isPlayerTrack } from '@core/types/player';
import { Track } from '@core/types/track';

/**
 * Элемент для отображения в плоском списке
 */
export interface DisplayItem {
  item: PlayerItem;
  level: number; // Глубина вложенности (0 - корневой уровень)
  displayIndex: number; // Индекс в плоском списке
}

/**
 * Рекурсивно преобразует иерархическую структуру PlayerItem[] в плоский список
 * с информацией о вложенности для отображения
 *
 * @param items - Иерархическая структура элементов
 * @param level - Текущий уровень вложенности (начинается с 0)
 * @param startIndex - Начальный индекс для нумерации (по умолчанию 0)
 * @returns Плоский список элементов с информацией о вложенности
 */
export function flattenItemsForDisplay(
  items: PlayerItem[],
  level: number = 0,
  startIndex: number = 0,
): DisplayItem[] {
  const result: DisplayItem[] = [];
  let currentIndex = startIndex;

  for (const item of items) {
    const isItemGroup = isPlayerGroup(item);
    
    // Для групп не увеличиваем счетчик, для треков - увеличиваем
    const itemIndex = isItemGroup ? -1 : currentIndex++;
    
    // Добавляем сам элемент
    result.push({
      item,
      level,
      displayIndex: itemIndex,
    });

    // Если это группа, рекурсивно добавляем её элементы
    if (isItemGroup) {
      const nestedItems = flattenItemsForDisplay(item.items, level + 1, currentIndex);
      result.push(...nestedItems);
      // Обновляем счетчик на основе максимального индекса треков в вложенных элементах
      // Находим максимальный индекс среди всех треков (не групп)
      let maxTrackIndex = currentIndex - 1;
      for (const nestedItem of nestedItems) {
        if (!isPlayerGroup(nestedItem.item) && nestedItem.displayIndex > maxTrackIndex) {
          maxTrackIndex = nestedItem.displayIndex;
        }
      }
      currentIndex = maxTrackIndex + 1;
    }
  }

  return result;
}

/**
 * Рекурсивно получает все треки из группы
 */
function getAllTracksFromGroup(group: PlayerGroup): Track[] {
  const tracks: Track[] = [];
  for (const item of group.items) {
    if (isPlayerTrack(item)) {
      tracks.push(item);
    } else if (isPlayerGroup(item)) {
      tracks.push(...getAllTracksFromGroup(item));
    }
  }
  return tracks;
}

/**
 * Получает общее количество элементов в группе (рекурсивно)
 */
export function getGroupItemCount(group: PlayerGroup): number {
  let count = 0;
  for (const item of group.items) {
    count++;
    if (isPlayerGroup(item)) {
      count += getGroupItemCount(item);
    }
  }
  return count;
}

/**
 * Получает общую длительность всех треков в группе (рекурсивно)
 */
export function getGroupTotalDuration(group: PlayerGroup): number {
  const tracks = getAllTracksFromGroup(group);
  return tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
}

/**
 * Получает все треки из плоского списка displayItems в правильном порядке
 * (только треки, без групп, в том же порядке, что и в displayItems)
 */
export function getTracksFromDisplayItems(displayItems: DisplayItem[]): Track[] {
  const tracks: Track[] = [];
  for (const displayItem of displayItems) {
    if (isPlayerTrack(displayItem.item)) {
      tracks.push(displayItem.item);
    }
  }
  return tracks;
}

