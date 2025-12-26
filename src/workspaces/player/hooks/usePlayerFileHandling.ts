import { useCallback } from 'react';

import { Track } from '@core/types/track';
import { fileService, ipcService } from '@shared/services';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';
import { logger } from '@shared/utils';
import { createTrackWithId, extractName } from '@shared/utils/trackFactory';

import { useTrackDuration } from '@shared/hooks';

const DEFAULT_GROUP_INSERT_INDEX = 0;

interface UsePlayerFileHandlingParams {
  allTracks: Track[];
  updateTrackDuration: (trackId: string, duration: number) => void;
}

export function usePlayerFileHandling({
  allTracks,
  updateTrackDuration,
}: UsePlayerFileHandlingParams) {
  const { addItem } = usePlayerItemsStore((state) => ({
    addItem: state.addItem,
  }));

  const resolveTrackByPath = useCallback(
    (path: string) => allTracks.find((track) => track.path === path),
    [allTracks],
  );

  const { loadDurationsForTracks } = useTrackDuration({
    tracks: allTracks,
    isAudioFile: fileService.isValidAudioFile.bind(fileService),
    requestDuration: ipcService.getAudioDuration.bind(ipcService),
    resolveTrackByPath,
    onDurationResolved: updateTrackDuration,
  });

  const handleAddTracks = useCallback(
    (newTracks: Omit<Track, 'id'>[]) => {
      const tracksWithIds = newTracks.map(createTrackWithId);
      tracksWithIds.forEach((track) => addItem(track));
      const paths = tracksWithIds.map((track) => track.path);
      loadDurationsForTracks(paths);
    },
    [addItem, loadDurationsForTracks],
  );

  const handleAddTracksAt = useCallback(
    (newTracks: Omit<Track, 'id'>[], index: number) => {
      const tracksWithIds = newTracks.map(createTrackWithId);
      tracksWithIds.forEach((track) => addItem(track, index));
      const paths = tracksWithIds.map((track) => track.path);
      loadDurationsForTracks(paths);
    },
    [addItem, loadDurationsForTracks],
  );

  const processFilesToGroup = useCallback(
    async (files: string[], targetGroupId: string) => {
      const validFiles = files.filter((path) => fileService.isValidAudioFile(path));
      if (validFiles.length === 0) return;

      const tracks = validFiles.map((path) => ({
        path,
        name: extractName(path),
      }));

      const { addItemToGroup } = usePlayerItemsStore.getState();
      tracks.forEach((track) => {
        const trackWithId = createTrackWithId(track);
        addItem(trackWithId);
        addItemToGroup(targetGroupId, trackWithId.id, DEFAULT_GROUP_INSERT_INDEX);
        loadDurationsForTracks([trackWithId.path]);
      });
    },
    [addItem, loadDurationsForTracks],
  );

  const processDirectoriesToGroup = useCallback(
    async (directories: string[], targetGroupId: string) => {
      if (directories.length === 0 || !ipcService.findAudioFilesRecursive) return;

      const { addItemToGroup } = usePlayerItemsStore.getState();
      for (const dir of directories) {
        try {
          const paths = await ipcService.findAudioFilesRecursive(dir);
          const validPaths = paths.filter((path) => fileService.isValidAudioFile(path));
          if (validPaths.length > 0) {
            const tracks = validPaths.map((path) => ({
              path,
              name: extractName(path),
            }));
            tracks.forEach((track) => {
              const trackWithId = createTrackWithId(track);
              addItem(trackWithId);
              addItemToGroup(targetGroupId, trackWithId.id, DEFAULT_GROUP_INSERT_INDEX);
              loadDurationsForTracks([trackWithId.path]);
            });
          }
        } catch (error) {
          logger.error('Failed to load folder tracks', error);
        }
      }
    },
    [addItem, loadDurationsForTracks],
  );

  const processFilesToPosition = useCallback(
    (files: string[], insertIndex: number) => {
      const validFiles = files.filter((path) => fileService.isValidAudioFile(path));
      if (validFiles.length === 0) return;

      const tracks = validFiles.map((path) => ({
        path,
        name: extractName(path),
      }));

      const tracksWithIds = tracks.map(createTrackWithId);
      tracksWithIds.forEach((track) => addItem(track, insertIndex));
      const paths = tracksWithIds.map((track) => track.path);
      loadDurationsForTracks(paths);
    },
    [addItem, loadDurationsForTracks],
  );

  const processDirectoriesToPosition = useCallback(
    async (directories: string[], insertIndex: number) => {
      if (directories.length === 0 || !ipcService.findAudioFilesRecursive) return;

      for (const dir of directories) {
        try {
          const paths = await ipcService.findAudioFilesRecursive(dir);
          const validPaths = paths.filter((path) => fileService.isValidAudioFile(path));
          if (validPaths.length > 0) {
            const tracks = validPaths.map((path) => ({
              path,
              name: extractName(path),
            }));
            const tracksWithIds = tracks.map(createTrackWithId);
            tracksWithIds.forEach((track) => addItem(track, insertIndex));
            const paths = tracksWithIds.map((track) => track.path);
            loadDurationsForTracks(paths);
          }
        } catch (error) {
          logger.error('Failed to load folder tracks', error);
        }
      }
    },
    [addItem, loadDurationsForTracks],
  );

  const processFilesToGroupAtPosition = useCallback(
    async (files: string[], targetGroupId: string, insertIndex: number) => {
      const validFiles = files.filter((path) => fileService.isValidAudioFile(path));
      if (validFiles.length === 0) return;

      const tracks = validFiles.map((path) => ({
        path,
        name: extractName(path),
      }));

      const { addItemToGroup } = usePlayerItemsStore.getState();
      tracks.forEach((track, idx) => {
        const trackWithId = createTrackWithId(track);
        addItem(trackWithId);
        addItemToGroup(targetGroupId, trackWithId.id, insertIndex + idx);
        loadDurationsForTracks([trackWithId.path]);
      });
    },
    [addItem, loadDurationsForTracks],
  );

  const processDirectoriesToGroupAtPosition = useCallback(
    async (directories: string[], targetGroupId: string, insertIndex: number) => {
      if (directories.length === 0 || !ipcService.findAudioFilesRecursive) return;

      const { addItemToGroup } = usePlayerItemsStore.getState();
      for (const dir of directories) {
        try {
          const paths = await ipcService.findAudioFilesRecursive(dir);
          const validPaths = paths.filter((path) => fileService.isValidAudioFile(path));
          if (validPaths.length > 0) {
            const tracks = validPaths.map((path) => ({
              path,
              name: extractName(path),
            }));
            tracks.forEach((track, idx) => {
              const trackWithId = createTrackWithId(track);
              addItem(trackWithId);
              addItemToGroup(targetGroupId, trackWithId.id, insertIndex + idx);
              loadDurationsForTracks([trackWithId.path]);
            });
          }
        } catch (error) {
          logger.error('Failed to load folder tracks', error);
        }
      }
    },
    [addItem, loadDurationsForTracks],
  );

  return {
    handleAddTracks,
    handleAddTracksAt,
    loadDurationsForTracks,
    processFilesToGroup,
    processDirectoriesToGroup,
    processFilesToPosition,
    processDirectoriesToPosition,
    processFilesToGroupAtPosition,
    processDirectoriesToGroupAtPosition,
  };
}

