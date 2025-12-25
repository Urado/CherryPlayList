import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import UndoIcon from '@mui/icons-material/Undo';
import React, { useEffect, useState } from 'react';

import { DemoPlayer } from '@shared/components';
import { ipcService, playlistService } from '@shared/services';
import {
  useHistoryStore,
  LayoutPreset,
  useLayoutStore,
  usePlaylistStore,
  useSettingsStore,
  useUIStore,
} from '@shared/stores';

export const AppHeader: React.FC = () => {
  const { tracks, undo, redo, clear, loadFromJSON, setName, name } = usePlaylistStore();
  const { openModal, addNotification, focusFileInBrowser } = useUIStore();
  const { setLastOpenedPlaylist } = useSettingsStore();
  const { setLayoutPreset } = useLayoutStore();
  const [selectedLayout, setSelectedLayout] = useState<LayoutPreset>('simple');

  // Get undo/redo state from history store
  const canUndo = useHistoryStore((state) => state.canUndo());
  const canRedo = useHistoryStore((state) => state.canRedo());

  // В production не позволяем использовать complex layout
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    if (!isDev && selectedLayout === 'complex') {
      const timeoutId = setTimeout(() => {
        setSelectedLayout('simple');
        setLayoutPreset('simple');
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedLayout, setLayoutPreset]);

  const handleNew = () => {
    clear();
    setName('New Playlist');
    addNotification({ type: 'info', message: 'Создан новый плейлист' });
  };

  const handleSave = async () => {
    try {
      const path = await ipcService.showSaveDialog({
        title: 'Сохранить плейлист',
        defaultPath: name || 'playlist',
        filters: [{ name: 'JSON файлы', extensions: ['json'] }],
      });

      if (path) {
        await playlistService.savePlaylist(path, { name, tracks });
        setLastOpenedPlaylist(path);
        addNotification({ type: 'success', message: 'Плейлист сохранён' });
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка сохранения: ${(error as Error).message}` });
    }
  };

  const handleLoad = async () => {
    try {
      const path = await ipcService.showOpenFileDialog({
        title: 'Загрузить плейлист',
        filters: [{ name: 'JSON файлы', extensions: ['json'] }],
      });

      if (path) {
        const playlist = await playlistService.loadPlaylist(path);
        loadFromJSON(playlist);
        setLastOpenedPlaylist(path);
        addNotification({ type: 'success', message: 'Плейлист загружен' });
      }
    } catch (error) {
      addNotification({ type: 'error', message: `Ошибка загрузки: ${(error as Error).message}` });
    }
  };

  const handleExport = () => {
    if (tracks.length === 0) {
      addNotification({ type: 'warning', message: 'Плейлист пуст' });
      return;
    }

    openModal('export');
  };

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  const handleSettings = () => {
    openModal('settings');
  };

  const handleLayoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value as LayoutPreset;
    const isDev = import.meta.env.DEV;

    // В production не позволяем выбирать complex
    if (preset === 'complex' && !isDev) {
      return;
    }

    if (
      preset === 'simple' ||
      preset === 'complex' ||
      preset === 'collections' ||
      preset === 'collections-vertical' ||
      preset === 'player'
    ) {
      setSelectedLayout(preset);
      setLayoutPreset(preset);
      const presetNames: Record<LayoutPreset, string> = {
        simple: 'Простой',
        complex: 'Сложный',
        collections: 'С коллекциями',
        'collections-vertical': 'Коллекции вертикально',
        player: 'Плеер',
      };
      addNotification({
        type: 'info',
        message: `Layout изменён: ${presetNames[preset]}`,
      });
    }
  };

  return (
    <div className="app-header">
      <div className="app-header-toolbar">
        <div className="app-header-left">
          <div className="app-header-actions">
            <div className="action-group">
              <button className="header-button" onClick={handleNew} title="Новый плейлист">
                <AddIcon style={{ fontSize: '32px' }} />
              </button>
              <button className="header-button" onClick={handleSave} title="Сохранить плейлист">
                <SaveIcon style={{ fontSize: '32px' }} />
              </button>
              <button className="header-button" onClick={handleLoad} title="Загрузить плейлист">
                <FolderOpenIcon style={{ fontSize: '32px' }} />
              </button>
            </div>

            <div className="action-group">
              <button
                className="header-button"
                onClick={handleExport}
                title="Экспортировать плейлист"
              >
                <FileDownloadIcon style={{ fontSize: '32px' }} />
              </button>
            </div>

            <div className="action-group">
              <button
                className="header-button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Отменить (Ctrl+Z)"
              >
                <UndoIcon style={{ fontSize: '32px' }} />
              </button>
              <button
                className="header-button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Повторить (Ctrl+Y)"
              >
                <RedoIcon style={{ fontSize: '32px' }} />
              </button>
            </div>

            <div className="action-group">
              <button className="header-button" onClick={handleSettings} title="Настройки">
                <SettingsIcon style={{ fontSize: '32px' }} />
              </button>
            </div>
          </div>

          <div className="app-header-layout">
            <label htmlFor="layout-select" className="app-header-layout__label">
              Layout:
            </label>
            <select
              id="layout-select"
              value={selectedLayout}
              onChange={handleLayoutChange}
              className="layout-select"
            >
              <option value="simple">Простой (Playlist + Browser)</option>
              {import.meta.env.DEV && <option value="complex">Сложный (с тестовыми зонами)</option>}
              <option value="collections">С коллекциями (Playlist + Collections + Browser)</option>
              <option value="collections-vertical">
                Коллекции вертикально (Playlist + Collections + Browser)
              </option>
              <option value="player">Плеер (Player + Browser)</option>
            </select>
          </div>
        </div>

        <DemoPlayer className="app-header-demo-player" onShowInBrowser={focusFileInBrowser} />
      </div>
    </div>
  );
};
