import * as fs from 'fs/promises';
import * as path from 'path';

import { ipcMain } from 'electron';

import { validatePath } from '../utils/fsHelpers.js';

export interface PlaylistData {
  name: string;
  tracks: Array<{
    path: string;
    name: string;
    duration?: number;
  }>;
}

/**
 * Save playlist to JSON file
 */
async function savePlaylist(filePath: string, playlist: PlaylistData): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Convert tracks to serializable format (remove id)
    const serializablePlaylist = {
      name: playlist.name,
      tracks: playlist.tracks.map((track) => ({
        path: track.path,
        name: track.name,
        duration: track.duration,
      })),
    };

    // Write JSON file
    await fs.writeFile(filePath, JSON.stringify(serializablePlaylist, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save playlist: ${(error as Error).message}`);
  }
}

/**
 * Load playlist from JSON file
 */
async function loadPlaylist(filePath: string): Promise<PlaylistData> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const playlist = JSON.parse(content) as PlaylistData;

    // Validate structure
    if (!playlist.name || !Array.isArray(playlist.tracks)) {
      throw new Error('Invalid playlist format');
    }

    return playlist;
  } catch (error) {
    throw new Error(`Failed to load playlist: ${(error as Error).message}`);
  }
}

/**
 * Register playlist IPC handlers
 */
export function registerPlaylistHandlers(): void {
  ipcMain.handle(
    'playlist:save',
    async (
      event,
      payload: {
        path: string;
        playlist: PlaylistData;
      },
    ) => {
      try {
        // Validate path to prevent path traversal attacks
        if (!validatePath(payload.path)) {
          return {
            success: false,
            error: 'Invalid path: path traversal detected',
          };
        }

        await savePlaylist(payload.path, payload.playlist);
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  ipcMain.handle('playlist:load', async (event, payload: { path: string }) => {
    try {
      // Validate path to prevent path traversal attacks
      if (!validatePath(payload.path)) {
        return {
          success: false,
          error: 'Invalid path: path traversal detected',
        };
      }

      const playlist = await loadPlaylist(payload.path);
      return {
        success: true,
        data: playlist,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
