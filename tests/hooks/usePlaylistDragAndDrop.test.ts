import { renderHook, act } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';

import { usePlaylistDragAndDrop } from '../../src/hooks/usePlaylistDragAndDrop';
import { useUIStore } from '../../src/state/uiStore';
import { createMockDragEvent, createTrack, flushPromises } from '../testUtils';

const baseTracks = [
  createTrack('1', '/track-1.mp3'),
  createTrack('2', '/track-2.mp3'),
  createTrack('3', '/track-3.mp3'),
];

const createDragLeaveEvent = () =>
  ({
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        right: 100,
        top: 0,
        bottom: 100,
      }),
      contains: () => false,
    },
    relatedTarget: null,
    clientX: 200,
    clientY: 200,
  }) as ReactDragEvent<Element>;

function createOptions() {
  return {
    tracks: baseTracks,
    selectedTrackIds: new Set<string>(),
    isValidAudioFile: jest.fn((path: string) => path.endsWith('.mp3')),
    onMoveTrack: jest.fn(),
    onMoveSelectedTracks: jest.fn(),
    onAddTracks: jest.fn(),
    onAddTracksAt: jest.fn(),
    onTracksAdded: jest.fn(),
    loadFolderTracks: jest.fn().mockResolvedValue(['/folder/nested.mp3']),
  };
}

const renderUsePlaylistDragAndDrop = (override: Partial<ReturnType<typeof createOptions>> = {}) => {
  const options = { ...createOptions(), ...override };
  const view = renderHook(() => usePlaylistDragAndDrop(options));
  return { ...view, options };
};

let setDraggingMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  setDraggingMock = jest.fn();
  useUIStore.setState({
    setDragging: setDraggingMock,
    dragging: false,
    activeSource: 'fileBrowser',
    modal: null,
    notifications: [],
    setActiveSource: () => {},
    openModal: () => {},
    closeModal: () => {},
    addNotification: () => {},
    removeNotification: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

describe('usePlaylistDragAndDrop', () => {
  it('marks dragging state on start and clears on drag end', () => {
    const { result } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    expect(setDraggingMock).toHaveBeenCalledWith(true);

    act(() => {
      result.current.handleDragEnd();
    });

    expect(setDraggingMock).toHaveBeenLastCalledWith(false);
    expect(result.current.draggedItems).toBeNull();
  });

  it('updates insertion indicators on drag over and clears them on leave', () => {
    const { result } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragOver(createMockDragEvent({ types: ['text/plain'], clientY: 80 }), {
        module: 'playlistItem',
        targetId: '2',
      });
    });

    expect(result.current.dragOverId).toBe('2');
    expect(result.current.insertPosition).toBe('bottom');

    act(() => {
      result.current.handleDragLeave(createDragLeaveEvent());
    });

    expect(result.current.dragOverId).toBeNull();
    expect(result.current.insertPosition).toBeNull();
  });

  it('moves a single track when dropped on another item', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(createMockDragEvent({ types: ['text/plain'], clientY: 10 }), {
        module: 'playlistItem',
        targetId: '2',
      });
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), {
        module: 'playlistItem',
        targetId: '2',
      });
    });

    expect(options.onMoveTrack).toHaveBeenCalledWith(0, 1);
  });

  it('moves grouped selection preserving order', () => {
    const selectedIds = new Set<string>(['1', '2']);
    const { result, options } = renderUsePlaylistDragAndDrop({ selectedTrackIds: selectedIds });

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDragOver(createMockDragEvent({ types: ['text/plain'], clientY: 90 }), {
        module: 'playlistItem',
        targetId: '3',
      });
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), {
        module: 'playlistItem',
        targetId: '3',
      });
    });

    expect(options.onMoveSelectedTracks).toHaveBeenCalledWith(1);
  });

  it('adds files dropped on playlist item at correct index', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    act(() => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({ type: 'fileBrowser', paths: ['/new/song.mp3'] }),
        },
        clientY: 90,
      });
      result.current.handleDrop(event, { module: 'playlistItem', targetId: '2' });
    });

    expect(options.onAddTracksAt).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          path: '/new/song.mp3',
          name: 'song.mp3',
        }),
      ],
      1,
    );
    expect(options.onTracksAdded).toHaveBeenCalledWith(['/new/song.mp3']);
  });

  it('adds folders recursively when dropped', async () => {
    const loadFolderTracks = jest.fn().mockResolvedValue(['/folder/inner.mp3']);
    const { result, options } = renderUsePlaylistDragAndDrop({ loadFolderTracks });

    await act(async () => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({
            type: 'fileBrowser',
            paths: [],
            directories: ['/folder'],
          }),
        },
      });
      result.current.handleDrop(event, { module: 'playlistContainer' });
      await flushPromises();
    });

    expect(loadFolderTracks).toHaveBeenCalledWith('/folder');
    expect(options.onAddTracks).toHaveBeenCalledWith([
      expect.objectContaining({ path: '/folder/inner.mp3' }),
    ]);
  });

  it('moves a single track to the end when dropped on container', () => {
    const { result, options } = renderUsePlaylistDragAndDrop();

    act(() => {
      result.current.handleDragStart(createMockDragEvent({ types: ['text/plain'] }), '1');
    });

    act(() => {
      result.current.handleDrop(createMockDragEvent({ types: ['text/plain'] }), {
        module: 'playlistContainer',
      });
    });

    expect(options.onMoveTrack).toHaveBeenCalledWith(0, baseTracks.length - 1);
  });

  it('adds only valid files dropped on the container and reports added paths', () => {
    const isValidAudioFile = jest.fn((path: string) => path.endsWith('.mp3'));
    const { result, options } = renderUsePlaylistDragAndDrop({ isValidAudioFile });

    act(() => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({
            type: 'fileBrowser',
            paths: ['/valid.mp3', '/skip.txt'],
          }),
        },
      });
      result.current.handleDrop(event, { module: 'playlistContainer' });
    });

    expect(options.onAddTracks).toHaveBeenCalledTimes(1);
    const drafts = options.onAddTracks.mock.calls[0][0];
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toEqual(
      expect.objectContaining({
        path: '/valid.mp3',
        name: 'valid.mp3',
      }),
    );
    expect(options.onTracksAdded).toHaveBeenCalledWith(['/valid.mp3']);
    expect(isValidAudioFile).toHaveBeenCalledWith('/skip.txt');
  });

  it('handles mixed file and folder payloads for playlist items', async () => {
    const loadFolderTracks = jest.fn().mockResolvedValue(['/folder/song.mp3', '/folder/skip.txt']);
    const isValidAudioFile = jest.fn((path: string) => path.endsWith('.mp3'));
    const { result, options } = renderUsePlaylistDragAndDrop({
      loadFolderTracks,
      isValidAudioFile,
    });

    act(() => {
      result.current.handleDragOver(
        createMockDragEvent({ types: ['application/json'], clientY: 10 }),
        { module: 'playlistItem', targetId: '2' },
      );
    });

    await act(async () => {
      const event = createMockDragEvent({
        types: ['application/json'],
        data: {
          'application/json': JSON.stringify({
            type: 'fileBrowser',
            paths: ['/new/song.mp3'],
            directories: ['/folder'],
          }),
        },
      });
      result.current.handleDrop(event, { module: 'playlistItem', targetId: '2' });
      await flushPromises();
    });

    expect(options.onAddTracksAt).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          path: '/new/song.mp3',
        }),
      ],
      1,
    );

    expect(options.onAddTracksAt).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          path: '/folder/song.mp3',
        }),
      ],
      1,
    );

    expect(options.onTracksAdded).toHaveBeenNthCalledWith(1, ['/new/song.mp3']);
    expect(options.onTracksAdded).toHaveBeenNthCalledWith(2, ['/folder/song.mp3']);
    expect(loadFolderTracks).toHaveBeenCalledWith('/folder');
    expect(isValidAudioFile).toHaveBeenCalledWith('/folder/skip.txt');
  });
});
