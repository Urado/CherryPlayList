import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import { isPlayerGroup } from '@core/types/player';

import { usePlayerItemsStore } from './playerItemsStore';

export type PlayerSessionMode = 'preparation' | 'session';

interface PlayerSessionState {
  mode: PlayerSessionMode;
  playedTrackIds: Set<string>;
  disabledTrackIds: Set<string>;
  disabledGroupIds: Set<string>;
  currentTrackId: string | null;

  startSession: () => void;
  resetSession: () => void;
  markTrackAsPlayed: (trackId: string) => void;
  setCurrentTrack: (trackId: string | null) => void;
  isTrackPlayed: (trackId: string) => boolean;
  toggleTrackDisabled: (trackId: string) => void;
  isTrackDisabled: (trackId: string) => boolean;
  toggleGroupDisabled: (groupId: string) => void;
  isGroupDisabled: (groupId: string) => boolean;
}

const INITIAL_STATE: Omit<
  PlayerSessionState,
  | 'startSession'
  | 'resetSession'
  | 'markTrackAsPlayed'
  | 'setCurrentTrack'
  | 'isTrackPlayed'
  | 'toggleTrackDisabled'
  | 'isTrackDisabled'
  | 'toggleGroupDisabled'
  | 'isGroupDisabled'
> = {
  mode: 'preparation',
  playedTrackIds: new Set<string>(),
  disabledTrackIds: new Set<string>(),
  disabledGroupIds: new Set<string>(),
  currentTrackId: null,
};

export const usePlayerSessionStore = createWithEqualityFn<PlayerSessionState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      startSession: () => {
        const state = get();
        if (state.mode === 'session') {
          return; // Уже в режиме сессии
        }

        set({
          mode: 'session',
          // История и текущий трек остаются (могут быть восстановлены из persist)
        });
      },

      resetSession: () => {
        set({
          mode: 'preparation',
          playedTrackIds: new Set<string>(),
          disabledTrackIds: new Set<string>(),
          disabledGroupIds: new Set<string>(),
          currentTrackId: null,
        });
      },

      markTrackAsPlayed: (trackId: string) => {
        set((state) => {
          const newPlayedIds = new Set(state.playedTrackIds);
          newPlayedIds.add(trackId);
          return { playedTrackIds: newPlayedIds };
        });
      },

      setCurrentTrack: (trackId: string | null) => {
        set({ currentTrackId: trackId });
      },

      isTrackPlayed: (trackId: string) => {
        return get().playedTrackIds.has(trackId);
      },

      toggleTrackDisabled: (trackId: string) => {
        set((state) => {
          const newDisabledIds = new Set(state.disabledTrackIds);
          if (newDisabledIds.has(trackId)) {
            newDisabledIds.delete(trackId);
          } else {
            newDisabledIds.add(trackId);
          }
          return { disabledTrackIds: newDisabledIds };
        });
      },

      isTrackDisabled: (trackId: string) => {
        return get().disabledTrackIds.has(trackId);
      },

      toggleGroupDisabled: (groupId: string) => {
        const state = get();
        const newDisabledGroupIds = new Set(state.disabledGroupIds);
        const newDisabledTrackIds = new Set(state.disabledTrackIds);

        // Получаем группу и все треки внутри неё
        const itemsStore = usePlayerItemsStore.getState();
        const group = itemsStore.findItemById(groupId);

        if (!group || !isPlayerGroup(group)) {
          return;
        }

        // Получаем все треки из группы рекурсивно
        const allTracks = itemsStore.getAllTracksInOrder([group]);

        if (newDisabledGroupIds.has(groupId)) {
          // Включаем группу - включаем все треки внутри
          newDisabledGroupIds.delete(groupId);
          allTracks.forEach((track) => {
            newDisabledTrackIds.delete(track.id);
          });
        } else {
          // Отключаем группу - отключаем все треки внутри
          newDisabledGroupIds.add(groupId);
          allTracks.forEach((track) => {
            newDisabledTrackIds.add(track.id);
          });
        }

        set({
          disabledGroupIds: newDisabledGroupIds,
          disabledTrackIds: newDisabledTrackIds,
        });
      },

      isGroupDisabled: (groupId: string) => {
        return get().disabledGroupIds.has(groupId);
      },
    }),
    {
      name: 'cherryplaylist-player-session',
      version: 2, // Увеличиваем версию из-за добавления disabledGroupIds
      partialize: (state) => ({
        mode: state.mode,
        playedTrackIds: Array.from(state.playedTrackIds),
        disabledTrackIds: Array.from(state.disabledTrackIds),
        disabledGroupIds: Array.from(state.disabledGroupIds),
        currentTrackId: state.currentTrackId,
      }),
      // Восстанавливаем Set из массива
      merge: (persistedState: any, currentState: PlayerSessionState) => {
        return {
          ...currentState,
          ...persistedState,
          playedTrackIds: new Set(persistedState?.playedTrackIds || []),
          disabledTrackIds: new Set(persistedState?.disabledTrackIds || []),
          disabledGroupIds: new Set(persistedState?.disabledGroupIds || []),
        };
      },
    },
  ),
);

