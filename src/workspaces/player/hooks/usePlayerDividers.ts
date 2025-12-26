import { useCallback, useMemo } from 'react';

import { Track } from '@core/types/track';
import { isPlayerGroup } from '@core/types/player';
import { useSettingsStore } from '@shared/stores';
import { usePlayerSessionStore } from '@shared/stores/playerSessionStore';
import { usePlayerSettingsStore } from '@shared/stores/playerSettingsStore';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';

import {
  calculateDividerMarkers as calculateDividerMarkersUtil,
  formatDividerLabel as formatDividerLabelUtil,
  calculatePlannedEndDividerPosition,
  calculateProjectedEndTime,
  calculatePlannedEndMarker,
  formatTimeFromTimestamp,
  type DividerCalculationContext,
} from '../dividerUtils';
import { usePlayerSettings } from './usePlayerSettings';

interface UsePlayerDividersParams {
  allTracks: Track[];
  displayItems: Array<{ item: { id: string } }>;
  isPlayerTrack: (item: { id: string }) => boolean;
}

export function usePlayerDividers({
  allTracks,
  displayItems,
  isPlayerTrack,
}: UsePlayerDividersParams) {
  const mode = usePlayerSessionStore((state) => state.mode);
  const { hourDividerInterval, showHourDividers } = useSettingsStore();
  const { plannedEndTime } = usePlayerSettingsStore();
  const { currentTrack: activePlayerTrack, position: currentTrackPosition } =
    usePlayerAudioStore();
  const activePlayerTrackId = activePlayerTrack?.id;

  const { isTrackDisabled, isTrackPlayed, isGroupDisabled } = usePlayerSessionStore();
  const { getItemPath, findItemById } = usePlayerItemsStore((state) => ({
    getItemPath: state.getItemPath,
    findItemById: state.findItemById,
  }));

  // Подписка на состояния для корректного пересчёта зависимостей
  // Используем отсортированную строку ID вместо самого Set для надёжного отслеживания изменений
  // Это необходимо, так как функции isTrackDisabled/isGroupDisabled/isTrackPlayed
  // не меняют свою ссылку при изменении состояния в store
  const disabledTracksKey = usePlayerSessionStore((state) =>
    Array.from(state.disabledTrackIds).sort().join(','),
  );
  const disabledGroupsKey = usePlayerSessionStore((state) =>
    Array.from(state.disabledGroupIds).sort().join(','),
  );
  const playedTracksKey = usePlayerSessionStore((state) =>
    Array.from(state.playedTrackIds).sort().join(','),
  );

  const { calculateTrackDurationWithPause } = usePlayerSettings();

  const isTrackOrGroupDisabled = useCallback(
    (itemId: string): boolean => {
      if (isTrackDisabled(itemId)) {
        return true;
      }

      const path = getItemPath(itemId);
      if (path.length > 1) {
        for (let i = path.length - 2; i >= 0; i--) {
          const groupId = path[i];
          const item = findItemById(groupId);
          if (item && isPlayerGroup(item) && isGroupDisabled(groupId)) {
            return true;
          }
        }
      }

      return false;
    },
    // Примечание: disabledTracksKey и disabledGroupsKey необходимы для пересчёта функции
    // при изменении состояния disabled tracks/groups, так как функции isTrackDisabled/isGroupDisabled
    // не меняют свою ссылку при изменении store
    [isTrackDisabled, isGroupDisabled, getItemPath, findItemById, disabledTracksKey, disabledGroupsKey],
  );

  const dividerCalculationContext: DividerCalculationContext = useMemo(
    () => ({
      tracks: allTracks,
      activeTrackId: activePlayerTrackId ?? null,
      currentTrackPosition,
      mode,
      hourDividerInterval,
      isTrackDisabled: isTrackOrGroupDisabled,
      isTrackPlayed,
      calculateTrackDurationWithPause: (track: Track) =>
        calculateTrackDurationWithPause(track, true),
    }),
    [
      allTracks,
      activePlayerTrackId,
      currentTrackPosition,
      mode,
      hourDividerInterval,
      isTrackOrGroupDisabled,
      isTrackPlayed,
      calculateTrackDurationWithPause,
      // Примечание: ключи необходимы для пересчёта при изменении состояния
      disabledTracksKey,
      disabledGroupsKey,
      playedTracksKey,
    ],
  );

  const dividerMarkersResult = useMemo(() => {
    if (!showHourDividers || hourDividerInterval <= 0 || allTracks.length === 0) {
      return {
        markers: new Map<string, number | null>(),
        startPosition: {
          startFromIndex: 0,
          currentTimeOffset: 0,
          currentRealTime: null,
        },
        nextEvenTime: null,
        plannedEndMarker: null,
      };
    }
    return calculateDividerMarkersUtil({
      ...dividerCalculationContext,
      showHourDividers,
      plannedEndTime: mode === 'session' ? plannedEndTime : null,
    });
  }, [
    dividerCalculationContext,
    showHourDividers,
    hourDividerInterval,
    allTracks.length,
    mode,
    plannedEndTime,
  ]);

  const calculateDividerMarkers = dividerMarkersResult.markers;

  const formatDividerLabel = useCallback(
    (trackId: string): string => {
      return formatDividerLabelUtil(trackId, dividerCalculationContext, dividerMarkersResult);
    },
    [dividerCalculationContext, dividerMarkersResult],
  );

  const projectedEndTime = useMemo(() => {
    return calculateProjectedEndTime(dividerCalculationContext);
  }, [dividerCalculationContext]);

  const formatProjectedEndTime = useCallback((): string => {
    if (projectedEndTime === null) {
      return '';
    }
    return formatTimeFromTimestamp(projectedEndTime);
  }, [projectedEndTime]);

  const formatPlannedEndTimeLabel = useCallback((): string => {
    if (plannedEndTime === null) {
      return '';
    }
    return formatTimeFromTimestamp(plannedEndTime);
  }, [plannedEndTime]);

  const plannedEndMarker = useMemo(() => {
    const isPreparationMode = mode === 'preparation';
    if (!isPreparationMode && allTracks.length > 0 && plannedEndTime !== null) {
      return calculatePlannedEndMarker(dividerCalculationContext, plannedEndTime);
    }
    return null;
  }, [mode, allTracks.length, plannedEndTime, dividerCalculationContext]);

  const formatPlannedEndMarkerTime = useCallback((): string => {
    const markerTime = plannedEndMarker?.time;
    if (markerTime !== null && markerTime !== undefined && markerTime > 0) {
      return formatTimeFromTimestamp(markerTime);
    }
    return formatPlannedEndTimeLabel();
  }, [plannedEndMarker, formatPlannedEndTimeLabel]);

  const plannedEndDividerPosition = useMemo(() => {
    const isPreparationMode = mode === 'preparation';
    if (!isPreparationMode && allTracks.length > 0 && plannedEndMarker !== null) {
      const tempMarkers = {
        markers: new Map<string, number | null>(),
        startPosition: dividerMarkersResult.startPosition,
        nextEvenTime: null,
        plannedEndMarker,
      };
      return calculatePlannedEndDividerPosition(tempMarkers, displayItems, isPlayerTrack);
    }
    return null;
  }, [
    mode,
    allTracks.length,
    plannedEndMarker,
    displayItems,
    isPlayerTrack,
    dividerMarkersResult.startPosition,
  ]);

  return {
    calculateDividerMarkers,
    formatDividerLabel,
    projectedEndTime,
    formatProjectedEndTime,
    formatPlannedEndTimeLabel,
    formatPlannedEndMarkerTime,
    plannedEndDividerPosition,
    showHourDividers,
  };
}

