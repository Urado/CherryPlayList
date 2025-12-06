// Идентификация workspace
export type WorkspaceId = string; // UUID

// Типы workspace
export type WorkspaceType =
  | 'playlist'
  | 'collection'
  | 'drafts'
  | 'fileBrowser'
  | 'database'
  | 'rules'
  | 'autogenerator'
  | 'player'
  | string; // для будущих типов

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
