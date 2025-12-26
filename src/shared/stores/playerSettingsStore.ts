import { persist } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

export type ActionAfterTrack = 'next' | 'pauseAndNext' | 'pause';

export interface PlayerTrackSettings {
  pauseBetweenTracks?: number | null;
  actionAfterTrack?: ActionAfterTrack | null;
}

export interface PlayerGroupSettings {
  pauseBetweenTracks?: number | null;
  actionAfterTrack?: ActionAfterTrack | null;
}

export interface PlayerSettings {
  defaultPauseBetweenTracks: number;
  defaultActionAfterTrack: ActionAfterTrack;
  plannedEndTime: number | null;
  playerAudioDeviceId: string | null;
  demoPlayerAudioDeviceId: string | null;
}

interface PlayerSettingsState extends PlayerSettings {
  // Настройки на уровне треков (по trackId)
  trackSettings: Map<string, PlayerTrackSettings>;
  // Настройки на уровне групп (по groupId) - будет использоваться позже
  groupSettings: Map<string, PlayerGroupSettings>;
  // Текущий редактируемый элемент
  editingTrackId: string | null;
  editingGroupId: string | null;
  editingIsGlobal: boolean;

  // Actions
  setDefaultPauseBetweenTracks: (value: number) => void;
  setDefaultActionAfterTrack: (value: ActionAfterTrack) => void;
  setTrackSettings: (trackId: string, settings: PlayerTrackSettings) => void;
  getTrackSettings: (trackId: string) => PlayerTrackSettings;
  clearTrackSettings: (trackId: string) => void;
  setGroupSettings: (groupId: string, settings: PlayerGroupSettings) => void;
  getGroupSettings: (groupId: string) => PlayerGroupSettings;
  clearGroupSettings: (groupId: string) => void;
  setEditingTrack: (trackId: string | null) => void;
  setEditingGroup: (groupId: string | null) => void;
  setEditingGlobal: (isGlobal: boolean) => void;
  setPlannedEndTime: (time: number | null) => void;
  setPlayerAudioDeviceId: (deviceId: string | null) => void;
  setDemoPlayerAudioDeviceId: (deviceId: string | null) => void;
}

const INITIAL_STATE: Omit<
  PlayerSettingsState,
  | 'setDefaultPauseBetweenTracks'
  | 'setDefaultActionAfterTrack'
  | 'setTrackSettings'
  | 'getTrackSettings'
  | 'clearTrackSettings'
  | 'setGroupSettings'
  | 'getGroupSettings'
  | 'clearGroupSettings'
  | 'setEditingTrack'
  | 'setEditingGroup'
  | 'setEditingGlobal'
  | 'setPlannedEndTime'
  | 'setPlayerAudioDeviceId'
  | 'setDemoPlayerAudioDeviceId'
> = {
  defaultPauseBetweenTracks: 0,
  defaultActionAfterTrack: 'next',
  plannedEndTime: null,
  playerAudioDeviceId: null,
  demoPlayerAudioDeviceId: null,
  trackSettings: new Map(),
  groupSettings: new Map(),
  editingTrackId: null,
  editingGroupId: null,
  editingIsGlobal: false,
};

export const usePlayerSettingsStore = createWithEqualityFn<PlayerSettingsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setDefaultPauseBetweenTracks: (value) => {
        set({ defaultPauseBetweenTracks: value });
      },

      setDefaultActionAfterTrack: (value) => {
        set({ defaultActionAfterTrack: value });
      },

      setTrackSettings: (trackId, settings) => {
        set((state) => {
          const newTrackSettings = new Map(state.trackSettings);
          newTrackSettings.set(trackId, settings);
          return { trackSettings: newTrackSettings };
        });
      },

      getTrackSettings: (trackId) => {
        return get().trackSettings.get(trackId) || {};
      },

      clearTrackSettings: (trackId) => {
        set((state) => {
          const newTrackSettings = new Map(state.trackSettings);
          newTrackSettings.delete(trackId);
          return { trackSettings: newTrackSettings };
        });
      },

      setGroupSettings: (groupId, settings) => {
        set((state) => {
          const newGroupSettings = new Map(state.groupSettings);
          newGroupSettings.set(groupId, settings);
          return { groupSettings: newGroupSettings };
        });
      },

      getGroupSettings: (groupId) => {
        return get().groupSettings.get(groupId) || {};
      },

      clearGroupSettings: (groupId) => {
        set((state) => {
          const newGroupSettings = new Map(state.groupSettings);
          newGroupSettings.delete(groupId);
          return { groupSettings: newGroupSettings };
        });
      },

      setEditingTrack: (trackId) => {
        set({
          editingTrackId: trackId,
          editingGroupId: null,
          editingIsGlobal: false,
        });
      },

      setEditingGroup: (groupId) => {
        set({
          editingTrackId: null,
          editingGroupId: groupId,
          editingIsGlobal: false,
        });
      },

      setEditingGlobal: (isGlobal) => {
        set({
          editingTrackId: null,
          editingGroupId: null,
          editingIsGlobal: isGlobal,
        });
      },

      setPlannedEndTime: (time) => {
        set({ plannedEndTime: time });
      },

      setPlayerAudioDeviceId: (deviceId) => {
        set({ playerAudioDeviceId: deviceId });
      },

      setDemoPlayerAudioDeviceId: (deviceId) => {
        set({ demoPlayerAudioDeviceId: deviceId });
      },
    }),
    {
      name: 'cherryplaylist-player-settings',
      version: 2,
      partialize: (state) => ({
        defaultPauseBetweenTracks: state.defaultPauseBetweenTracks,
        defaultActionAfterTrack: state.defaultActionAfterTrack,
        plannedEndTime: state.plannedEndTime,
        playerAudioDeviceId: state.playerAudioDeviceId,
        demoPlayerAudioDeviceId: state.demoPlayerAudioDeviceId,
        trackSettings: Array.from(state.trackSettings.entries()),
        groupSettings: Array.from(state.groupSettings.entries()),
      }),
      // Восстанавливаем Map из массива
      merge: (persistedState: any, currentState: PlayerSettingsState) => {
        return {
          ...currentState,
          ...persistedState,
          // Миграция с версии 1: добавляем поля для аудиоустройств, если их нет
          playerAudioDeviceId: persistedState?.playerAudioDeviceId ?? null,
          demoPlayerAudioDeviceId: persistedState?.demoPlayerAudioDeviceId ?? null,
          trackSettings: new Map(persistedState?.trackSettings || []),
          groupSettings: new Map(persistedState?.groupSettings || []),
        };
      },
    },
  ),
);

