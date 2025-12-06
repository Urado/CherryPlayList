import { v4 as uuidv4 } from 'uuid';
import { createWithEqualityFn } from 'zustand/traditional';

import { Track } from '../types/track';
import { DEFAULT_PLAYLIST_WORKSPACE_ID } from '../utils/workspaceConstants';

import { useHistoryStore, createInverseAction, applyActionToPlaylist } from './historyStore';
import { registerTrackWorkspaceStore, TrackWorkspaceStore } from './trackWorkspaceStoreFactory';

const MAX_PLAYLIST_SIZE = 150;

interface PlaylistState {
  name: string;
  tracks: Track[];
  selectedTrackIds: Set<string>;
  _skipHistory: boolean; // Флаг для пропуска отслеживания истории (при undo/redo)
  maxTracks: number; // Лимит треков для совместимости с TrackWorkspaceStore

  // Playlist actions
  setName: (name: string) => void;
  addTrack: (track: Omit<Track, 'id'>) => void;
  addTracks: (tracks: Omit<Track, 'id'>[]) => void;
  addTracksAt: (tracks: Omit<Track, 'id'>[], index: number) => void;
  removeTrack: (id: string) => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;
  clear: () => void;
  loadFromJSON: (data: {
    name: string;
    tracks: Array<{ path: string; name: string; duration?: number }>;
  }) => void;

  // History actions
  undo: () => void;
  redo: () => void;
  _addTracksWithIds: (tracks: Track[], index: number) => void; // Внутренний метод для undo/redo
  _setTracks: (tracks: Track[]) => void; // Внутренний метод для установки треков (для undo/redo)

  // Selection actions
  selectTrack: (id: string) => void;
  deselectTrack: (id: string) => void;
  toggleTrackSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  removeSelectedTracks: () => void;
  moveSelectedTracks: (toIndex: number) => void;
  selectRange: (fromId: string, toId: string) => void;

  // Duration update
  updateTrackDuration: (id: string, duration: number) => void;

  // Методы для совместимости с TrackWorkspaceStore
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const playlistStore = createWithEqualityFn<PlaylistState>((set, get) => ({
  name: 'New Playlist',
  tracks: [],
  selectedTrackIds: new Set<string>(),
  _skipHistory: false,
  maxTracks: MAX_PLAYLIST_SIZE,

  setName: (name) => {
    const state = get();
    const oldName = state.name;
    set({ name });

    // Отслеживаем историю только если не пропускаем
    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'setName',
        oldName,
        newName: name,
      });
    }
  },

  addTrack: (track) => {
    const state = get();
    // Check playlist size limit
    if (state.tracks.length >= MAX_PLAYLIST_SIZE) {
      return;
    }
    const newTrack = { ...track, id: uuidv4() };
    const newIndex = state.tracks.length;
    set({
      tracks: [...state.tracks, newTrack],
    });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'addTracks',
        tracks: [newTrack],
        indices: [newIndex],
      });
    }
  },

  addTracks: (tracks) => {
    const state = get();
    // Calculate how many tracks can be added without exceeding the limit
    const availableSlots = MAX_PLAYLIST_SIZE - state.tracks.length;
    if (availableSlots <= 0) {
      return;
    }
    // Add only up to the limit
    const tracksToAdd = tracks.slice(0, availableSlots);
    const tracksWithIds = tracksToAdd.map((t) => ({ ...t, id: uuidv4() }));
    const startIndex = state.tracks.length;
    const indices = tracksWithIds.map((_, i) => startIndex + i);

    set({
      tracks: [...state.tracks, ...tracksWithIds],
    });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'addTracks',
        tracks: tracksWithIds,
        indices,
      });
    }
  },

  addTracksAt: (tracks, index) => {
    const state = get();
    // Calculate how many tracks can be added without exceeding the limit
    const availableSlots = MAX_PLAYLIST_SIZE - state.tracks.length;
    if (availableSlots <= 0) {
      return;
    }
    // Add only up to the limit
    const tracksToAdd = tracks.slice(0, availableSlots);
    const newTracks = [...state.tracks];
    const tracksWithIds = tracksToAdd.map((t) => ({ ...t, id: uuidv4() }));
    const insertIndex = Math.max(0, Math.min(index, newTracks.length));
    const indices = tracksWithIds.map((_, i) => insertIndex + i);

    newTracks.splice(insertIndex, 0, ...tracksWithIds);
    set({ tracks: newTracks });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'addTracks',
        tracks: tracksWithIds,
        indices,
      });
    }
  },

  _addTracksWithIds: (tracks, index) => {
    const state = get();
    const newTracks = [...state.tracks];
    const insertIndex = Math.max(0, Math.min(index, newTracks.length));
    newTracks.splice(insertIndex, 0, ...tracks);
    set({ tracks: newTracks });
  },

  _setTracks: (tracks) => {
    set({ tracks });
  },

  removeTrack: (id) => {
    const state = get();
    const trackIndex = state.tracks.findIndex((t) => t.id === id);
    if (trackIndex === -1) return;

    const removedTrack = state.tracks[trackIndex];
    set({
      tracks: state.tracks.filter((t) => t.id !== id),
      selectedTrackIds: new Set(
        [...state.selectedTrackIds].filter((selectedId) => selectedId !== id),
      ),
    });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'removeTracks',
        tracks: [removedTrack],
        indices: [trackIndex],
      });
    }
  },

  moveTrack: (fromIndex, toIndex) => {
    const state = get();
    if (fromIndex === toIndex) return;

    const newTracks = [...state.tracks];
    const [moved] = newTracks.splice(fromIndex, 1);
    newTracks.splice(toIndex, 0, moved);
    set({ tracks: newTracks });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'moveTracks',
        trackIds: [moved.id],
        fromIndices: [fromIndex],
        toIndices: [toIndex],
      });
    }
  },

  clear: () => {
    const state = get();
    const oldTracks = state.tracks;
    const oldIndices = oldTracks.map((_, i) => i);

    set({ name: 'New Playlist', tracks: [], selectedTrackIds: new Set() });

    if (!state._skipHistory && oldTracks.length > 0) {
      useHistoryStore.getState().addAction({
        type: 'removeTracks',
        tracks: oldTracks,
        indices: oldIndices,
      });
    }
  },

  loadFromJSON: (data) => {
    const tracksWithIds = data.tracks.map((t) => ({ ...t, id: uuidv4() }));

    set({
      name: data.name || 'New Playlist',
      tracks: tracksWithIds,
      selectedTrackIds: new Set(),
    });

    // Очищаем историю при загрузке нового плейлиста
    useHistoryStore.getState().clear();
  },

  undo: () => {
    const historyStore = useHistoryStore.getState();
    const action = historyStore.undo();
    if (!action) return;

    const inverseAction = createInverseAction(action);
    const state = get();

    // Устанавливаем флаг для пропуска истории
    set({ _skipHistory: true });

    // Применяем обратное действие
    applyActionToPlaylist(inverseAction, {
      setName: (name) => get().setName(name),
      _addTracksWithIds: (tracks, index) => get()._addTracksWithIds(tracks, index),
      removeTrack: (id) => get().removeTrack(id),
      moveTrack: (fromIndex, toIndex) => get().moveTrack(fromIndex, toIndex),
      _setTracks: (tracks) => get()._setTracks(tracks),
      tracks: state.tracks,
    });

    // Сбрасываем флаг
    set({ _skipHistory: false });
  },

  redo: () => {
    const historyStore = useHistoryStore.getState();
    const action = historyStore.redo();
    if (!action) return;

    const state = get();

    // Устанавливаем флаг для пропуска истории
    set({ _skipHistory: true });

    // Применяем действие напрямую
    applyActionToPlaylist(action, {
      setName: (name) => get().setName(name),
      _addTracksWithIds: (tracks, index) => get()._addTracksWithIds(tracks, index),
      removeTrack: (id) => get().removeTrack(id),
      moveTrack: (fromIndex, toIndex) => get().moveTrack(fromIndex, toIndex),
      _setTracks: (tracks) => get()._setTracks(tracks),
      tracks: state.tracks,
    });

    // Сбрасываем флаг
    set({ _skipHistory: false });
  },

  selectTrack: (id) =>
    set((state) => {
      // Оптимизация: не создаём новый Set, если id уже выбран
      if (state.selectedTrackIds.has(id)) {
        return state;
      }
      return {
        selectedTrackIds: new Set([...state.selectedTrackIds, id]),
      };
    }),

  deselectTrack: (id) =>
    set((state) => {
      // Оптимизация: не создаём новый Set, если id не выбран
      if (!state.selectedTrackIds.has(id)) {
        return state;
      }
      const newSet = new Set(state.selectedTrackIds);
      newSet.delete(id);
      return { selectedTrackIds: newSet };
    }),

  toggleTrackSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedTrackIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      // Оптимизация: возвращаем state, если Set не изменился (не должно произойти, но на всякий случай)
      return { selectedTrackIds: newSet };
    }),

  selectAll: () =>
    set((state) => {
      // Оптимизация: не создаём новый Set, если все уже выбраны
      if (state.selectedTrackIds.size === state.tracks.length) {
        return state;
      }
      return {
        selectedTrackIds: new Set(state.tracks.map((t) => t.id)),
      };
    }),

  deselectAll: () =>
    set((state) => {
      // Оптимизация: не создаём новый Set, если ничего не выбрано
      if (state.selectedTrackIds.size === 0) {
        return state;
      }
      return { selectedTrackIds: new Set() };
    }),

  selectRange: (fromId: string, toId: string) => {
    const state = get();
    const fromIndex = state.tracks.findIndex((t) => t.id === fromId);
    const toIndex = state.tracks.findIndex((t) => t.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = new Set(state.tracks.slice(start, end + 1).map((t) => t.id));

    // Оптимизация: проверяем, есть ли новые ID для добавления
    const hasNewIds = Array.from(rangeIds).some((id) => !state.selectedTrackIds.has(id));
    if (!hasNewIds) {
      return; // Все ID уже выбраны
    }

    set((state) => ({
      selectedTrackIds: new Set([...state.selectedTrackIds, ...rangeIds]),
    }));
  },

  removeSelectedTracks: () => {
    const state = get();
    const selectedIds = state.selectedTrackIds;
    if (selectedIds.size === 0) return;

    // Собираем удаляемые треки с их индексами
    const removedTracks: Track[] = [];
    const removedIndices: number[] = [];

    state.tracks.forEach((track, index) => {
      if (selectedIds.has(track.id)) {
        removedTracks.push(track);
        removedIndices.push(index);
      }
    });

    set({
      tracks: state.tracks.filter((t) => !selectedIds.has(t.id)),
      selectedTrackIds: new Set(),
    });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'removeTracks',
        tracks: removedTracks,
        indices: removedIndices,
      });
    }
  },

  moveSelectedTracks: (toIndex: number) => {
    const state = get();
    const selectedIds = state.selectedTrackIds;
    if (selectedIds.size === 0) return;

    // Собираем выделенные треки в порядке их следования
    const selectedTracks: Track[] = [];
    const remainingTracks: Track[] = [];
    const fromIndices: number[] = [];

    state.tracks.forEach((track, index) => {
      if (selectedIds.has(track.id)) {
        selectedTracks.push(track);
        fromIndices.push(index);
      } else {
        remainingTracks.push(track);
      }
    });

    // Вставляем выделенные треки на новую позицию
    const newTracks = [...remainingTracks];
    const insertIndex = Math.max(0, Math.min(toIndex, newTracks.length));
    newTracks.splice(insertIndex, 0, ...selectedTracks);

    // Вычисляем целевые индексы
    const toIndices = selectedTracks.map((_, i) => insertIndex + i);

    set({ tracks: newTracks });

    if (!state._skipHistory) {
      useHistoryStore.getState().addAction({
        type: 'moveTracks',
        trackIds: selectedTracks.map((t) => t.id),
        fromIndices,
        toIndices,
      });
    }
  },

  updateTrackDuration: (id: string, duration: number) => {
    const state = get();
    const trackIndex = state.tracks.findIndex((t) => t.id === id);
    if (trackIndex === -1) return;

    const newTracks = [...state.tracks];
    newTracks[trackIndex] = { ...newTracks[trackIndex], duration };
    set({ tracks: newTracks });
  },

  // Методы для совместимости с TrackWorkspaceStore
  canUndo: () => {
    return useHistoryStore.getState().canUndo();
  },

  canRedo: () => {
    return useHistoryStore.getState().canRedo();
  },
}));

// Регистрируем плейлист store в trackWorkspaceStores для поддержки cross-workspace операций
// Создаем адаптер, который преобразует PlaylistState в TrackWorkspaceStore
// Примечание: playlistStore использует глобальный historyStore, поэтому history/historyIndex
// доступны через useHistoryStore.getState(), а не через playlistStore.getState()
// Для совместимости с TrackWorkspaceStore методы canUndo/canRedo добавлены в PlaylistState
const playlistStoreAdapter = playlistStore as unknown as TrackWorkspaceStore;
registerTrackWorkspaceStore(DEFAULT_PLAYLIST_WORKSPACE_ID, playlistStoreAdapter);

export const usePlaylistStore = playlistStore;
