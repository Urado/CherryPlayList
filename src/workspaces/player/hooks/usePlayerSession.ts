import { useCallback, useEffect, useRef } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { Track } from '@core/types/track';
import { useDemoPlayerStore } from '@shared/stores';
import { usePlayerAudioStore } from '@shared/stores/playerAudioStore';
import { usePlayerSessionStore } from '@shared/stores/playerSessionStore';
import { logger } from '@shared/utils';

import { usePlayerSettings } from './usePlayerSettings';

interface UsePlayerSessionParams {
  allTracks: Track[];
  isTrackActive: (trackId: string) => boolean;
  isTrackOrGroupDisabled: (itemId: string) => boolean;
  isTrackPlayed: (trackId: string) => boolean;
}

export function usePlayerSession({
  allTracks,
  isTrackActive,
  isTrackOrGroupDisabled,
  isTrackPlayed,
}: UsePlayerSessionParams) {
  const mode = usePlayerSessionStore((state) => state.mode);
  const startSession = usePlayerSessionStore((state) => state.startSession);
  const resetSession = usePlayerSessionStore((state) => state.resetSession);
  const {
    markTrackAsPlayed,
    setCurrentTrack,
    toggleTrackDisabled,
    toggleGroupDisabled,
  } = usePlayerSessionStore();

  const isPreparationMode = mode === 'preparation';

  const {
    currentTrack: activeDemoTrack,
    status: demoPlayerStatus,
    loadTrack: loadDemoTrack,
    play: playDemo,
    pause: pauseDemo,
  } = useDemoPlayerStore();
  const activeDemoTrackId = activeDemoTrack?.id;

  const {
    currentTrack: activePlayerTrack,
    status: playerAudioStatus,
    loadTrack: loadPlayerTrack,
    play: playPlayer,
    pause: pausePlayer,
    stop,
    setOnTrackEnded,
    setPauseTimer,
    clearPauseTimer,
  } = usePlayerAudioStore();
  const activePlayerTrackId = activePlayerTrack?.id;

  const isProcessingTrackEndRef = useRef(false);

  const activeTrackId = isPreparationMode ? activeDemoTrackId : activePlayerTrackId;
  const playerStatus = isPreparationMode ? demoPlayerStatus : playerAudioStatus;

  const { getEffectiveTrackSettings } = usePlayerSettings();

  const getNextActiveTrack = useCallback(() => {
    const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
    if (currentIndex === -1) {
      for (let i = 0; i < allTracks.length; i++) {
        const track = allTracks[i];
        if (isTrackActive(track.id)) {
          return track;
        }
      }
      return null;
    }

    for (let i = currentIndex + 1; i < allTracks.length; i++) {
      const track = allTracks[i];
      if (isTrackActive(track.id)) {
        return track;
      }
    }

    return null;
  }, [allTracks, activePlayerTrackId, isTrackActive]);

  const markSkippedDisabledTracks = useCallback(
    (fromIndex: number, toIndex: number) => {
      for (let i = fromIndex + 1; i < toIndex; i++) {
        const track = allTracks[i];
        if (track && isTrackOrGroupDisabled(track.id) && !isTrackPlayed(track.id)) {
          markTrackAsPlayed(track.id);
        }
      }
    },
    [allTracks, isTrackOrGroupDisabled, isTrackPlayed, markTrackAsPlayed],
  );

  const startTrackPlayback = useCallback(
    async (track: Track) => {
      try {
        if (isPreparationMode) {
          const isSameTrack = activeDemoTrackId === track.id;
          if (!isSameTrack || demoPlayerStatus === 'ended') {
            await loadDemoTrack(track, DEFAULT_PLAYER_WORKSPACE_ID);
          }
          await playDemo();
        } else {
          const isSameTrack = activePlayerTrackId === track.id;
          if (!isSameTrack || playerAudioStatus === 'ended') {
            await loadPlayerTrack(track);
          }
          await playPlayer();
        }
      } catch (error) {
        logger.error('Failed to start track playback', error);
      }
    },
    [
      isPreparationMode,
      activeDemoTrackId,
      activePlayerTrackId,
      demoPlayerStatus,
      playerAudioStatus,
      loadDemoTrack,
      loadPlayerTrack,
      playDemo,
      playPlayer,
    ],
  );

  const pausePlayback = useCallback(() => {
    if (isPreparationMode) {
      pauseDemo();
    } else {
      pausePlayer();
    }
  }, [isPreparationMode, pauseDemo, pausePlayer]);

  const handleStartSession = useCallback(async () => {
    if (allTracks.length === 0) {
      return;
    }

    const hasActiveTracks = allTracks.some((track) => isTrackActive(track.id));
    if (!hasActiveTracks) {
      return;
    }

    startSession();

    const firstActiveTrack = allTracks.find((track) => isTrackActive(track.id));

    if (firstActiveTrack) {
      try {
        await loadPlayerTrack(firstActiveTrack);
        setCurrentTrack(firstActiveTrack.id);
        await playPlayer();
      } catch (error) {
        logger.error('Failed to start first track playback', error);
      }
    }
  }, [startSession, allTracks, isTrackActive, loadPlayerTrack, setCurrentTrack, playPlayer]);

  const handleResetSession = useCallback(() => {
    clearPauseTimer();
    resetSession();
    pausePlayer();
    isProcessingTrackEndRef.current = false;
  }, [resetSession, pausePlayer, clearPauseTimer]);

  const handleTrackEnded = useCallback(async () => {
    if (!activePlayerTrackId || isPreparationMode) {
      return;
    }

    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentTrack = allTracks.find((t) => t.id === activePlayerTrackId);
      if (!currentTrack) {
        return;
      }

      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);

      markTrackAsPlayed(activePlayerTrackId);

      const settings = getEffectiveTrackSettings(activePlayerTrackId);

      if (settings.actionAfterTrack === 'pause') {
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      } else if (settings.actionAfterTrack === 'pauseAndNext') {
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          setPauseTimer(async () => {
            const currentStatus = usePlayerAudioStore.getState().status;
            const currentTrackId = usePlayerAudioStore.getState().currentTrack?.id;
            if (currentStatus === 'paused' && currentTrackId === nextTrack.id) {
              await playPlayer();
            }
          }, settings.pauseBetweenTracks * 1000);
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      } else {
        const nextTrack = getNextActiveTrack();
        if (nextTrack) {
          const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
          markSkippedDisabledTracks(currentIndex, nextIndex);
          await loadPlayerTrack(nextTrack);
          setCurrentTrack(nextTrack.id);
          await playPlayer();
        } else {
          markSkippedDisabledTracks(currentIndex, allTracks.length);
          setCurrentTrack(null);
        }
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    activePlayerTrackId,
    isPreparationMode,
    allTracks,
    markTrackAsPlayed,
    getEffectiveTrackSettings,
    getNextActiveTrack,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    markSkippedDisabledTracks,
    setPauseTimer,
  ]);

  const handleNext = useCallback(async () => {
    if (isPreparationMode || !activePlayerTrackId) {
      return;
    }

    clearPauseTimer();

    if (isProcessingTrackEndRef.current) {
      return;
    }

    isProcessingTrackEndRef.current = true;

    try {
      const currentIndex = allTracks.findIndex((t) => t.id === activePlayerTrackId);
      markTrackAsPlayed(activePlayerTrackId);
      const nextTrack = getNextActiveTrack();
      if (nextTrack) {
        const nextIndex = allTracks.findIndex((t) => t.id === nextTrack.id);
        markSkippedDisabledTracks(currentIndex, nextIndex);
        await loadPlayerTrack(nextTrack);
        setCurrentTrack(nextTrack.id);
        await playPlayer();
      } else {
        markSkippedDisabledTracks(currentIndex, allTracks.length);
        stop();
        setCurrentTrack(null);
      }
    } finally {
      isProcessingTrackEndRef.current = false;
    }
  }, [
    isPreparationMode,
    activePlayerTrackId,
    allTracks,
    markTrackAsPlayed,
    getNextActiveTrack,
    markSkippedDisabledTracks,
    loadPlayerTrack,
    setCurrentTrack,
    playPlayer,
    stop,
    clearPauseTimer,
  ]);

  useEffect(() => {
    if (!isPreparationMode) {
      setOnTrackEnded(handleTrackEnded);
    } else {
      setOnTrackEnded(undefined);
    }
    return () => {
      setOnTrackEnded(undefined);
    };
  }, [isPreparationMode, handleTrackEnded, setOnTrackEnded]);

  return {
    mode,
    isPreparationMode,
    activeTrackId,
    playerStatus,
    activePlayerTrackId,
    startTrackPlayback,
    pausePlayback,
    handleStartSession,
    handleResetSession,
    handleNext,
    toggleTrackDisabled,
    toggleGroupDisabled,
  };
}

