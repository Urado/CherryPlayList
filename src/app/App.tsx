import React from 'react';

import { NotificationContainer } from '@shared/components';
import { useTrackItemSize } from '@shared/hooks';
import { useLayoutStore } from '@shared/stores';

import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { SplitContainer } from './components/SplitContainer';
import { TrackSettingsModal } from '@workspaces/player/TrackSettingsModal';

const App: React.FC = () => {
  const { layout } = useLayoutStore();

  // Инициализация CSS переменных для размеров строк треков
  useTrackItemSize();

  // Проверка что rootZone - контейнер
  if (layout.rootZone.type !== 'container') {
    return (
      <div className="app">
        <AppHeader />
        <div className="app-content">
          <div className="empty-state">
            <p>Error: Root zone must be a container</p>
          </div>
        </div>
        <SettingsModal />
        <ExportModal />
        <TrackSettingsModal />
        <NotificationContainer />
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader />
      <div className="app-content">
        <SplitContainer zone={layout.rootZone} />
      </div>
      <SettingsModal />
      <ExportModal />
      <TrackSettingsModal />
      <NotificationContainer />
      <AppFooter />
    </div>
  );
};

export default App;
