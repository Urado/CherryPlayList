import { createWithEqualityFn } from 'zustand/traditional';

import { WorkspaceId } from '../modules/dragDrop/types';
import { ipcService } from '../services/ipcService';
import { Track } from '../types/track';
import { logger } from '../utils/logger';

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'ended';

interface DemoPlayerState {
  currentTrack: Track | null;
  sourceWorkspaceId: WorkspaceId | null;
  status: PlayerStatus;
  position: number;
  duration: number;
  volume: number;
  error: string | null;

  loadTrack: (track: Track, sourceWorkspaceId: WorkspaceId) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (positionSeconds: number) => void;
  setVolume: (value: number) => void;
  clear: () => void;

  // Internal actions triggered by audio events
  setDuration: (durationSeconds: number) => void;
  setPosition: (positionSeconds: number) => void;
  handleEnded: () => void;
  handleError: (message: string, error?: unknown) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
};

const INITIAL_STATE: Omit<
  DemoPlayerState,
  | 'loadTrack'
  | 'play'
  | 'pause'
  | 'seek'
  | 'setVolume'
  | 'clear'
  | 'setDuration'
  | 'setPosition'
  | 'handleEnded'
  | 'handleError'
> = {
  currentTrack: null,
  sourceWorkspaceId: null,
  status: 'idle',
  position: 0,
  duration: 0,
  volume: 0.8,
  error: null,
};

export const useDemoPlayerStore = createWithEqualityFn<DemoPlayerState>((set, get) => {
  let audioElement: HTMLAudioElement | null = null;
  let currentObjectUrl: string | null = null;

  const revokeCurrentObjectUrl = () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };

  const getAudioElement = (): HTMLAudioElement => {
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      audioElement.volume = 0.8;

      audioElement.addEventListener('ended', () => {
        get().handleEnded();
      });

      audioElement.addEventListener('timeupdate', () => {
        get().setPosition(audioElement?.currentTime ?? 0);
      });

      audioElement.addEventListener('loadedmetadata', () => {
        const duration = audioElement?.duration ?? 0;
        if (Number.isFinite(duration)) {
          get().setDuration(duration);
        }
      });

      audioElement.addEventListener('error', () => {
        const mediaError = audioElement?.error;
        const code = mediaError?.code;
        const errorMessages: Record<number, string> = {
          1: 'Воспроизведение прервано системой',
          2: 'Ошибка сети при воспроизведении',
          3: 'Невозможно декодировать аудио',
          4: 'Файл не найден или формат не поддерживается',
        };
        const message =
          (code && errorMessages[code]) ||
          'Не удалось воспроизвести трек. Проверьте файл и попробуйте снова.';
        get().handleError(message, mediaError ?? undefined);
      });
    }

    return audioElement;
  };

  return {
    ...INITIAL_STATE,

    loadTrack: async (track, sourceWorkspaceId) => {
      try {
        const audio = getAudioElement();
        audio.pause();

        const { buffer, mimeType } = await ipcService.getAudioFileSource(track.path, false);
        const arrayBuffer = base64ToArrayBuffer(buffer);
        const blob = new Blob([arrayBuffer], { type: mimeType });

        revokeCurrentObjectUrl();
        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrl = objectUrl;

        audio.src = objectUrl;
        audio.currentTime = 0;
        audio.volume = get().volume;

        set({
          currentTrack: track,
          sourceWorkspaceId,
          status: 'paused',
          position: 0,
          duration: track.duration ?? 0,
          error: null,
        });
      } catch (error) {
        get().handleError('Не удалось загрузить файл для воспроизведения', error);
        throw error instanceof Error ? error : new Error('Failed to load audio source');
      }
    },

    play: async () => {
      const { currentTrack, handleError } = get();
      if (!currentTrack) {
        return;
      }

      try {
        const audio = getAudioElement();
        await audio.play();
        set({ status: 'playing', error: null });
      } catch (error) {
        handleError('Не удалось воспроизвести трек', error);
        throw error instanceof Error ? error : new Error('Failed to start playback');
      }
    },

    pause: () => {
      if (!audioElement) {
        return;
      }

      audioElement.pause();
      set({ status: 'paused' });
    },

    seek: (positionSeconds) => {
      const { currentTrack, duration } = get();
      if (!currentTrack) {
        return;
      }

      const audio = audioElement ?? getAudioElement();
      const effectiveDuration = duration || audio.duration || 0;
      const clamped = clamp(positionSeconds, 0, effectiveDuration || positionSeconds);
      audio.currentTime = clamped;
      set({ position: clamped });

      if (get().status === 'ended') {
        set({ status: 'paused' });
      }
    },

    setVolume: (value) => {
      const audio = getAudioElement();
      const safeValue = clamp(value, 0, 1);
      audio.volume = safeValue;
      set({ volume: safeValue });
    },

    clear: () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.currentTime = 0;
      }
      revokeCurrentObjectUrl();
      const preservedVolume = get().volume;
      set({ ...INITIAL_STATE, volume: preservedVolume });
    },

    setDuration: (durationSeconds) => {
      if (!Number.isFinite(durationSeconds)) {
        return;
      }
      set({ duration: durationSeconds });
    },

    setPosition: (positionSeconds) => {
      if (!Number.isFinite(positionSeconds)) {
        return;
      }
      set({ position: positionSeconds });
    },

    handleEnded: () => {
      const { duration } = get();
      set({
        status: 'ended',
        position: duration || 0,
      });
    },

    handleError: (message, error) => {
      logger.error('Demo player error', error instanceof Error ? error : undefined);
      set({
        status: 'idle',
        error: message,
      });
    },
  };
});
