import { createWithEqualityFn } from 'zustand/traditional';

import { WorkspaceId } from '../modules/dragDrop/types';
import { Track } from '../types/track';
import { logger } from '../utils/logger';

import {
  getTrackWorkspaceStore,
  getAllTrackWorkspaceStores,
  TrackWorkspaceState,
} from './trackWorkspaceStoreFactory';
import { useUIStore } from './uiStore';

interface DragDropState {
  moveTracksBetweenWorkspaces: (
    trackIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetIndex?: number,
  ) => boolean; // Возвращает true при успехе, false при ошибке
  copyTracksBetweenWorkspaces: (
    trackIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetIndex?: number,
  ) => boolean; // Возвращает true при успехе, false при ошибке
}

/**
 * Проверяет, можно ли добавить указанное количество треков в target store
 */
function canAddTracks(
  targetState: TrackWorkspaceState | { maxTracks?: number | null; tracks: Track[] },
  count: number,
): { canAdd: boolean; availableSlots: number } {
  // Обрабатываем случай, когда maxTracks отсутствует или равен null/undefined
  const maxTracks = targetState.maxTracks;
  if (maxTracks === null || maxTracks === undefined) {
    return { canAdd: true, availableSlots: count };
  }

  // Проверяем, что maxTracks - это число
  if (typeof maxTracks !== 'number' || isNaN(maxTracks)) {
    logger.warn('canAddTracks: maxTracks is not a valid number', { maxTracks });
    return { canAdd: true, availableSlots: count };
  }

  const tracksLength = targetState.tracks?.length ?? 0;
  const availableSlots = maxTracks - tracksLength;
  return { canAdd: availableSlots >= count, availableSlots: Math.max(0, availableSlots) };
}

export const useDragDropStore = createWithEqualityFn<DragDropState>(() => ({
  moveTracksBetweenWorkspaces: (
    trackIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetIndex?: number,
  ): boolean => {
    try {
      // Валидация входных данных
      if (!trackIds || trackIds.length === 0) {
        logger.warn('moveTracksBetweenWorkspaces: empty trackIds array');
        return false;
      }

      if (sourceWorkspaceId === targetWorkspaceId) {
        logger.warn('moveTracksBetweenWorkspaces: source and target workspaces are the same');
        return false;
      }

      // Получаем stores
      const sourceStore = getTrackWorkspaceStore(sourceWorkspaceId);
      const targetStore = getTrackWorkspaceStore(targetWorkspaceId);

      if (!sourceStore || !targetStore) {
        const registeredStores = getAllTrackWorkspaceStores();
        logger.error('moveTracksBetweenWorkspaces: stores not found', {
          sourceWorkspaceId,
          targetWorkspaceId,
          registeredStores,
        });
        useUIStore.getState().addNotification({
          type: 'error',
          message: `Cannot move tracks: workspace not found`,
          duration: 5000,
        });
        return false;
      }

      // Получаем треки из source store
      const sourceState = sourceStore.getState();
      const tracksToMove = sourceState.tracks.filter((track) => trackIds.includes(track.id));

      if (tracksToMove.length === 0) {
        logger.warn('moveTracksBetweenWorkspaces: no tracks found to move');
        return false;
      }

      // Проверяем лимиты target store
      const targetState = targetStore.getState();
      const { canAdd, availableSlots } = canAddTracks(targetState, tracksToMove.length);

      if (!canAdd) {
        const message =
          availableSlots > 0
            ? `Cannot move ${tracksToMove.length} tracks: only ${availableSlots} slots available`
            : `Cannot move tracks: target workspace is full`;
        logger.warn('moveTracksBetweenWorkspaces: target workspace limit exceeded', {
          requested: tracksToMove.length,
          available: availableSlots,
        });
        useUIStore.getState().addNotification({
          type: 'error',
          message,
          duration: 5000,
        });
        return false;
      }

      // Создаём новые треки без ID для добавления в target store
      const tracksToAdd: Omit<Track, 'id'>[] = tracksToMove.map((track) => ({
        path: track.path,
        name: track.name,
        duration: track.duration,
      }));

      // Транзакция: сохраняем состояние для возможного rollback
      const targetStateBefore = targetStore.getState();
      const targetTracksBefore = [...targetStateBefore.tracks];

      try {
        // Добавляем треки в target store
        if (typeof targetIndex === 'number') {
          targetStore.getState().addTracksAt(tracksToAdd, targetIndex);
        } else {
          targetStore.getState().addTracks(tracksToAdd);
        }

        // Удаляем треки из source store
        // Получаем состояние один раз и удаляем все треки за один проход
        const sourceStateAfterAdd = sourceStore.getState();
        const tracksToRemove = sourceStateAfterAdd.tracks.filter((track) =>
          trackIds.includes(track.id),
        );

        if (tracksToRemove.length === 0) {
          // Треки уже удалены или не найдены - откатываем изменения в target
          logger.warn('moveTracksBetweenWorkspaces: tracks not found in source, rolling back');
          targetStore.getState()._setTracks(targetTracksBefore);
          return false;
        }

        // Удаляем все треки, получая removeTrack один раз для эффективности
        const { removeTrack } = sourceStore.getState();
        tracksToRemove.forEach((track) => {
          removeTrack(track.id);
        });

        return true;
      } catch (error) {
        // В случае ошибки - откатываем изменения в target store
        logger.error('moveTracksBetweenWorkspaces: error during transaction, rolling back', error);
        try {
          targetStore.getState()._setTracks(targetTracksBefore);
        } catch (rollbackError) {
          logger.error('moveTracksBetweenWorkspaces: rollback failed', rollbackError);
        }
        useUIStore.getState().addNotification({
          type: 'error',
          message: 'Error moving tracks. Operation was cancelled.',
          duration: 5000,
        });
        return false;
      }
    } catch (error) {
      logger.error('moveTracksBetweenWorkspaces: unexpected error', error);
      useUIStore.getState().addNotification({
        type: 'error',
        message: 'Failed to move tracks',
        duration: 5000,
      });
      return false;
    }
  },

  copyTracksBetweenWorkspaces: (
    trackIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetIndex?: number,
  ): boolean => {
    try {
      // Валидация входных данных
      if (!trackIds || trackIds.length === 0) {
        logger.warn('copyTracksBetweenWorkspaces: empty trackIds array');
        return false;
      }

      // Получаем stores
      const sourceStore = getTrackWorkspaceStore(sourceWorkspaceId);
      const targetStore = getTrackWorkspaceStore(targetWorkspaceId);

      if (!sourceStore || !targetStore) {
        logger.error('copyTracksBetweenWorkspaces: stores not found', {
          sourceWorkspaceId,
          targetWorkspaceId,
          registeredStores: getAllTrackWorkspaceStores(),
        });
        useUIStore.getState().addNotification({
          type: 'error',
          message: `Cannot copy tracks: workspace not found`,
          duration: 5000,
        });
        return false;
      }

      // Получаем треки из source store
      const sourceState = sourceStore.getState();
      const tracksToCopy = sourceState.tracks.filter((track) => trackIds.includes(track.id));

      if (tracksToCopy.length === 0) {
        logger.warn('copyTracksBetweenWorkspaces: no tracks found to copy');
        return false;
      }

      // Проверяем лимиты target store
      const targetState = targetStore.getState();
      const { canAdd, availableSlots } = canAddTracks(targetState, tracksToCopy.length);

      if (!canAdd) {
        const message =
          availableSlots > 0
            ? `Cannot copy ${tracksToCopy.length} tracks: only ${availableSlots} slots available`
            : `Cannot copy tracks: target workspace is full`;
        logger.warn('copyTracksBetweenWorkspaces: target workspace limit exceeded', {
          requested: tracksToCopy.length,
          available: availableSlots,
        });
        useUIStore.getState().addNotification({
          type: 'error',
          message,
          duration: 5000,
        });
        return false;
      }

      // Создаём новые треки без ID для добавления в target store
      const tracksToAdd: Omit<Track, 'id'>[] = tracksToCopy.map((track) => ({
        path: track.path,
        name: track.name,
        duration: track.duration,
      }));

      // Добавляем треки в target store (без удаления из source)
      if (typeof targetIndex === 'number') {
        targetStore.getState().addTracksAt(tracksToAdd, targetIndex);
      } else {
        targetStore.getState().addTracks(tracksToAdd);
      }

      return true;
    } catch (error) {
      logger.error('copyTracksBetweenWorkspaces: unexpected error', error);
      useUIStore.getState().addNotification({
        type: 'error',
        message: 'Failed to copy tracks',
        duration: 5000,
      });
      return false;
    }
  },
}));
