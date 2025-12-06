import { v4 as uuidv4 } from 'uuid';
import { StoreApi, UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { createWithEqualityFn, useStoreWithEqualityFn } from 'zustand/traditional';

import { WorkspaceId } from '../modules/dragDrop/types';
import { Track } from '../types/track';

import { applyActionToPlaylist, createInverseAction, HistoryAction } from './historyStore';

const DEFAULT_HISTORY_DEPTH = 50;
const DEFAULT_MAX_TRACKS = 150;

export interface TrackWorkspaceStoreOptions {
  workspaceId: WorkspaceId;
  initialName?: string;
  maxTracks?: number | null;
  historyDepth?: number;
}

export interface TrackWorkspaceState {
  workspaceId: WorkspaceId;
  name: string;
  tracks: Track[];
  selectedTrackIds: Set<string>;
  _skipHistory: boolean;
  history: HistoryAction[];
  historyIndex: number;
  historyDepth: number;
  maxTracks: number | null;

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

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  _addTracksWithIds: (tracks: Track[], index: number) => void;
  _setTracks: (tracks: Track[]) => void;

  selectTrack: (id: string) => void;
  deselectTrack: (id: string) => void;
  toggleTrackSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  removeSelectedTracks: () => void;
  moveSelectedTracks: (toIndex: number) => void;
  selectRange: (fromId: string, toId: string) => void;

  updateTrackDuration: (id: string, duration: number) => void;
}

export type TrackWorkspaceStore = UseBoundStore<StoreApi<TrackWorkspaceState>>;

const trackWorkspaceStores = new Map<WorkspaceId, TrackWorkspaceStore>();

function pushHistory(state: TrackWorkspaceState, action: HistoryAction): HistoryAction[] {
  const hasFuture = state.historyIndex < state.history.length - 1;
  const baseHistory = hasFuture ? state.history.slice(0, state.historyIndex + 1) : state.history;
  const updatedHistory = [...baseHistory, action];

  if (updatedHistory.length > state.historyDepth) {
    return updatedHistory.slice(-state.historyDepth);
  }
  return updatedHistory;
}

function createStore(options: TrackWorkspaceStoreOptions): TrackWorkspaceStore {
  const { workspaceId, initialName, maxTracks, historyDepth } = options;

  // Коллекции (maxTracks === null) должны сохраняться между запусками
  const shouldPersist = maxTracks === null;

  const storeCreator = (
    set: (
      partial:
        | Partial<TrackWorkspaceState>
        | ((state: TrackWorkspaceState) => Partial<TrackWorkspaceState>),
    ) => void,
    get: () => TrackWorkspaceState,
  ) => ({
    workspaceId,
    name: initialName || 'New Workspace',
    tracks: [],
    selectedTrackIds: new Set<string>(),
    _skipHistory: false,
    history: [],
    historyIndex: -1,
    historyDepth: historyDepth ?? DEFAULT_HISTORY_DEPTH,
    maxTracks: typeof maxTracks === 'number' ? maxTracks : DEFAULT_MAX_TRACKS,

    setName: (name) => {
      const state = get();
      const oldName = state.name;
      set({ name });
      if (!state._skipHistory && oldName !== name) {
        const nextHistory = pushHistory(state, { type: 'setName', oldName, newName: name });
        const diff = nextHistory.length - state.historyDepth;
        const newHistory =
          diff > 0
            ? nextHistory.slice(diff)
            : nextHistory; /* safeguard although pushHistory handles */
        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      }
    },

    addTrack: (track) => {
      const state = get();
      if (state.maxTracks !== null && state.tracks.length >= state.maxTracks) {
        return;
      }
      const newTrack = { ...track, id: uuidv4() };
      const newTracks = [...state.tracks, newTrack];
      set({ tracks: newTracks });

      if (!state._skipHistory) {
        const nextHistory = pushHistory(state, {
          type: 'addTracks',
          tracks: [newTrack],
          indices: [state.tracks.length],
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        });
      }
    },

    addTracks: (tracks) => {
      const state = get();
      const availableSlots =
        state.maxTracks === null ? tracks.length : state.maxTracks - state.tracks.length;
      if (availableSlots <= 0) {
        return;
      }
      const tracksToAdd = tracks.slice(0, availableSlots);
      const tracksWithIds = tracksToAdd.map((t) => ({ ...t, id: uuidv4() }));
      const startIndex = state.tracks.length;
      const indices = tracksWithIds.map((_, i) => startIndex + i);

      set({
        tracks: [...state.tracks, ...tracksWithIds],
      });

      if (!state._skipHistory) {
        const nextHistory = pushHistory(state, {
          type: 'addTracks',
          tracks: tracksWithIds,
          indices,
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        });
      }
    },

    addTracksAt: (tracks, index) => {
      const state = get();
      const availableSlots =
        state.maxTracks === null ? tracks.length : state.maxTracks - state.tracks.length;
      if (availableSlots <= 0) {
        return;
      }
      const tracksToAdd = tracks.slice(0, availableSlots);
      const newTracks = [...state.tracks];
      const tracksWithIds = tracksToAdd.map((t) => ({ ...t, id: uuidv4() }));
      const insertIndex = Math.max(0, Math.min(index, newTracks.length));
      const indices = tracksWithIds.map((_, i) => insertIndex + i);

      newTracks.splice(insertIndex, 0, ...tracksWithIds);
      set({ tracks: newTracks });

      if (!state._skipHistory) {
        const nextHistory = pushHistory(state, {
          type: 'addTracks',
          tracks: tracksWithIds,
          indices,
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
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
        const nextHistory = pushHistory(state, {
          type: 'removeTracks',
          tracks: [removedTrack],
          indices: [trackIndex],
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
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
        const nextHistory = pushHistory(state, {
          type: 'moveTracks',
          trackIds: [moved.id],
          fromIndices: [fromIndex],
          toIndices: [toIndex],
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        });
      }
    },

    clear: () => {
      const state = get();
      const oldTracks = state.tracks;
      const oldIndices = oldTracks.map((_, i) => i);

      set({ name: 'New Workspace', tracks: [], selectedTrackIds: new Set() });

      if (!state._skipHistory && oldTracks.length > 0) {
        const nextHistory = pushHistory(state, {
          type: 'removeTracks',
          tracks: oldTracks,
          indices: oldIndices,
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        });
      }
    },

    loadFromJSON: (data) => {
      const tracksWithIds = data.tracks.map((t) => ({ ...t, id: uuidv4() }));

      set({
        name: data.name || 'New Workspace',
        tracks: tracksWithIds,
        selectedTrackIds: new Set(),
        history: [],
        historyIndex: -1,
      });
    },

    undo: () => {
      const state = get();
      if (state.historyIndex < 0) {
        return;
      }
      const action = state.history[state.historyIndex];
      const inverseAction = createInverseAction(action);

      set({ _skipHistory: true });
      applyActionToPlaylist(inverseAction, {
        setName: (name) => get().setName(name),
        _addTracksWithIds: (tracks, index) => get()._addTracksWithIds(tracks, index),
        removeTrack: (id) => get().removeTrack(id),
        moveTrack: (fromIndex, toIndex) => get().moveTrack(fromIndex, toIndex),
        _setTracks: (tracksParam) => get()._setTracks(tracksParam),
        tracks: get().tracks,
      });
      set({
        _skipHistory: false,
        historyIndex: state.historyIndex - 1,
      });
    },

    redo: () => {
      const state = get();
      if (state.historyIndex >= state.history.length - 1) {
        return;
      }
      const nextIndex = state.historyIndex + 1;
      const action = state.history[nextIndex];

      set({ _skipHistory: true });
      applyActionToPlaylist(action, {
        setName: (name) => get().setName(name),
        _addTracksWithIds: (tracks, index) => get()._addTracksWithIds(tracks, index),
        removeTrack: (id) => get().removeTrack(id),
        moveTrack: (fromIndex, toIndex) => get().moveTrack(fromIndex, toIndex),
        _setTracks: (tracksParam) => get()._setTracks(tracksParam),
        tracks: get().tracks,
      });
      set({
        _skipHistory: false,
        historyIndex: nextIndex,
      });
    },

    canUndo: () => {
      const state = get();
      return state.historyIndex >= 0;
    },

    canRedo: () => {
      const state = get();
      return state.historyIndex < state.history.length - 1;
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
        const nextHistory = pushHistory(state, {
          type: 'removeTracks',
          tracks: removedTracks,
          indices: removedIndices,
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        });
      }
    },

    moveSelectedTracks: (toIndex: number) => {
      const state = get();
      const selectedIds = state.selectedTrackIds;
      if (selectedIds.size === 0) return;

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

      const newTracks = [...remainingTracks];
      const insertIndex = Math.max(0, Math.min(toIndex, newTracks.length));
      newTracks.splice(insertIndex, 0, ...selectedTracks);

      const toIndices = selectedTracks.map((_, i) => insertIndex + i);

      set({ tracks: newTracks });

      if (!state._skipHistory) {
        const nextHistory = pushHistory(state, {
          type: 'moveTracks',
          trackIds: selectedTracks.map((t) => t.id),
          fromIndices,
          toIndices,
        });
        set({
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
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
  });

  // Create store with or without persistence
  if (shouldPersist) {
    return createWithEqualityFn<TrackWorkspaceState>()(
      persist(storeCreator, {
        name: `cherryplaylist-collection-${workspaceId}`,
        version: 1,
        partialize: (state) => ({
          workspaceId: state.workspaceId,
          name: state.name,
          tracks: state.tracks,
          // Не сохраняем selectedTrackIds, history, _skipHistory
        }),
      }),
    );
  }

  return createWithEqualityFn<TrackWorkspaceState>(storeCreator);
}

export function ensureTrackWorkspaceStore(
  options: TrackWorkspaceStoreOptions,
): TrackWorkspaceStore {
  const existing = trackWorkspaceStores.get(options.workspaceId);
  if (existing) {
    return existing;
  }
  const store = createStore(options);
  trackWorkspaceStores.set(options.workspaceId, store);
  return store;
}

export function getTrackWorkspaceStore(workspaceId: WorkspaceId): TrackWorkspaceStore | undefined {
  return trackWorkspaceStores.get(workspaceId);
}

/**
 * Регистрирует существующий store в реестре
 * Используется для регистрации legacy stores (например, playlistStore)
 */
export function registerTrackWorkspaceStore(
  workspaceId: WorkspaceId,
  store: TrackWorkspaceStore,
): void {
  trackWorkspaceStores.set(workspaceId, store);
}

export function removeTrackWorkspaceStore(workspaceId: WorkspaceId): void {
  const store = trackWorkspaceStores.get(workspaceId);
  if (!store) {
    return;
  }
  trackWorkspaceStores.delete(workspaceId);
  store.destroy();
}

export function useTrackWorkspaceSelector<T>(
  workspaceId: WorkspaceId,
  selector: (state: TrackWorkspaceState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = trackWorkspaceStores.get(workspaceId);
  if (!store) {
    throw new Error(`Track workspace store ${workspaceId} is not registered`);
  }
  return useStoreWithEqualityFn(store, selector, equalityFn);
}

/**
 * Возвращает все зарегистрированные workspaceId (для отладки)
 */
export function getAllTrackWorkspaceStores(): WorkspaceId[] {
  return Array.from(trackWorkspaceStores.keys());
}
