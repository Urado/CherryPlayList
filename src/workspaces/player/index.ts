import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { IWorkspaceModule } from '@core/interfaces';
import { workspaceRegistry } from '@core/registry';
import { registerWorkspaceType } from '@core/constants/workspace';

// Импортируем usePlayerStore для инициализации store при загрузке модуля
import '@shared/stores/playerStore';
import { PlayerView } from './PlayerView';

// Регистрируем тип workspace
registerWorkspaceType(DEFAULT_PLAYER_WORKSPACE_ID, 'player');

const PlayerModule: IWorkspaceModule = {
  id: DEFAULT_PLAYER_WORKSPACE_ID,
  type: 'player',
  name: 'Player',
  component: PlayerView,
};

// Register the module
workspaceRegistry.register(PlayerModule);

export { PlayerView };
export default PlayerModule;

