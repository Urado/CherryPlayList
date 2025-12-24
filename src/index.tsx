// Import workspace modules to register them
import '@workspaces/playlist';
import '@workspaces/collection';
import '@workspaces/fileBrowser';
import '@workspaces/testZone';
import { App } from '@app';
import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
