# Security Documentation

This document describes security measures implemented in CherryPlayList and security requirements for future development.

## Security Architecture

### Electron Security Configuration

The application implements multiple layers of security following Electron security best practices:

#### Context Isolation

- **Status**: ✅ Implemented
- **Location**: `electron/main.ts`
- **Configuration**: `contextIsolation: true`
- **Purpose**: Isolates the main world context from the isolated world context, preventing renderer process from accessing Node.js APIs directly

#### Node Integration

- **Status**: ✅ Implemented
- **Location**: `electron/main.ts`
- **Configuration**: `nodeIntegration: false`
- **Purpose**: Prevents direct Node.js API access from renderer process

#### Preload Script

- **Status**: ✅ Implemented
- **Location**: `electron/preload.ts`
- **Purpose**: Safely exposes limited IPC API to renderer process via `contextBridge`

#### IPC Channel Whitelisting

- **Status**: ✅ Implemented
- **Location**: `electron/preload.ts`
- **Implementation**: All IPC channels are whitelisted in `validChannels` array
- **Behavior**: Any attempt to use a non-whitelisted channel results in a rejected promise

### Content Security Policy (CSP)

- **Status**: ✅ Implemented
- **Location**: `index.html`
- **Configuration**:
  ```html
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
  />
  ```
- **Restrictions**:
  - Scripts: Same origin and inline scripts (required for Vite)
  - Styles: Same origin, inline styles, and Google Fonts
  - Fonts: Same origin and Google Fonts
  - All other resources: Same origin only

## Path Validation

### Current Implementation

Path validation is implemented in `electron/utils/fsHelpers.ts` via the `validatePath()` function.

**Current Behavior**:

- Validates that the path is a non-empty string
- Resolves and normalizes the path using `path.resolve()`
- If `basePath` is provided, ensures the resolved path is within the base path
- Blocks paths that resolve outside the base path

### Security Requirements

#### Critical Requirement: Block Path Traversal When basePath Not Provided

**Issue**: When `basePath` is not provided, paths containing `..` are not blocked, which could allow path traversal attacks.

**Required Fix**: The `validatePath()` function should block paths with `..` when `basePath` is not provided:

```typescript
export function validatePath(userPath: string, basePath?: string): boolean {
  if (!userPath || typeof userPath !== 'string') {
    return false;
  }

  // Block paths with .. if basePath is not specified
  if (!basePath && (userPath.includes('..') || userPath.includes('~'))) {
    return false;
  }

  try {
    const resolvedPath = path.resolve(userPath);

    if (basePath) {
      const resolvedBasePath = path.resolve(basePath);
      const relative = path.relative(resolvedBasePath, resolvedPath);

      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    // Log errors for debugging in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Path validation error:', error);
    }
    return false;
  }
}
```

**Priority**: Critical - Should be fixed immediately

### File Existence Validation

**Requirement**: Before performing file operations (copy, read, etc.), the code should verify that source files exist using `fs.access()` or `fs.stat()`.

**Current Status**:

- ✅ Some handlers check file existence (e.g., `audio:getDuration`)
- ❌ Export functions do not verify source file existence before copying

**Required Implementation**:

```typescript
// Before copying a file
try {
  await fs.access(sourcePath);
  await copyFile(sourcePath, destPath);
} catch (error) {
  // Handle file not found or permission errors
  throw new Error(`Source file not accessible: ${error.message}`);
}
```

**Priority**: High - Should be implemented in export functions

## IPC Security

### Whitelisted Channels

The following IPC channels are whitelisted in `electron/preload.ts`:

#### File Browser Channels

- `fileBrowser:listDirectory`
- `fileBrowser:statFile`
- `fileBrowser:findAudioFilesRecursive`

#### Audio Channels

- `audio:getDuration`

#### Export Channels

- `export:execute`
- `export:copyFile`
- `export:aimp`

#### Playlist Channels

- `playlist:save`
- `playlist:load`

#### Dialog Channels

- `dialog:showOpenDialog`
- `dialog:showSaveDialog`
- `dialog:showOpenFileDialog`

#### System Channels

- `system:getPath`

### Adding New Channels

When adding new IPC channels:

1. Add the channel name to the `validChannels` array in `electron/preload.ts`
2. Implement the handler in the appropriate IPC handler file
3. Register the handler in `electron/main.ts`
4. Document the channel in `API.md`

## Plugin Security

### Current Status

- **Sandboxing**: ⚠️ Implementation pending
- **Network Access**: ✅ Disabled by default
- **API Restrictions**: ⚠️ To be defined

### Future Requirements

- Plugins should run in a sandboxed environment
- Plugin API should be restricted to safe operations only
- Plugins should not have direct file system access
- Plugin communication should go through IPC channels

## Security Best Practices

### Input Validation

- Always validate user input before processing
- Use type checking and validation functions
- Sanitize file paths and names
- Check file existence before operations

### Error Handling

- Don't expose sensitive information in error messages
- Log errors for debugging in development mode
- Provide user-friendly error messages
- Handle errors gracefully without crashing

### File Operations

- Always validate paths before file operations
- Check file existence before reading/writing
- Use safe file name sanitization (`safeFileName()`)
- Never trust user-provided paths without validation

### Code Review Checklist

When reviewing code for security:

- [ ] Are all user inputs validated?
- [ ] Are file paths validated before operations?
- [ ] Are IPC channels whitelisted?
- [ ] Are errors handled without exposing sensitive information?
- [ ] Are file operations checked for existence?
- [ ] Are paths sanitized for file names?

## Known Security Issues

See `CHANGELOG.md` for a complete list of known security issues. Key issues:

1. **Path Validation Vulnerability**: `validatePath()` should block `..` when `basePath` is not provided
2. **Missing File Existence Check**: Export functions should verify source file existence

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public issue
2. Contact the maintainers directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## Security Updates

Security-related updates will be documented in `CHANGELOG.md` under the "Security" section.

---

**Last Updated**: December 2024
