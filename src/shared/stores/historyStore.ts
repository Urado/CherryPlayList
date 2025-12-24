import { createWithEqualityFn } from 'zustand/traditional';

import { Track } from '../../core/types/track';

// Типы действий для истории
export type HistoryAction = AddTracksAction | RemoveTracksAction | MoveTracksAction | SetNameAction;

export interface AddTracksAction {
  type: 'addTracks';
  tracks: Track[];
  indices: number[]; // Индексы, куда были добавлены треки
}

export interface RemoveTracksAction {
  type: 'removeTracks';
  tracks: Track[];
  indices: number[]; // Индексы, откуда были удалены треки
}

export interface MoveTracksAction {
  type: 'moveTracks';
  trackIds: string[];
  fromIndices: number[];
  toIndices: number[];
}

export interface SetNameAction {
  type: 'setName';
  oldName: string;
  newName: string;
}

interface HistoryState {
  history: HistoryAction[];
  historyIndex: number; // -1 если нет истории, иначе индекс текущей позиции
  maxDepth: number;

  // Методы
  addAction: (action: HistoryAction) => void;
  undo: () => HistoryAction | null;
  redo: () => HistoryAction | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useHistoryStore = createWithEqualityFn<HistoryState>((set, get) => ({
  history: [],
  historyIndex: -1,
  maxDepth: 50,

  addAction: (action) => {
    const { history, historyIndex, maxDepth } = get();

    // Если есть "будущие" действия (после undo), удаляем их
    const newHistory =
      historyIndex < history.length - 1 ? history.slice(0, historyIndex + 1) : history;

    // Добавляем новое действие
    const updatedHistory = [...newHistory, action];

    // Ограничиваем глубину истории
    const finalHistory =
      updatedHistory.length > maxDepth ? updatedHistory.slice(-maxDepth) : updatedHistory;

    set({
      history: finalHistory,
      historyIndex: finalHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < 0) {
      return null;
    }

    const action = history[historyIndex];
    set({ historyIndex: historyIndex - 1 });
    return action;
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) {
      return null;
    }

    const nextIndex = historyIndex + 1;
    const action = history[nextIndex];
    set({ historyIndex: nextIndex });
    return action;
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex >= 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  clear: () => {
    set({
      history: [],
      historyIndex: -1,
    });
  },
}));

// Функция для создания обратного действия
export function createInverseAction(action: HistoryAction): HistoryAction {
  switch (action.type) {
    case 'addTracks':
      return {
        type: 'removeTracks',
        tracks: action.tracks,
        indices: action.indices,
      };

    case 'removeTracks':
      return {
        type: 'addTracks',
        tracks: action.tracks,
        indices: action.indices,
      };

    case 'moveTracks':
      return {
        type: 'moveTracks',
        trackIds: action.trackIds,
        fromIndices: action.toIndices,
        toIndices: action.fromIndices,
      };

    case 'setName':
      return {
        type: 'setName',
        oldName: action.newName,
        newName: action.oldName,
      };
  }
}

// Тип для функции применения действия к плейлисту
export type ApplyActionFn = (action: HistoryAction) => void;

// Функция для применения действия к плейлисту
export function applyActionToPlaylist(
  action: HistoryAction,
  playlistStore: {
    setName: (name: string) => void;
    addTracksAt?: (tracks: Omit<Track, 'id'>[], index: number) => void;
    _addTracksWithIds?: (tracks: Track[], index: number) => void;
    removeTrack: (id: string) => void;
    moveTrack: (fromIndex: number, toIndex: number) => void;
    _setTracks?: (tracks: Track[]) => void;
    tracks: Track[];
  },
): void {
  switch (action.type) {
    case 'setName':
      playlistStore.setName(action.newName);
      break;

    case 'addTracks': {
      // Добавляем треки обратно на их исходные позиции с сохранением оригинальных ID
      // Добавляем в обратном порядке индексов, чтобы не нарушить позиции
      const addPairs = action.tracks.map((track, i) => ({
        track,
        index: action.indices[i],
      }));
      addPairs.sort((a, b) => b.index - a.index);

      // Используем _addTracksWithIds если доступен (для сохранения ID), иначе addTracksAt
      if (playlistStore._addTracksWithIds) {
        addPairs.forEach(({ track, index }) => {
          playlistStore._addTracksWithIds!([track], index);
        });
      } else if (playlistStore.addTracksAt) {
        addPairs.forEach(({ track, index }) => {
          playlistStore.addTracksAt!([track], index);
        });
      }
      break;
    }

    case 'removeTracks':
      // Удаляем треки по их ID (индексы могли измениться)
      action.tracks.forEach((track) => {
        playlistStore.removeTrack(track.id);
      });
      break;

    case 'moveTracks': {
      // Перемещаем треки: находим текущие позиции и перемещаем в целевые
      // Создаем пары (id, текущий индекс, целевой индекс)
      const movePairs = action.trackIds
        .map((id, i) => {
          const currentIndex = playlistStore.tracks.findIndex((t) => t.id === id);
          return {
            id,
            currentIndex,
            toIndex: action.toIndices[i],
          };
        })
        .filter((pair) => pair.currentIndex !== -1 && pair.currentIndex !== pair.toIndex);

      if (movePairs.length === 0) break;

      // Если есть метод для массовой установки треков, используем его
      if (playlistStore._setTracks) {
        const tracks = [...playlistStore.tracks];

        // Разделяем перемещения на группы по направлению
        // Треки могут быть разбросаны, поэтому важно правильно группировать
        const moveLeft = movePairs.filter((p) => p.toIndex < p.currentIndex);
        const moveRight = movePairs.filter((p) => p.toIndex > p.currentIndex);

        // Перемещаем влево: сортируем по toIndex по возрастанию (слева направо)
        // Это гарантирует, что мы перемещаем треки в правильном порядке
        // и не нарушаем индексы других перемещаемых треков
        moveLeft.sort((a, b) => a.toIndex - b.toIndex);
        moveLeft.forEach(({ id, toIndex }) => {
          // Находим текущую позицию заново (она могла измениться после предыдущих перемещений)
          const currentIndex = tracks.findIndex((t) => t.id === id);
          if (currentIndex !== -1 && currentIndex !== toIndex) {
            const [moved] = tracks.splice(currentIndex, 1);
            tracks.splice(toIndex, 0, moved);
          }
        });

        // Перемещаем вправо: сортируем по toIndex по убыванию (справа налево)
        // Это гарантирует, что мы перемещаем треки в правильном порядке
        moveRight.sort((a, b) => b.toIndex - a.toIndex);
        moveRight.forEach(({ id, toIndex }) => {
          // Находим текущую позицию заново (она могла измениться после предыдущих перемещений)
          const currentIndex = tracks.findIndex((t) => t.id === id);
          if (currentIndex !== -1 && currentIndex !== toIndex) {
            const [moved] = tracks.splice(currentIndex, 1);
            tracks.splice(toIndex, 0, moved);
          }
        });

        // Применяем все изменения сразу
        playlistStore._setTracks(tracks);
      } else {
        // Fallback: перемещаем по одному (старый способ)
        // Разделяем по направлению для правильного порядка перемещения
        const moveLeft = movePairs.filter((p) => p.toIndex < p.currentIndex);
        const moveRight = movePairs.filter((p) => p.toIndex > p.currentIndex);

        // Перемещаем влево: слева направо
        moveLeft.sort((a, b) => a.toIndex - b.toIndex);
        moveLeft.forEach(({ id, toIndex }) => {
          const currentIndex = playlistStore.tracks.findIndex((t) => t.id === id);
          if (currentIndex !== -1 && currentIndex !== toIndex) {
            playlistStore.moveTrack(currentIndex, toIndex);
          }
        });

        // Перемещаем вправо: справа налево
        moveRight.sort((a, b) => b.toIndex - a.toIndex);
        moveRight.forEach(({ id, toIndex }) => {
          const currentIndex = playlistStore.tracks.findIndex((t) => t.id === id);
          if (currentIndex !== -1 && currentIndex !== toIndex) {
            playlistStore.moveTrack(currentIndex, toIndex);
          }
        });
      }
      break;
    }
  }
}

export interface HistoryManager {
  addAction: (action: HistoryAction) => void;
  undo: () => HistoryAction | null;
  redo: () => HistoryAction | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export function createHistoryManager(maxDepth = 50): HistoryManager {
  let history: HistoryAction[] = [];
  let historyIndex = -1;

  const addAction = (action: HistoryAction) => {
    const hasFuture = historyIndex < history.length - 1;
    const baseHistory = hasFuture ? history.slice(0, historyIndex + 1) : history;
    const updatedHistory = [...baseHistory, action];
    if (updatedHistory.length > maxDepth) {
      history = updatedHistory.slice(-maxDepth);
      historyIndex = history.length - 1;
    } else {
      history = updatedHistory;
      historyIndex = updatedHistory.length - 1;
    }
  };

  const undo = () => {
    if (historyIndex < 0) {
      return null;
    }
    const action = history[historyIndex];
    historyIndex -= 1;
    return action;
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) {
      return null;
    }
    const nextIndex = historyIndex + 1;
    const action = history[nextIndex];
    historyIndex = nextIndex;
    return action;
  };

  const canUndo = () => historyIndex >= 0;
  const canRedo = () => historyIndex < history.length - 1;

  const clear = () => {
    history = [];
    historyIndex = -1;
  };

  return {
    addAction,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  };
}
