import { useCallback } from 'react';

import { ActionAfterTrack, usePlayerSettingsStore } from '@shared/stores/playerSettingsStore';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';
import { isPlayerGroup } from '@core/types/player';

export function usePlayerSettings() {
  const {
    getTrackSettings,
    getGroupSettings,
    setEditingTrack,
    setEditingGroup,
    setEditingGlobal,
    defaultActionAfterTrack,
    defaultPauseBetweenTracks,
  } = usePlayerSettingsStore();

  const { getItemPath, findItemById } = usePlayerItemsStore((state) => ({
    getItemPath: state.getItemPath,
    findItemById: state.findItemById,
  }));

  const getEffectiveTrackSettings = useCallback(
    (trackId: string) => {
      const trackSettings = getTrackSettings(trackId);

      let effectiveActionAfterTrack: ActionAfterTrack = defaultActionAfterTrack;
      let effectivePauseBetweenTracks: number = defaultPauseBetweenTracks;

      // 1. Проверяем настройки трека
      if (trackSettings.actionAfterTrack !== null && trackSettings.actionAfterTrack !== undefined) {
        effectiveActionAfterTrack = trackSettings.actionAfterTrack;
        effectivePauseBetweenTracks =
          trackSettings.pauseBetweenTracks !== null &&
          trackSettings.pauseBetweenTracks !== undefined
            ? trackSettings.pauseBetweenTracks
            : defaultPauseBetweenTracks;
      } else {
        // 2. Ищем настройки в группах (от ближайшей к дальней)
        const path = getItemPath(trackId);
        let foundInGroup = false;

        for (let i = path.length - 1; i >= 0; i--) {
          const itemId = path[i];
          const item = findItemById(itemId);
          if (item && isPlayerGroup(item)) {
            const groupSettings = getGroupSettings(itemId);
            if (
              groupSettings.actionAfterTrack !== null &&
              groupSettings.actionAfterTrack !== undefined
            ) {
              effectiveActionAfterTrack = groupSettings.actionAfterTrack;
              effectivePauseBetweenTracks =
                groupSettings.pauseBetweenTracks !== null &&
                groupSettings.pauseBetweenTracks !== undefined
                  ? groupSettings.pauseBetweenTracks
                  : defaultPauseBetweenTracks;
              foundInGroup = true;
              break;
            }
          }
        }

        // 3. Если не нашли в группах, используем глобальные настройки
        if (!foundInGroup) {
          effectiveActionAfterTrack = defaultActionAfterTrack;
          effectivePauseBetweenTracks =
            trackSettings.pauseBetweenTracks !== null &&
            trackSettings.pauseBetweenTracks !== undefined
              ? trackSettings.pauseBetweenTracks
              : defaultPauseBetweenTracks;
        }
      }

      return {
        actionAfterTrack: effectiveActionAfterTrack,
        pauseBetweenTracks: effectivePauseBetweenTracks,
      };
    },
    [
      getTrackSettings,
      getGroupSettings,
      getItemPath,
      findItemById,
      defaultActionAfterTrack,
      defaultPauseBetweenTracks,
    ],
  );

  const calculateTrackDurationWithPause = useCallback(
    (track: { id: string; duration?: number }, includePause: boolean = true): number => {
      let duration = track.duration || 0;
      if (includePause) {
        const settings = getEffectiveTrackSettings(track.id);
        if (settings.actionAfterTrack === 'pauseAndNext') {
          duration += settings.pauseBetweenTracks || 0;
        }
      }
      return duration;
    },
    [getEffectiveTrackSettings],
  );

  return {
    getEffectiveTrackSettings,
    calculateTrackDurationWithPause,
    getTrackSettings,
    getGroupSettings,
    setEditingTrack,
    setEditingGroup,
    setEditingGlobal,
  };
}

