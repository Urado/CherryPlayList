import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import {
  ensureTrackWorkspaceStore,
  registerTrackWorkspaceStore,
  TrackWorkspaceStore,
} from './trackWorkspaceStoreFactory';

/**
 * Player store - использует trackWorkspaceStoreFactory для управления треками
 * Player имеет неограниченное количество треков (maxTracks: null)
 */

// Инициализируем player store
const playerStore = ensureTrackWorkspaceStore({
  workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
  initialName: 'Player',
  maxTracks: null, // Неограниченное количество треков
  historyDepth: 50,
});

// Регистрируем store в реестре
registerTrackWorkspaceStore(DEFAULT_PLAYER_WORKSPACE_ID, playerStore);

/**
 * Hook для использования player store
 * Экспортируем сам store, чтобы можно было использовать usePlayerStore.getState()
 */
export const usePlayerStore = playerStore;

