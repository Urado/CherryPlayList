# CherryPlayList API Reference

Complete API reference for CherryPlayList development. This document contains all interfaces, methods, and data types used in the application.

---

## Table of Contents

1. [Zustand Stores API](#zustand-stores-api)
2. [IPC Channels](#ipc-channels)
3. [Services API](#services-api)
4. [Type Definitions](#type-definitions)
5. [Component Props](#component-props)

---

## Zustand Stores API

### playlistStore

**Location**: `src/state/playlistStore.ts`

#### State

```typescript
interface PlaylistState {
  name: string;
  tracks: Track[];
  selectedTrackIds: Set<string>; // Set of selected track IDs for batch operations
}
```

#### Actions

```typescript
// Set playlist name
setName(name: string): void

// Add single track
addTrack(track: Omit<Track, 'id'>): void

// Add multiple tracks
addTracks(tracks: Omit<Track, 'id'>[]): void

// Remove track by ID
removeTrack(id: string): void

// Move track from one index to another
moveTrack(fromIndex: number, toIndex: number): void

// Clear entire playlist
clear(): void

// Load playlist from JSON
loadFromJSON(json: { name: string; tracks: Array<{ path: string }> }): void

// Track selection actions
selectTrack(id: string): void
deselectTrack(id: string): void
selectAll(): void
deselectAll(): void
toggleTrackSelection(id: string): void
selectRange(fromId: string, toId: string): void

// Batch operations
removeSelectedTracks(): void
moveSelectedTracks(toIndex: number): void  // Move all selected tracks to specified index, preserving relative order
```

#### Usage Example

```typescript
import { usePlaylistStore } from './state/playlistStore';

const { tracks, name, addTrack, removeTrack } = usePlaylistStore();
```

---

### uiStore

**Location**: `src/state/uiStore.ts`

#### State

```typescript
interface UIState {
  activeSourcePanel: string;
  modal: null | { type: string; payload: any };
  notifications: Notification[];
  dragging: boolean;
  draggedItems: DraggedItems | null; // Global state for drag-and-drop
  workspaces: WorkspaceInfo[]; // List of all registered workspaces
  activeWorkspaceId: WorkspaceId | null; // Currently active workspace
}
```

#### Actions

```typescript
// Set active source panel
setActiveSourcePanel(panel: string): void

// Open modal
openModal(type: string, payload?: any): void

// Close modal
closeModal(): void

// Add notification
addNotification(notification: Omit<Notification, 'id'>): void

// Remove notification
removeNotification(id: string): void

// Set dragging state
setDragging(dragging: boolean): void

// Set global dragged items state
setDraggedItems(items: DraggedItems | ((current: DraggedItems) => DraggedItems)): void

// Workspace management
addWorkspace(workspace: WorkspaceInfo): void
removeWorkspace(id: WorkspaceId): void
setActiveWorkspace(id: WorkspaceId | null): void
getWorkspace(id: WorkspaceId): WorkspaceInfo | undefined
getWorkspaceByZoneId(zoneId: string): WorkspaceInfo | undefined
setWorkspaceZoneId(workspaceId: WorkspaceId, zoneId: string): void
```

#### Usage Example

```typescript
import { useUIStore } from './state/uiStore';

const { openModal, addNotification } = useUIStore();
```

---

### settingsStore

**Location**: `src/state/settingsStore.ts`

#### State

```typescript
interface SettingsState {
  exportPath: string;
  exportStrategy: 'copyWithNumberPrefix' | 'aimpPlaylist';
  lastOpenedPlaylist: string;
  trackItemSizePreset: 'small' | 'medium' | 'large';
  hourDividerInterval: number;
  showHourDividers: boolean;
}
```

#### Actions

```typescript
// Set export path
setExportPath(path: string): void

// Set export strategy
setExportStrategy(strategy: 'copyWithNumberPrefix' | 'aimpPlaylist'): void

// Set last opened playlist path
setLastOpenedPlaylist(path: string): void

// Set track item size preset
setTrackItemSizePreset(preset: 'small' | 'medium' | 'large'): void

// Set hour divider interval (in seconds)
setHourDividerInterval(interval: number): void

// Set show hour dividers flag
setShowHourDividers(show: boolean): void
```

#### Track Item Size Presets

- `small`: padding 8px, margin 2px
- `medium`: padding 12px, margin 4px (default)
- `large`: padding 16px, margin 6px

#### Hour Divider Intervals

Common interval values (in seconds):
- `900` - 15 minutes
- `1800` - 30 minutes
- `3600` - 1 hour (default)
- `7200` - 2 hours
- `10800` - 3 hours

#### Usage Example

```typescript
import { useSettingsStore } from './state/settingsStore';

const { 
  exportPath, 
  setExportPath,
  trackItemSizePreset,
  setTrackItemSizePreset,
  hourDividerInterval,
  setHourDividerInterval,
  showHourDividers,
  setShowHourDividers
} = useSettingsStore();
```

---

### demoPlayerStore

**Location**: `src/state/demoPlayerStore.ts`

#### State

```typescript
interface DemoPlayerState {
  currentTrack: Track | null;
  sourceWorkspaceId: WorkspaceId | null;
  status: 'idle' | 'playing' | 'paused' | 'ended';
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0..1
  error: string | null;
}
```

#### Actions

```typescript
loadTrack(track: Track, sourceWorkspaceId: WorkspaceId): Promise<void>;
play(): Promise<void>;
pause(): void;
seek(positionSeconds: number): void;
setVolume(value: number): void;
clear(): void;
```

Additional helpers exposed internally or via selectors:

- `setDuration(seconds: number)` — from `loadedmetadata` event, sets track duration.
- `setPosition(seconds: number)` — from `timeupdate` event, updates current playback position.
- `handleEnded()` — called on audio `ended` event, sets status to 'ended'.
- `handleError(message: string, error?: unknown)` — stores readable error message, logs technical details via logger.

#### Usage Example

```typescript
import { useDemoPlayerStore } from './state/demoPlayerStore';

const { currentTrack, status, play, pause, seek } = useDemoPlayerStore();
```

---

### dragDropStore

**Location**: `src/state/dragDropStore.ts`

Centralized store for managing cross-workspace drag-and-drop operations. This store is **workspace-agnostic** - it works with any track-based workspace registered via `trackWorkspaceStoreFactory`, without hardcoded dependencies on specific workspace types.

#### Methods

```typescript
interface DragDropState {
  // Move tracks between workspaces (removes from source)
  moveTracksBetweenWorkspaces: (
    trackIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetIndex?: number,
  ) => boolean;

  // Copy tracks between workspaces (keeps in source)
  copyTracksBetweenWorkspaces: (
    trackIds: string[],
    sourceWorkspaceId: WorkspaceId,
    targetWorkspaceId: WorkspaceId,
    targetIndex?: number,
  ) => boolean;
}
```

#### Usage Example

```typescript
import { useDragDropStore } from './state/dragDropStore';

const { moveTracksBetweenWorkspaces, copyTracksBetweenWorkspaces } = useDragDropStore();

// Move tracks from collection to playlist
moveTracksBetweenWorkspaces(
  ['track-id-1', 'track-id-2'],
  'collection-workspace-id',
  'default-playlist-workspace',
  0, // Insert at beginning
);
```

---

### trackWorkspaceStoreFactory

**Location**: `src/state/trackWorkspaceStoreFactory.ts`

Factory for creating and managing Zustand stores for track-based workspaces.

#### Functions

```typescript
// Create or get existing store for a workspace
function ensureTrackWorkspaceStore(options: TrackWorkspaceStoreOptions): TrackWorkspaceStore;

// Get store by workspace ID
function getTrackWorkspaceStore(workspaceId: WorkspaceId): TrackWorkspaceStore | undefined;

// Register an existing store (for main playlist)
function registerTrackWorkspaceStore(workspaceId: WorkspaceId, store: TrackWorkspaceStore): void;

// Get all registered stores (for debugging)
function getAllTrackWorkspaceStores(): Map<WorkspaceId, TrackWorkspaceStore>;
```

#### Store Options

```typescript
interface TrackWorkspaceStoreOptions {
  workspaceId: WorkspaceId; // Unique workspace identifier
  initialName?: string; // Initial name (default: 'New Workspace')
  maxTracks?: number | null; // Maximum tracks (null = unlimited, default: 150)
  historyDepth?: number; // Undo/redo history depth (default: 50)
}
```

#### Usage Example

```typescript
import { ensureTrackWorkspaceStore } from './state/trackWorkspaceStoreFactory';

// Create store for a collection
const collectionStore = ensureTrackWorkspaceStore({
  workspaceId: 'collection-123',
  initialName: 'My Collection',
  maxTracks: null, // Unlimited
  historyDepth: 50,
});

// Use the store
const { tracks, addTrack, removeTrack } = collectionStore();
```

---

## IPC Channels

### File Browser Channels

#### `fileBrowser:listDirectory`

List directory contents.

**Request**:

```typescript
{
  path: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: Array<{
    name: string;
    path: string;
    isDirectory: boolean;
  }>;
  error?: string;
}
```

**Usage**:

```typescript
const files = await ipcService.invoke('fileBrowser:listDirectory', { path: '/path/to/dir' });
```

---

#### `fileBrowser:statFile`

Get file statistics.

**Request**:

```typescript
{
  path: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: {
    size: number;
    modified: number;
    isDirectory: boolean;
  };
  error?: string;
}
```

---

#### `fileBrowser:findAudioFilesRecursive`

Find all audio files recursively in a directory.

**Request**:

```typescript
{
  path: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: string[];  // Array of file paths
  error?: string;
}
```

---

### Audio Channels

#### `audio:getDuration`

Get duration of an audio file in seconds.

**Request**:

```typescript
{
  path: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: number;  // Duration in seconds
  error?: string;
}
```

**Usage**:

```typescript
const duration = await ipcService.invoke('audio:getDuration', { path: '/path/to/track.mp3' });
```

---

#### `audio:getFileSource`

Get audio file contents as base64 buffer for secure playback. Used by demo player to load audio files without exposing file paths directly.

**Request**:

```typescript
{
  path: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: {
    buffer: string;  // Base64 encoded file buffer
    mimeType: string;  // MIME type (audio/mpeg, audio/flac, etc.)
  };
  error?: string;
}
```

**Usage**:

```typescript
const { buffer, mimeType } = await ipcService.invoke('audio:getFileSource', { 
  path: '/path/to/track.mp3' 
});
```

**Note**: This channel is used internally by `demoPlayerStore` to securely load audio files. The file is read as a buffer and converted to base64 for safe transfer to the renderer process.

---

### Export Channels

#### `export:execute`

Execute playlist export.

**Request**:

```typescript
{
  tracks: Track[];
  targetPath: string;
  strategy: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: {
    successful: string[];
    failed: Array<{
      path: string;
      error: string;
    }>;
  };
  error?: string;
}
```

**Usage**:

```typescript
const result = await ipcService.invoke('export:execute', {
  tracks: playlistTracks,
  targetPath: '/export/path',
  strategy: 'copyWithNumberPrefix',
});
```

---

#### `export:copyFile`

Copy single file (internal use).

**Request**:

```typescript
{
  sourcePath: string;
  destPath: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  error?: string;
}
```

---

#### `export:aimp`

Export playlist to AIMP format (M3U8) with relative paths.

**Request**:

```typescript
{
  tracks: Track[];
  targetPath: string;  // Target folder where subfolder will be created
  playlistName: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: {
    playlistPath: string;  // Path to created .m3u8 file
    successful: string[];  // Successfully copied tracks
    failed: Array<{
      path: string;
      error: string;
    }>;
  };
  error?: string;
}
```

**Usage**:

```typescript
const result = await ipcService.invoke('export:aimp', {
  tracks: playlistTracks,
  targetPath: '/export/path',
  playlistName: 'My Playlist',
});
```

**Note**: This handler creates a subfolder with the playlist name, copies all tracks with original filenames, and creates an M3U8 playlist file with relative paths.

---

#### `export:copyTracksToFolder`

Copy tracks into a new folder with original filenames (without numbering prefix).

**Request**:

```typescript
{
  tracks: Track[];
  targetPath: string;  // Target folder where new subfolder will be created
  folderName: string;  // Name of the subfolder to create
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: {
    folderPath: string;  // Path to created folder
    successful: string[];  // Successfully copied tracks
    failed: Array<{
      path: string;
      error: string;
    }>;
  };
  error?: string;
}
```

**Usage**:

```typescript
const result = await ipcService.invoke('export:copyTracksToFolder', {
  tracks: playlistTracks,
  targetPath: '/export/path',
  folderName: 'My Playlist',
});
```

**Note**: This handler creates a subfolder with the specified name, copies all tracks with their original filenames (no numbering prefix), and returns the path to the created folder along with success/failure information.

---

### Playlist Channels

#### `playlist:save`

Save playlist to JSON file.

**Request**:

```typescript
{
  path: string;
  playlist: {
    name: string;
    tracks: Array<{ path: string }>;
  }
}
```

**Response**:

```typescript
{
  success: boolean;
  error?: string;
}
```

---

#### `playlist:load`

Load playlist from JSON file.

**Request**:

```typescript
{
  path: string;
}
```

**Response**:

```typescript
{
  success: boolean;
  data?: {
    name: string;
    tracks: Array<{ path: string }>;
  };
  error?: string;
}
```

---

### Plugin Channels

#### `plugins:list`

List available plugins.

**Request**: `{}`

**Response**:

```typescript
{
  success: boolean;
  data?: Array<{
    name: string;
    version: string;
    type: 'source' | 'export' | 'utility';
  }>;
  error?: string;
}
```

---

## Services API

### IPCService

**Location**: `src/services/ipcService.ts`

#### Methods

```typescript
class IPCService {
  // Generic IPC invoke
  async invoke<T>(channel: string, payload?: any): Promise<T>;

  // List directory
  async listDirectory(path: string): Promise<DirectoryItem[]>;

  // Export playlist
  async exportPlaylist(
    tracks: Track[],
    targetPath: string,
    strategy: string,
  ): Promise<ExportResult>;

  // Get audio file duration
  async getAudioDuration(path: string): Promise<number>;

  // Get audio file contents as base64 buffer for secure playback
  async getAudioFileSource(
    path: string,
    showNotification?: boolean,
  ): Promise<{
    buffer: string;  // Base64 encoded file buffer
    mimeType: string;  // MIME type
  }>;

  // Export to AIMP format
  async exportAIMPPlaylist(
    tracks: Track[],
    targetPath: string,
    playlistName: string,
  ): Promise<{
    playlistPath: string;
    successful: string[];
    failed: Array<{ path: string; error: string }>;
  }>;

  // Find audio files recursively
  async findAudioFilesRecursive(path: string): Promise<string[]>;

  // Save playlist
  async savePlaylist(path: string, playlist: PlaylistData): Promise<void>;

  // Load playlist
  async loadPlaylist(path: string): Promise<PlaylistData>;

  // Show folder selection dialog
  async showFolderDialog(options?: {
    title?: string;
    defaultPath?: string;
  }): Promise<string | null>;

  // Show save file dialog
  async showSaveDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;

  // Show open file dialog
  async showOpenFileDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;

  // Get system path (documents, music, downloads, etc.)
  async getSystemPath(name: string): Promise<string>;
}
```

**Usage**:

```typescript
import { ipcService } from './services/ipcService';

const files = await ipcService.listDirectory('/path/to/dir');
const duration = await ipcService.getAudioDuration('/path/to/track.mp3');
const { buffer, mimeType } = await ipcService.getAudioFileSource('/path/to/track.mp3');
const folderPath = await ipcService.showFolderDialog({ title: 'Select folder' });
const systemPath = await ipcService.getSystemPath('music');
```

---

### FileService

**Location**: `src/services/fileService.ts`

#### Methods

```typescript
class FileService {
  // List folder contents
  async listFolder(path: string): Promise<DirectoryItem[]>;

  // Read file metadata (optional)
  async readFileMeta(path: string): Promise<FileMetadata | null>;

  // Validate audio file
  isValidAudioFile(path: string): boolean;
}
```

---

### ExportService

**Location**: `src/services/exportService.ts`

#### Methods

```typescript
class ExportService {
  // Export playlist with number prefix strategy
  async exportWithNumberPrefix(
    tracks: Track[],
    targetPath: string,
  ): Promise<ExportResult>;

  // Export playlist to AIMP format (M3U8 with relative paths)
  async exportAIMPPlaylist(
    tracks: Track[],
    targetPath: string,
    playlistName: string,
  ): Promise<{
    playlistPath: string;
    successful: string[];
    failed: Array<{ path: string; error: string }>;
  }>;

  // Copy tracks into a new folder with original filenames
  async copyTracksToFolder(
    tracks: Track[],
    targetPath: string,
    folderName: string,
  ): Promise<{
    folderPath: string;
    successful: string[];
    failed: Array<{ path: string; error: string }>;
  }>;

  // Get available strategies
  getAvailableStrategies(): string[];
}
```

**Export Options**:

```typescript
interface ExportOptions {
  targetPath: string;
  strategy: 'copyWithNumberPrefix' | 'm3u' | string;
  overwrite?: boolean;
}
```

**Export Result**:

```typescript
interface ExportResult {
  success: boolean;
  successful: string[];
  failed: Array<{
    path: string;
    error: string;
  }>;
}
```

---

### PlaylistService

**Location**: `src/services/playlistService.ts`

#### Methods

```typescript
class PlaylistService {
  // Save playlist to file
  async savePlaylist(playlistObj: PlaylistData, targetPath: string): Promise<void>;

  // Load playlist from file
  async loadPlaylist(path: string): Promise<PlaylistData>;

  // Validate playlist file
  validatePlaylistFile(data: any): boolean;
}
```

---

## Type Definitions

### DraggedItems

```typescript
type DraggedItems =
  | {
      type: 'tracks';
      ids: Set<string>;
      sourceWorkspaceId?: WorkspaceId; // Workspace where tracks originated (for cross-workspace detection)
      isCopyMode?: boolean; // Ctrl/Cmd key state (determined in handleDragOver, stored for use in handleDrop)
    }
  | { type: 'files'; paths: string[] }
  | null;
```

**Key Points:**

- `sourceWorkspaceId`: Set in `handleDragStart` to identify the source workspace for cross-workspace operations
- `isCopyMode`: Determined in `handleDragOver` by checking `e.ctrlKey || e.metaKey`, stored in `draggedItems` because `e.ctrlKey` may be unavailable in the `drop` event
- The system is **workspace-agnostic** - it works with any track-based workspace through workspace IDs, not hardcoded types

### Track

```typescript
interface Track {
  id: string; // UUID
  path: string; // Full file path
  name: string; // Display name (filename)
  duration?: number; // Duration in seconds (optional, extracted using music-metadata)
}
```

---

### PlaylistData

```typescript
interface PlaylistData {
  name: string;
  tracks: Array<{
    path: string;
  }>;
}
```

---

### DirectoryItem

```typescript
interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
}
```

---

### Notification

```typescript
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}
```

---

### ExportError

```typescript
interface ExportError {
  track: string;
  error: string;
}
```

---

## Component Props

### PlaylistView

**Location**: `src/components/PlaylistView.tsx`

```typescript
interface PlaylistViewProps {
  zoneId?: string;  // Zone identifier for drag-and-drop operations
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ zoneId }) => { ... }
```

**Features**:

- Displays total duration in header (format: "H:MM:SS" or "M:SS")
- Compact "Select All" button in header (icon-only, visible when no tracks selected)
- Shows "Deselect All" and "Delete Selected" buttons when tracks are selected
- Editable playlist name input field
- Drag-and-drop reordering using native HTML5 API
- Visual insert indicator (blue line) showing drop position
- Compact row height (configurable via settings: small/medium/large presets)
- **Hour dividers**: Visual markers showing accumulated time intervals (configurable: 15 min, 30 min, 1 hour, 2 hours, 3 hours)
  - Dividers can be enabled/disabled via settings
  - Format: "hh:mm" (e.g., "1:30" for 1 hour 30 minutes)
  - Dividers appear after tracks when accumulated duration exceeds the configured interval

**Internal State**:

- `draggedItems: DraggedItems | null` - Unified state for all drag types:
  - `{ type: 'tracks'; ids: Set<string>; sourceWorkspaceId?: WorkspaceId; isCopyMode?: boolean }` - Dragged tracks (supports group dragging)
    - `sourceWorkspaceId`: Identifier of the workspace where tracks originated (for cross-workspace operations)
    - `isCopyMode`: Whether Ctrl/Cmd key is pressed (determined in `handleDragOver`, stored for use in `handleDrop`)
  - `{ type: 'files'; paths: string[] }` - Dragged files from FileBrowser
  - `null` - No active drag
- `dragOverId: string | null` - ID of track under cursor (or null for empty space)
- `insertPosition: 'top' | 'bottom' | null` - Insert position relative to target element

**Drag-and-Drop Handlers**:

- `handleDragStart(e: React.DragEvent, trackId: string)` - Initiates drag operation. If dragged track is selected with others, drags all selected tracks. Otherwise drags single track. Sets `draggedItems` with type 'tracks', including `sourceWorkspaceId` for cross-workspace detection. Sets `e.dataTransfer.effectAllowed = 'copyMove'` to allow both copy and move operations.
- `handleDragOver(e: React.DragEvent, context: DropContext)` - Calculates insert position based on cursor location. Supports both tracks and files. For cross-workspace track operations, detects Ctrl/Cmd key state (`e.ctrlKey || e.metaKey`) and stores it in `draggedItems.isCopyMode` for later use in `handleDrop` (since `e.ctrlKey` may be unavailable in drop event). Updates `dropEffect` to 'copy' or 'move' based on `isCopyMode`. For files, sets `draggedItems` with type 'files'. Does not show indicator over dragged tracks.
- `handleDrop(e: React.DragEvent, context: DropContext)` - Handles drop operation. Uses stored `isCopyMode` from `draggedItems` (not `e.ctrlKey`) to determine copy vs move. Determines drag type from `dataTransfer.types`. Performs track reordering, file insertion, or cross-workspace operations. Supports both single track movement (`moveTrack`) and group movement (`moveSelectedTracks`). For files, uses `addTracksAt`.
- `handleDragEnd()` - Cleans up drag state (no parameters, opacity restored via CSS class)

**Container Event Handlers**:

- `onDragOver` (container) - Handles dragging over empty space. Determines drag type from `dataTransfer.types`. Resets `dragOverId` and `insertPosition` for files and tracks to allow drop in empty space.
- `onDragLeave` (container) - Checks that cursor actually left container area (not moved to child element) using `relatedTarget` and coordinates.
- `onDrop` (container) - Handles drop in empty container space. For files, adds them to end via `addTracks()`. For tracks, moves them to end of list.

**Group Drag-and-Drop**:

- If dragged track is selected together with other tracks, all selected tracks are dragged as a group
- Relative order of selected tracks is preserved during movement
- All dragged tracks are visually highlighted (semi-transparent)
- Uses `moveSelectedTracks(toIndex)` method from store for group movement

**File Drag-and-Drop from FileBrowser**:

- Files from FileBrowser are dragged with type `application/json` in `dataTransfer`
- On drop on track element: files are inserted at element position via `addTracksAt(finalIndex)`
- On drop in empty container space: files are added to end via `addTracks()`
- `draggedItems` is set in `handleDragOver` for track elements or in `handleDrop` if not set

**Cross-Workspace Drag-and-Drop**:

The drag-and-drop system is **workspace-agnostic** - it works with any track-based workspace (playlists, collections, or future workspace types) without hardcoded dependencies. The system uses workspace IDs to identify source and target, making it fully extensible.

- When dragging tracks between different workspaces (playlist ↔ collection, collection ↔ collection):
  - Detected by comparing `sourceWorkspaceId` (set in `handleDragStart`) and `targetWorkspaceId` (from `DropContext`) in `draggedItems`
  - If `sourceWorkspaceId !== targetWorkspaceId`: calls `dragDropStore.moveTracksBetweenWorkspaces()` or `dragDropStore.copyTracksBetweenWorkspaces()`
  - Copy operation (Ctrl/Cmd) is detected in `handleDragOver` via `e.ctrlKey || e.metaKey` and stored in `draggedItems.isCopyMode`
  - In `handleDrop`, the stored `isCopyMode` value is used (not `e.ctrlKey`, which may be unavailable)
- Unified logic: always move by default, copy only with Ctrl/Cmd
- All cross-workspace operations go through centralized `dragDropStore`, which uses `getTrackWorkspaceStore()` to find stores by workspace ID
- The system validates workspace existence before operations and provides user notifications on errors

---

### CollectionView

**Location**: `src/components/CollectionView.tsx`

```typescript
interface CollectionViewProps {
  workspaceId: WorkspaceId;  // Unique identifier for the collection
  zoneId?: string;           // Associated layout zone ID
}

export const CollectionView: React.FC<CollectionViewProps> = ({ workspaceId, zoneId }) => { ... }
```

**Features**:

- Lightweight version of playlist for temporary track storage
- Unlimited tracks (no `maxTracks` limit)
- Full functionality: selection, drag-and-drop, undo/redo, statistics
- Cross-workspace drag-and-drop support
- Reuses `PlaylistItem` component and styling
- Independent Zustand store created via `trackWorkspaceStoreFactory`
- **Automatic persistence** between app sessions (via Zustand persist middleware)
- **Export to JSON** format (same as playlists) via export button in header

**Store Creation**:

Collections use `ensureTrackWorkspaceStore()` to create or retrieve their store:

```typescript
const collectionStore = ensureTrackWorkspaceStore({
  workspaceId,
  initialName: 'New Collection',
  maxTracks: null, // Unlimited
  historyDepth: 50,
});
```

---

### DemoPlayer

**Location**: `src/components/DemoPlayer.tsx`

```typescript
interface DemoPlayerProps {
  className?: string;
}

export const DemoPlayer: React.FC<DemoPlayerProps> = ({ className }) => { ... }
```

**Features**:

- Always rendered at the top of `AppHeader`.
- Shows current track title or placeholder text.
- Buttons: Play/Pause toggle and "Show in browser" ("Показать в браузере").
- Timeline slider and time labels for current/total duration.
- Volume slider (0–100% mapped to 0..1).
- Error state disables controls and shows tooltip/notification.

**Integration**:

- Subscribes to `useDemoPlayerStore`.
- Uses `seek`, `setVolume`, `play`, `pause`.
- Calls `uiStore.focusFileInBrowser(path)` when "Show" ("Показать") button is clicked.

---

### PlaylistItem

**Location**: `src/components/PlaylistItem.tsx`

```typescript
interface PlaylistItemProps {
  track: Track;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver?: boolean;
  insertPosition?: 'top' | 'bottom' | null;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({ ... }) => { ... }
```

**Props Description**:

- `track: Track` - Track object to display
- `index: number` - Position in playlist (0-based)
- `isSelected: boolean` - Whether track is selected
- `isDragging: boolean` - Whether this track is being dragged
- `isDragOver?: boolean` - Whether cursor is over this track
- `insertPosition?: 'top' | 'bottom' | null` - Where to insert if dropping here
- `onToggleSelect: (id: string) => void` - Toggle selection handler
- `onRemove: (id: string) => void` - Remove track handler
- `onDragStart: (e: React.DragEvent, id: string) => void` - Drag start handler
- `onDragOver: (e: React.DragEvent) => void` - Drag over handler
- `onDrop: (e: React.DragEvent, id: string) => void` - Drop handler
- `onDragEnd: (e: React.DragEvent) => void` - Drag end handler

**Features**:

- Native HTML5 drag-and-drop support (`draggable` attribute)
- Visual states: selected, dragging, drag-over
- Click to select/deselect
- Duration display (format: "M:SS", fallback: "--:--")
- Delete button (visible on hover)

**CSS Classes**:

- `.playlist-item` - Base styles
- `.playlist-item.selected` - Selected state (blue background and border)
- `.playlist-item.dragging` - Dragging state (reduced opacity)
- `.playlist-item.drag-over` - Drag over state (no visual highlight, uses insert line instead)

**Drag-and-Drop CSS**:

- `.drag-insert-line` - Visual indicator line showing drop position
  - Height: 2px
  - Color: #4a9eff (blue)
  - Animation: pulse-line (pulsating effect)
  - Box shadow for visibility

---

## CSS Classes Reference

### Drag-and-Drop Styles

**Location**: `src/App.css`

#### `.drag-insert-line`

Visual indicator line that appears between tracks during drag-and-drop operation.

```css
.drag-insert-line {
  height: 2px;
  background-color: #4a9eff;
  margin: 0;
  border-radius: 1px;
  box-shadow: 0 0 4px rgba(74, 158, 255, 0.6);
  animation: pulse-line 1s ease-in-out infinite;
}
```

**Usage**: Rendered conditionally in `PlaylistView` when `dragOverId === track.id` and `insertPosition` is set.

**Animation**: `@keyframes pulse-line` - Creates a subtle pulsing effect (opacity 1 → 0.6 → 1).

#### `.playlist-item.dragging`

Applied to the track being dragged.

```css
.playlist-item.dragging {
  opacity: 0.5;
  transform: scale(0.98);
}
```

#### `.playlist-item.drag-over`

Applied when cursor is over a track during drag operation. Currently has no visual styling (insert line is used instead).

#### `.playlist-hour-divider`

Visual divider line that appears between tracks when accumulated duration exceeds configured interval.

```css
.playlist-hour-divider {
  height: 3px;
  background-color: var(--accent-primary);
  margin: 8px 0;
  position: relative;
  display: flex;
  align-items: center;
  opacity: 0.8;
}
```

**Usage**: Rendered conditionally in `PlaylistView` when `showHourDividers === true` and `calculateDividerMarkers.includes(index)`.

#### `.playlist-hour-divider-label`

Label showing accumulated time at divider position.

```css
.playlist-hour-divider-label {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--bg-secondary);
  padding: 2px 10px;
  color: var(--text-primary);
  font-size: var(--font-size-secondary);
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid var(--accent-primary);
  border-radius: 4px;
}
```

**Format**: "hh:mm" (e.g., "1:30" for 1 hour 30 minutes)

---

### SettingsModal

**Location**: `src/components/SettingsModal.tsx`

```typescript
// No props - uses Zustand stores directly
export const SettingsModal: React.FC = () => { ... }
```

**Features**:

- Opens when `uiStore.modal === 'settings'`
- Contains UI customization settings:
  - **Track item size preset**: Select between "Small" ("Маленькие"), "Medium" ("Средние"), "Large" ("Большие")
    - Small: padding 8px, margin 2px
    - Medium: padding 12px, margin 4px (default)
    - Large: padding 16px, margin 6px
  - **Show hour dividers**: Checkbox to enable/disable dividers in playlist
  - **Hour divider interval**: Select interval (15 min, 30 min, 1 hour, 2 hours, 3 hours)
    - Disabled when dividers are turned off
- Settings are saved to `settingsStore` with persistence
- Uses local state for form inputs, syncs on modal open

**Note**: Export settings have been moved to `ExportModal` component.

---

### ExportModal

**Location**: `src/components/ExportModal.tsx`

```typescript
// No props - uses Zustand stores directly
export const ExportModal: React.FC = () => { ... }
```

**Features**:

- Opens when `uiStore.modal === 'export'`
- Contains export configuration:
  - **Export folder**: Input field with browse button for selecting target folder
  - **Export strategy**: Select between "Copy with numbering" ("Копирование с нумерацией") and "AIMP playlist" ("AIMP плейлист")
- On "Export" ("Экспортировать") button:
  - Saves settings to `settingsStore`
  - Executes export via `exportService`
  - Shows success/error notification
  - Closes modal
- On "Cancel" ("Отмена") button: Closes modal without saving or exporting

**Integration**:

- Triggered from `AppHeader.handleExport()` when export button is clicked
- Uses `usePlaylistStore` to get tracks and playlist name
- Uses `useSettingsStore` to get/set export settings

---

### FileBrowser

**Location**: `src/components/FileBrowser.tsx`

```typescript
interface FileBrowserProps {
  rootPath?: string;
  onFileSelect?: (path: string) => void;
  onFilesDrag?: (files: string[]) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ ... }) => { ... }
```

---

### SourcesPanel

**Location**: `src/components/SourcesPanel.tsx`

```typescript
interface SourcesPanelProps {
  activeSource?: string;
  onSourceChange?: (source: string) => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ ... }) => { ... }
```

---

## Window API (Preload)

The preload script exposes a limited API to the renderer process:

```typescript
interface Window {
  api: {
    invoke: (channel: string, payload?: any) => Promise<IPCResponse<any>>;
  };
}
```

**Usage**:

```typescript
// In renderer process
const result = await window.api.invoke('fileBrowser:listDirectory', { path: '/dir' });
```

---

## Error Handling

All IPC calls return a standardized response:

```typescript
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Always check `success` before using `data`:

```typescript
const response = await ipcService.invoke('channel', payload);
if (!response.success) {
  throw new Error(response.error || 'Operation failed');
}
const data = response.data;
```

---

## Constants

### Supported Audio Formats

```typescript
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg'] as const;
```

### Export Strategies

```typescript
const EXPORT_STRATEGIES = {
  COPY_WITH_NUMBER_PREFIX: 'copyWithNumberPrefix',
  AIMP_PLAYLIST: 'aimpPlaylist', // M3U8 format with relative paths
} as const;
```

### Max Playlist Size

```typescript
const MAX_PLAYLIST_SIZE = 150;
```

**Note**: This is a requirement defined in the documentation. The actual validation check in the code should be implemented in `playlistStore.addTrack()` and `playlistStore.addTracks()` methods to prevent exceeding this limit.

---

## Utility Functions

### Duration Utilities

**Location**: `src/utils/durationUtils.ts`

```typescript
// Format duration in seconds to "H:MM:SS" format
function formatDuration(seconds: number): string;

// Format duration in seconds to "M:SS" format (for individual tracks)
function formatTrackDuration(seconds: number): string;

// Calculate total duration of tracks array
function calculateTotalDuration(tracks: Track[]): number;
```

**Usage**:

```typescript
import { formatDuration, formatTrackDuration, calculateTotalDuration } from './utils/durationUtils';

const total = calculateTotalDuration(tracks);
const formatted = formatDuration(total); // "2:34:15"
const trackFormatted = formatTrackDuration(225); // "3:45"
```

---

## Notes

- All file paths should use absolute paths (except in exported AIMP playlists where relative paths are used)
- Track IDs are UUIDs generated using `uuid` library
- IPC channels are whitelisted in preload script for security
- All async operations should include error handling
- Store updates are synchronous, but side effects (IPC calls) are async
- Track duration is extracted using `music-metadata` library when tracks are added
- Selected tracks are stored in a `Set<string>` for efficient lookup

---

**Last Updated**: December 2024
**Version**: 1.0.0
