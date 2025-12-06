# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-XX

### Added

- Basic playlist creation and management functionality
- Drag-and-drop interface for reordering tracks
- File browser for selecting audio files
- Export functionality with number prefix strategy
- Export to AIMP format (M3U8) with relative paths
- Track selection and batch operations
- Undo/Redo functionality with keyboard shortcuts
- Track duration display (total and per-track)
- Settings modal for configuration
- Notification system
- History store for undo/redo operations
- IPC communication layer with security whitelisting
- Path validation to prevent path traversal attacks
- Content Security Policy implementation

### Security

- Context isolation enabled
- Node integration disabled in renderer process
- IPC channels whitelisted in preload script
- Path validation implemented for file operations
- Content Security Policy configured in index.html

### Known Issues

All issues identified during code review have been fixed in version 1.0.0.

#### Fixed Issues

1. ✅ **Path Validation Vulnerability** - FIXED
   - **Location**: `electron/utils/fsHelpers.ts` - `validatePath()` function
   - **Fix**: Added blocking of paths with `..` and `~` when `basePath` is not specified
   - **Status**: Resolved

2. ✅ **Missing File Existence Check** - FIXED
   - **Location**: `electron/ipc/export.ts` - `exportWithNumberPrefix()` and `exportAIMPPlaylist()` functions
   - **Fix**: Added `fs.access()` check before copying files
   - **Status**: Resolved

3. ✅ **Missing Playlist Size Limit Enforcement** - FIXED
   - **Location**: `src/state/playlistStore.ts` - `addTrack()`, `addTracks()`, and `addTracksAt()` methods
   - **Fix**: Added MAX_PLAYLIST_SIZE = 150 constant and validation in all add methods
   - **Status**: Resolved

4. ✅ **Potential Memory Leak in Keyboard Event Handler** - FIXED
   - **Location**: `src/components/PlaylistView.tsx` - `useEffect` hook for keyboard shortcuts
   - **Fix**: Used `useCallback` for stable function reference
   - **Status**: Resolved

5. ✅ **Race Condition in Track Duration Loading** - FIXED
   - **Location**: `src/hooks/useTrackDuration.ts`
   - **Fix**: Added track ID verification before updating duration
   - **Status**: Resolved

6. ✅ **Console.error Usage in Production** - FIXED
   - **Location**: Multiple files
   - **Fix**: Implemented centralized logging system with log levels (`src/utils/logger.ts` and `electron/utils/logger.ts`)
   - **Status**: Resolved

7. ✅ **Incomplete Error Information in validatePath** - FIXED
   - **Location**: `electron/utils/fsHelpers.ts` - `validatePath()` function
   - **Fix**: Added error logging using logger utility
   - **Status**: Resolved

### Future Improvements

- Add comprehensive test coverage for critical functions
- Add performance optimizations (memoization for calculations)
- Improve accessibility (ARIA attributes, better focus management)
- Add debounce for file search functionality
- Extract constants to dedicated constants file
- Improve error handling with standardized error types
- Integrate error tracking service (e.g., Sentry) for production

---

## [Unreleased]

### Planned

- Additional export formats
- Audio preview player
- Metadata scanner/importer
- Tagging system
- BPM/Key analysis
- Auto-sorting algorithms
- Cloud sync capabilities
- Playlist-to-streaming import
- Machine learning suggestions
- Multi-playlist editing mode
