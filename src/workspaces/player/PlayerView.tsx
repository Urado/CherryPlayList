import React, { useCallback, useMemo } from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isPlayerGroup, isPlayerTrack } from '@core/types/player';
import { WorkspaceId } from '@core/types/workspace';
import { useUIStore } from '@shared/stores';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';
import { usePlayerSessionStore } from '@shared/stores/playerSessionStore';
import { usePlayerSettingsStore } from '@shared/stores/playerSettingsStore';
import { usePlayerStore } from '@shared/stores/playerStore';
import { flattenItemsForDisplay, getTracksFromDisplayItems } from '@shared/utils/playerItemsUtils';

import { PlayerHeader } from './components/PlayerHeader';
import { PlayerTrackList } from './components/PlayerTrackList';
import { PlayerControls } from './PlayerControls';
import { usePlayerDividers } from './hooks/usePlayerDividers';
import { usePlayerDragAndDrop } from './hooks/usePlayerDragAndDrop';
import { usePlayerFileHandling } from './hooks/usePlayerFileHandling';
import { usePlayerSession } from './hooks/usePlayerSession';
import { usePlayerSettings } from './hooks/usePlayerSettings';

interface PlayerViewProps {
  workspaceId: WorkspaceId;
  zoneId: string;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ workspaceId: _workspaceId, zoneId }) => {
  const {
    items,
    selectedItemIds,
    selectAll,
    deselectAll,
    removeSelectedItems,
    createGroup,
    findItemById,
    updateTrackDuration,
    getAllTracksInOrder,
    getItemPath,
  } = usePlayerItemsStore((state) => state);

  const { name, setName } = usePlayerStore((state) => ({
    name: state.name,
    setName: state.setName,
  }));

  const displayItems = useMemo(() => flattenItemsForDisplay(items), [items]);

  const allTracks = useMemo(() => {
    return getTracksFromDisplayItems(displayItems);
  }, [displayItems]);

  const { isTrackPlayed, isGroupDisabled } = usePlayerSessionStore();
  const { plannedEndTime } = usePlayerSettingsStore();

  const isTrackOrGroupDisabled = useCallback(
    (itemId: string): boolean => {
      const { isTrackDisabled } = usePlayerSessionStore.getState();
      if (isTrackDisabled(itemId)) {
        return true;
      }
      const path = getItemPath(itemId);
      if (path.length > 1) {
        for (let i = path.length - 2; i >= 0; i--) {
          const groupId = path[i];
          const item = findItemById(groupId);
          if (item && isPlayerGroup(item) && isGroupDisabled(groupId)) {
            return true;
          }
        }
      }
      return false;
    },
    [getItemPath, findItemById, isGroupDisabled],
  );

  const isTrackActive = useCallback(
    (trackId: string): boolean => {
      return !isTrackPlayed(trackId) && !isTrackOrGroupDisabled(trackId);
    },
    [isTrackPlayed, isTrackOrGroupDisabled],
  );

  const fileHandling = usePlayerFileHandling({
    allTracks,
    updateTrackDuration,
  });

  const { playerDrag, handleDropWithGroups } = usePlayerDragAndDrop({
    allTracks,
    selectedItemIds,
    displayItems,
    items,
    handleAddTracks: fileHandling.handleAddTracks,
    handleAddTracksAt: fileHandling.handleAddTracksAt,
    loadDurationsForTracks: fileHandling.loadDurationsForTracks,
    processFilesToGroup: fileHandling.processFilesToGroup,
    processDirectoriesToGroup: fileHandling.processDirectoriesToGroup,
    processFilesToPosition: fileHandling.processFilesToPosition,
    processDirectoriesToPosition: fileHandling.processDirectoriesToPosition,
    processFilesToGroupAtPosition: fileHandling.processFilesToGroupAtPosition,
    processDirectoriesToGroupAtPosition: fileHandling.processDirectoriesToGroupAtPosition,
    zoneId,
  });

  const session = usePlayerSession({
    allTracks,
    isTrackActive,
    isTrackOrGroupDisabled,
    isTrackPlayed,
  });

  const { setEditingTrack, setEditingGroup, setEditingGlobal } = usePlayerSettings();

  const openModal = useUIStore((state) => state.openModal);

  const handleOpenTrackSettings = useCallback(
    (itemId: string) => {
      const item = findItemById(itemId);
      if (item) {
        if (isPlayerGroup(item)) {
          setEditingGroup(itemId);
        } else {
          setEditingTrack(itemId);
        }
        openModal('trackSettings');
      }
    },
    [openModal, setEditingTrack, setEditingGroup, findItemById],
  );

  const handleOpenGlobalSettings = useCallback(() => {
    setEditingGlobal(true);
    openModal('trackSettings');
  }, [openModal, setEditingGlobal]);

  const dividers = usePlayerDividers({
    allTracks,
    displayItems,
    isPlayerTrack: (item: { id: string }) => {
      const foundItem = findItemById(item.id);
      return foundItem ? isPlayerTrack(foundItem) : false;
    },
  });

  const hasSelectedItems = selectedItemIds.size > 0;

  const canRemoveSelectedItems = useMemo(() => {
    if (session.isPreparationMode) {
      return true;
    }
    return Array.from(selectedItemIds).every((itemId) => {
      const item = findItemById(itemId);
      if (!item) {
        return true;
      }
      if (isPlayerTrack(item)) {
        const trackIsPlayed = isTrackPlayed(itemId);
        const isCurrentTrack = itemId === session.activePlayerTrackId;
        return !trackIsPlayed && !isCurrentTrack;
      }
      if (isPlayerGroup(item)) {
        const groupTracks = getAllTracksInOrder([item]);
        return groupTracks.every((track) => {
          const trackIsPlayed = isTrackPlayed(track.id);
          const isCurrentTrack = track.id === session.activePlayerTrackId;
          return !trackIsPlayed && !isCurrentTrack;
        });
      }
      return true;
    });
  }, [
    session.isPreparationMode,
    session.activePlayerTrackId,
    selectedItemIds,
    findItemById,
    isTrackPlayed,
    getAllTracksInOrder,
  ]);

  const handleRemoveSelectedItems = useCallback(() => {
    if (!canRemoveSelectedItems) {
      return;
    }
    removeSelectedItems();
  }, [canRemoveSelectedItems, removeSelectedItems]);

  const { getEffectiveTrackSettings } = usePlayerSettings();

  const totalDuration = useMemo(() => {
    let total = 0;
    for (let i = 0; i < allTracks.length; i++) {
      const track = allTracks[i];
      if (isTrackOrGroupDisabled(track.id)) {
        continue;
      }
      total += track.duration || 0;
      if (i < allTracks.length - 1) {
        const settings = getEffectiveTrackSettings(track.id);
        if (settings.actionAfterTrack === 'pauseAndNext') {
          total += settings.pauseBetweenTracks;
        }
      }
    }
    return total;
  }, [allTracks, isTrackOrGroupDisabled, getEffectiveTrackSettings]);

  const areItemsConsecutive = useCallback(
    (itemIds: string[]): boolean => {
      if (itemIds.length < 2) return false;

      const indices = itemIds
        .map((id) => displayItems.findIndex((di) => di.item.id === id))
        .filter((idx) => idx !== -1)
        .sort((a, b) => a - b);

      if (indices.length !== itemIds.length) return false;

      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) {
          return false;
        }
      }

      return true;
    },
    [displayItems],
  );

  const handleCreateGroup = useCallback(() => {
    if (selectedItemIds.size < 2) return;

    const selectedIds = Array.from(selectedItemIds);
    if (!areItemsConsecutive(selectedIds)) return;

    try {
      createGroup(selectedIds);
      deselectAll();
    } catch (error) {
      console.error('Failed to create group', error);
    }
  }, [selectedItemIds, areItemsConsecutive, createGroup, deselectAll]);

  return (
    <div className="playlist-view player-view">
      <PlayerHeader
        name={name}
        onNameChange={setName}
        allTracksCount={allTracks.length}
        totalDuration={totalDuration}
        projectedEndTime={dividers.formatProjectedEndTime() || null}
        hasSelectedItems={hasSelectedItems}
        isPreparationMode={session.isPreparationMode}
        selectedItemIds={selectedItemIds}
        areItemsConsecutive={areItemsConsecutive}
        onDeselectAll={deselectAll}
        onSelectAll={selectAll}
        onCreateGroup={handleCreateGroup}
        onRemoveSelectedItems={handleRemoveSelectedItems}
        canRemoveSelectedItems={canRemoveSelectedItems}
        onStartSession={session.handleStartSession}
        onResetSession={session.handleResetSession}
        onOpenGlobalSettings={handleOpenGlobalSettings}
      />

      <div
        className="playlist-tracks"
        onDragOver={(e) =>
          playerDrag.handleDragOver(e, {
            module: 'playlistContainer',
            workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
            zoneId,
          })
        }
        onDragLeave={(e) => playerDrag.handleDragLeave(e)}
        onDragEnd={playerDrag.handleDragEnd}
        onDrop={(e) => {
          playerDrag.handleDrop(e, {
            module: 'playlistContainer',
            workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
            zoneId,
          });
        }}
      >
        <PlayerTrackList
          displayItems={displayItems}
          selectedItemIds={selectedItemIds}
          activeTrackId={session.activeTrackId ?? null}
          playerStatus={session.playerStatus}
          activePlayerTrackId={session.activePlayerTrackId ?? null}
          isPreparationMode={session.isPreparationMode}
          mode={session.mode}
          plannedEndTime={plannedEndTime}
          plannedEndDividerPosition={dividers.plannedEndDividerPosition}
          showHourDividers={dividers.showHourDividers}
          calculateDividerMarkers={dividers.calculateDividerMarkers}
          formatDividerLabel={dividers.formatDividerLabel}
          formatPlannedEndTimeLabel={dividers.formatPlannedEndTimeLabel}
          formatPlannedEndMarkerTime={dividers.formatPlannedEndMarkerTime}
          playerDrag={playerDrag as any}
          handleDropWithGroups={handleDropWithGroups}
          startTrackPlayback={session.startTrackPlayback}
          pausePlayback={session.pausePlayback}
          handleToggleDisabled={session.toggleTrackDisabled}
          handleOpenTrackSettings={handleOpenTrackSettings}
          zoneId={zoneId}
        />
      </div>

      <PlayerControls onNext={session.handleNext} />
    </div>
  );
};
