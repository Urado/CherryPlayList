import { PlaylistData } from '../../types/playlist';

import { ipcService } from './ipcService';

class PlaylistService {
  /**
   * Save playlist to JSON file
   */
  async savePlaylist(path: string, playlist: PlaylistData): Promise<void> {
    // ipcService.invoke уже обрабатывает ошибки и показывает уведомления
    await ipcService.invoke<void>('playlist:save', { path, playlist });
  }

  /**
   * Load playlist from JSON file
   */
  async loadPlaylist(path: string): Promise<PlaylistData> {
    // ipcService.invoke уже обрабатывает ошибки и показывает уведомления
    return await ipcService.invoke<PlaylistData>('playlist:load', { path });
  }
}

export const playlistService = new PlaylistService();
