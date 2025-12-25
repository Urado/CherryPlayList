import { Track } from './track';
import { PlayerGroupSettings } from '@shared/stores/playerSettingsStore';

/**
 * Группа в плеере
 * Может содержать треки и другие группы (рекурсивная структура)
 */
export interface PlayerGroup {
  id: string;
  name: string;
  items: PlayerItem[]; // Рекурсивная структура
  settings?: PlayerGroupSettings;
}

/**
 * Элемент плеера - может быть треком или группой
 */
export type PlayerItem = Track | PlayerGroup;

/**
 * Type guard для проверки, является ли элемент группой
 */
export function isPlayerGroup(item: PlayerItem): item is PlayerGroup {
  return 'items' in item;
}

/**
 * Type guard для проверки, является ли элемент треком
 */
export function isPlayerTrack(item: PlayerItem): item is Track {
  return !isPlayerGroup(item);
}

