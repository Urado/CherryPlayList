// Re-export from core for backward compatibility
export type { WorkspaceId, WorkspaceType } from '@core/types/workspace';

export type DraggedItems =
  | { type: 'tracks'; ids: Set<string>; sourceWorkspaceId?: WorkspaceId; isCopyMode?: boolean }
  | { type: 'files'; paths: string[] }
  | null;

export type DropModule = 'playlistItem' | 'playlistContainer';

export interface DropContext {
  module: DropModule;
  targetId?: string;
  workspaceId?: WorkspaceId; // Идентификатор целевого workspace (опционально для обратной совместимости)
  zoneId?: string; // Идентификатор зоны для drop
}
