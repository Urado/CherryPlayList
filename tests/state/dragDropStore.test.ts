import { useDragDropStore } from '../../src/state/dragDropStore';
import {
  ensureTrackWorkspaceStore,
  removeTrackWorkspaceStore,
} from '../../src/state/trackWorkspaceStoreFactory';
import { useUIStore } from '../../src/state/uiStore';

type TestTrack = {
  id: string;
  path: string;
  name: string;
  duration?: number;
};

const createTrack = (id: string, name: string): TestTrack => ({
  id,
  path: `/music/${name}.mp3`,
  name: `${name}.mp3`,
  duration: 120,
});

describe('dragDropStore cross-workspace operations', () => {
  const SOURCE = 'drag-source-workspace';
  const TARGET = 'drag-target-workspace';
  let notificationMock: jest.Mock;

  beforeEach(() => {
    notificationMock = jest.fn();
    useUIStore.setState((state) => ({
      ...state,
      addNotification: notificationMock,
    }));
  });

  afterEach(() => {
    removeTrackWorkspaceStore(SOURCE);
    removeTrackWorkspaceStore(TARGET);
  });

  it('moves tracks between workspaces and inserts at target index', () => {
    const sourceStore = ensureTrackWorkspaceStore({
      workspaceId: SOURCE,
      initialName: 'Source',
      maxTracks: null,
    });
    const targetStore = ensureTrackWorkspaceStore({
      workspaceId: TARGET,
      initialName: 'Target',
      maxTracks: null,
    });

    sourceStore.setState({
      ...sourceStore.getState(),
      tracks: [createTrack('s-1', 'alpha'), createTrack('s-2', 'beta')],
    });

    targetStore.setState({
      ...targetStore.getState(),
      tracks: [createTrack('t-1', 'original')],
    });

    const result = useDragDropStore
      .getState()
      .moveTracksBetweenWorkspaces(['s-1'], SOURCE, TARGET, 1);

    expect(result).toBe(true);
    expect(notificationMock).not.toHaveBeenCalled();

    const updatedSource = sourceStore.getState().tracks.map((track) => track.path);
    expect(updatedSource).toEqual(['/music/beta.mp3']);

    const updatedTarget = targetStore.getState().tracks.map((track) => track.path);
    expect(updatedTarget).toEqual(['/music/original.mp3', '/music/alpha.mp3']);
  });

  it('rejects move when target workspace is full and notifies user', () => {
    const sourceStore = ensureTrackWorkspaceStore({
      workspaceId: SOURCE,
      maxTracks: null,
    });
    const targetStore = ensureTrackWorkspaceStore({
      workspaceId: TARGET,
      maxTracks: 1,
    });

    sourceStore.setState({
      ...sourceStore.getState(),
      tracks: [createTrack('s-1', 'alpha')],
    });

    targetStore.setState({
      ...targetStore.getState(),
      tracks: [createTrack('t-1', 'occupied')],
    });

    const result = useDragDropStore.getState().moveTracksBetweenWorkspaces(['s-1'], SOURCE, TARGET);

    expect(result).toBe(false);
    expect(notificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('target workspace is full'),
      }),
    );

    expect(sourceStore.getState().tracks).toHaveLength(1);
    expect(targetStore.getState().tracks).toHaveLength(1);
  });

  it('copies tracks without removing them from the source workspace', () => {
    const sourceStore = ensureTrackWorkspaceStore({
      workspaceId: SOURCE,
      maxTracks: null,
    });
    const targetStore = ensureTrackWorkspaceStore({
      workspaceId: TARGET,
      maxTracks: null,
    });

    sourceStore.setState({
      ...sourceStore.getState(),
      tracks: [createTrack('s-1', 'alpha')],
    });

    const result = useDragDropStore.getState().copyTracksBetweenWorkspaces(['s-1'], SOURCE, TARGET);

    expect(result).toBe(true);
    expect(sourceStore.getState().tracks).toHaveLength(1);
    expect(targetStore.getState().tracks.map((t) => t.path)).toEqual(['/music/alpha.mp3']);
  });

  it('notifies when workspaces are missing', () => {
    ensureTrackWorkspaceStore({ workspaceId: SOURCE });

    const result = useDragDropStore
      .getState()
      .moveTracksBetweenWorkspaces(['missing'], SOURCE, TARGET);

    expect(result).toBe(false);
    expect(notificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Cannot move tracks: workspace not found',
      }),
    );
  });
});
