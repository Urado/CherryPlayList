import React from 'react';

import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { ExportModal } from './components/ExportModal';
import { NotificationContainer } from './components/NotificationContainer';
import { SettingsModal } from './components/SettingsModal';
import { SplitContainer } from './components/SplitContainer';
import { useTrackItemSize } from './hooks/useTrackItemSize';
import { useLayoutStore } from './state/layoutStore';

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
      <NotificationContainer />
      <AppFooter />
    </div>
  );
};

export default App;
