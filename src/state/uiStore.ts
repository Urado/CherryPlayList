import { createWithEqualityFn } from 'zustand/traditional';

import { DraggedItems, WorkspaceId, WorkspaceType } from '../modules/dragDrop/types';
import {
  DEFAULT_PLAYLIST_WORKSPACE_ID,
  registerWorkspaceType,
  unregisterWorkspaceType,
} from '../utils/workspaceConstants';

export type ModalType = 'settings' | 'export' | null;

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number; // in milliseconds, default 3000
}

// Базовая структура для workspace (будет расширена в будущем)
export interface WorkspaceInfo {
  id: WorkspaceId;
  type: WorkspaceType;
  name: string;
  zoneId?: string; // связь с зоной в layout
  // В будущем: позиция, размер, состояние и т.д.
}

const DEFAULT_WORKSPACES: WorkspaceInfo[] = [
  {
    id: DEFAULT_PLAYLIST_WORKSPACE_ID,
    type: 'playlist',
    name: 'Main Playlist',
  },
];

DEFAULT_WORKSPACES.forEach((workspace) => {
  registerWorkspaceType(workspace.id, workspace.type);
});

interface UIState {
  activeSource: 'fileBrowser' | 'playlists' | 'db';
  modal: ModalType;
  notifications: Notification[];
  dragging: boolean;
  draggedItems: DraggedItems; // Глобальное состояние для drag-and-drop между компонентами
  fileBrowserFocusRequest: { path: string; timestamp: number } | null;

  // Workspace management (базовая структура для будущего расширения)
  workspaces: WorkspaceInfo[];
  activeWorkspaceId: WorkspaceId | null;

  // Actions
  setActiveSource: (source: 'fileBrowser' | 'playlists' | 'db') => void;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  setDragging: (dragging: boolean) => void;
  setDraggedItems: (items: DraggedItems | ((current: DraggedItems) => DraggedItems)) => void;

  // Workspace actions (базовые методы для будущего расширения)
  addWorkspace: (workspace: WorkspaceInfo) => void;
  removeWorkspace: (id: WorkspaceId) => void;
  setActiveWorkspace: (id: WorkspaceId | null) => void;
  getWorkspace: (id: WorkspaceId) => WorkspaceInfo | undefined;
  getWorkspaceByZoneId: (zoneId: string) => WorkspaceInfo | undefined;
  setWorkspaceZoneId: (workspaceId: WorkspaceId, zoneId: string) => void;

  // File browser helpers
  focusFileInBrowser: (path: string) => void;
  acknowledgeFileBrowserFocus: () => void;
}

export const useUIStore = createWithEqualityFn<UIState>((set, get) => ({
  activeSource: 'fileBrowser',
  modal: null,
  notifications: [],
  dragging: false,
  draggedItems: null,
  fileBrowserFocusRequest: null,

  // Workspace management (инициализация с дефолтным плейлистом)
  workspaces: [...DEFAULT_WORKSPACES],
  activeWorkspaceId: DEFAULT_PLAYLIST_WORKSPACE_ID,

  setActiveSource: (source) => set({ activeSource: source }),

  openModal: (type) => set({ modal: type }),

  closeModal: () => set({ modal: null }),

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration || 3000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, newNotification.duration);
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  setDragging: (dragging) => set({ dragging }),

  setDraggedItems: (items) =>
    set((state) => ({
      draggedItems: typeof items === 'function' ? items(state.draggedItems) : items,
    })),

  // Workspace actions
  addWorkspace: (workspace) => {
    const state = get();
    if (state.workspaces.some((w) => w.id === workspace.id)) {
      return;
    }
    registerWorkspaceType(workspace.id, workspace.type);
    set({
      workspaces: [...state.workspaces, workspace],
    });
  },

  removeWorkspace: (id) => {
    const state = get();
    unregisterWorkspaceType(id);
    set({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
    });
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  getWorkspace: (id) => {
    const state = get();
    return state.workspaces.find((w) => w.id === id);
  },

  getWorkspaceByZoneId: (zoneId) => {
    const state = get();
    return state.workspaces.find((w) => w.zoneId === zoneId);
  },

  setWorkspaceZoneId: (workspaceId, zoneId) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, zoneId } : w)),
    }));
  },

  focusFileInBrowser: (path) => {
    if (!path) {
      return;
    }
    set({
      activeSource: 'fileBrowser',
      fileBrowserFocusRequest: { path, timestamp: Date.now() },
    });
  },

  acknowledgeFileBrowserFocus: () => set({ fileBrowserFocusRequest: null }),
}));
