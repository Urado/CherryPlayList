import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

import { DEFAULT_PLAYER_WORKSPACE_ID } from '@core/constants/workspace';
import { isPlayerGroup, isPlayerTrack, PlayerItem as PlayerItemType } from '@core/types/player';
import { Track } from '@core/types/track';
import { PlayerItem } from '@shared/components';
import { usePlayerItemsStore } from '@shared/stores/playerItemsStore';
import { usePlayerSessionStore } from '@shared/stores/playerSessionStore';
import { formatTimeFromTimestamp } from '../dividerUtils';
import { usePlayerSettings } from '../hooks/usePlayerSettings';

interface PlayerTrackListProps {
  displayItems: Array<{ item: PlayerItemType; level: number; displayIndex: number }>;
  selectedItemIds: Set<string>;
  activeTrackId: string | null;
  playerStatus: string;
  activePlayerTrackId: string | null;
  isPreparationMode: boolean;
  mode: 'preparation' | 'session';
  plannedEndTime: number | null;
  plannedEndDividerPosition: number | null;
  showHourDividers: boolean;
  calculateDividerMarkers: Map<string, number | null>;
  formatDividerLabel: (trackId: string) => string;
  formatPlannedEndTimeLabel: () => string;
  formatPlannedEndMarkerTime: () => string;
  playerDrag: {
    draggedItems?: { type: string; ids?: Set<string>; paths?: string[] } | null;
    dragOverId: string | null;
    insertPosition: 'top' | 'bottom' | null;
    handleDragStart: (e: React.DragEvent, id: string) => void;
    handleDragOver: (
      e: React.DragEvent,
      options: {
        module: string;
        targetId?: string;
        workspaceId: string;
        zoneId: string;
      },
    ) => void;
    handleDragEnd: () => void;
    handleDragLeave?: (e: React.DragEvent) => void;
    handleDrop?: (e: React.DragEvent, context: unknown) => void;
  };
  handleDropWithGroups: (e: React.DragEvent, targetItemId: string) => void;
  startTrackPlayback: (track: Track) => void;
  pausePlayback: () => void;
  handleToggleDisabled: (itemId: string) => void;
  handleOpenTrackSettings: (itemId: string) => void;
  zoneId: string;
}

export const PlayerTrackList: React.FC<PlayerTrackListProps> = ({
  displayItems,
  selectedItemIds,
  activeTrackId,
  playerStatus,
  activePlayerTrackId,
  isPreparationMode,
  mode,
  plannedEndTime,
  plannedEndDividerPosition,
  showHourDividers,
  calculateDividerMarkers,
  formatDividerLabel,
  formatPlannedEndTimeLabel,
  formatPlannedEndMarkerTime,
  playerDrag,
  handleDropWithGroups,
  startTrackPlayback,
  pausePlayback,
  handleToggleDisabled,
  handleOpenTrackSettings,
  zoneId,
}) => {
  const {
    toggleItemSelection,
    selectRange,
    removeItem,
    setGroupName,
    getAllTracksInOrder,
    findItemById,
  } = usePlayerItemsStore((state) => ({
    toggleItemSelection: state.toggleItemSelection,
    selectRange: state.selectRange,
    removeItem: state.removeItem,
    setGroupName: state.setGroupName,
    getAllTracksInOrder: state.getAllTracksInOrder,
    findItemById: state.findItemById,
  }));

  const { isTrackPlayed, isGroupDisabled, isTrackDisabled } = usePlayerSessionStore();
  const { getEffectiveTrackSettings, getTrackSettings, getGroupSettings } = usePlayerSettings();
  const { getItemPath } = usePlayerItemsStore((state) => ({
    getItemPath: state.getItemPath,
  }));

  const isTrackOrGroupDisabled = (itemId: string): boolean => {
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
  };

  if (displayItems.length === 0) {
    return (
      <div className="empty-state">
        <p>Player is empty</p>
        <p className="empty-state-hint">Перетащите треки сюда для воспроизведения</p>
      </div>
    );
  }

  return (
    <>
      {displayItems.map((displayItem, displayItemIndex) => {
        const { item, level, displayIndex } = displayItem;
        const isGroup = isPlayerGroup(item);
        const track = isPlayerTrack(item) ? item : null;

        const isDraggedTrack =
          playerDrag.draggedItems?.type === 'tracks' &&
          playerDrag.draggedItems.ids?.has(item.id) === true;
        const showInsertLine =
          playerDrag.dragOverId === item.id && playerDrag.insertPosition !== null;
        const isActive = activeTrackId === item.id;
        const isPlaying = isActive && playerStatus === 'playing';

        const showPlannedEndDividerBeforeActive =
          !isPreparationMode &&
          plannedEndTime !== null &&
          plannedEndDividerPosition === -1 &&
          isActive &&
          track !== null;

        const hasPlannedEndDivider =
          !isPreparationMode &&
          plannedEndTime !== null &&
          plannedEndDividerPosition === displayItemIndex;
        const showDivider =
          showHourDividers &&
          isPlayerTrack(item) &&
          track !== null &&
          calculateDividerMarkers.has(track.id) &&
          !hasPlannedEndDivider;
        const dividerTime = track ? (calculateDividerMarkers.get(track.id) ?? null) : null;

        let hasCustomSettings = false;
        let settingsActionAfterTrack: string | null = null;
        if (isGroup) {
          const groupSettings = getGroupSettings(item.id);
          hasCustomSettings =
            groupSettings.actionAfterTrack !== null &&
            groupSettings.actionAfterTrack !== undefined;
          settingsActionAfterTrack = groupSettings.actionAfterTrack || null;
        } else if (track) {
          const trackSettings = getTrackSettings(track.id);
          hasCustomSettings =
            trackSettings.actionAfterTrack !== null &&
            trackSettings.actionAfterTrack !== undefined;
          settingsActionAfterTrack = trackSettings.actionAfterTrack || null;
        }

        let itemIsPlayed = false;
        let itemIsDisabled = false;
        if (isGroup) {
          const groupTracks = getAllTracksInOrder([item]);
          itemIsPlayed = groupTracks.length > 0 && groupTracks.every((t) => isTrackPlayed(t.id));
          itemIsDisabled = isGroupDisabled(item.id);
        } else if (track) {
          itemIsPlayed = isTrackPlayed(track.id);
          itemIsDisabled = isTrackOrGroupDisabled(track.id);
        }

        const isCurrentTrack = track?.id === activePlayerTrackId;
        const isLocked =
          !isPreparationMode &&
          (itemIsPlayed ||
            isCurrentTrack ||
            (isGroup &&
              getAllTracksInOrder([item]).some(
                (t) => isTrackPlayed(t.id) || t.id === activePlayerTrackId,
              )));

        let groupDurationWithPauses: number | undefined = undefined;
        if (isGroup) {
          const groupTracks = getAllTracksInOrder([item]);
          let total = 0;
          for (let i = 0; i < groupTracks.length; i++) {
            const groupTrack = groupTracks[i];
            total += groupTrack.duration || 0;
            const settings = getEffectiveTrackSettings(groupTrack.id);
            if (settings.actionAfterTrack === 'pauseAndNext') {
              total += settings.pauseBetweenTracks || 0;
            }
          }
          const hasAnyDuration = groupTracks.some((t) => t.duration && t.duration > 0);
          groupDurationWithPauses = hasAnyDuration ? total : undefined;
        }

        return (
          <React.Fragment key={item.id}>
            {showInsertLine && playerDrag.insertPosition === 'top' && (
              <div className="drag-insert-line" />
            )}
            {showPlannedEndDividerBeforeActive && (
              <div className="playlist-hour-divider playlist-hour-divider--planned-end">
                <span className="playlist-hour-divider-label">
                  {formatPlannedEndTimeLabel()}
                </span>
              </div>
            )}
            <PlayerItem
              item={item}
              index={displayIndex}
              level={level}
              isSelected={selectedItemIds.has(item.id)}
              isDragging={isDraggedTrack}
              isDragOver={playerDrag.dragOverId === item.id && !isDraggedTrack}
              insertPosition={
                playerDrag.dragOverId === item.id && !isDraggedTrack
                  ? playerDrag.insertPosition
                  : null
              }
              onToggleSelect={(id, event) => {
                if (event?.ctrlKey || event?.metaKey) {
                  toggleItemSelection(id);
                } else if (event?.shiftKey && selectedItemIds.size > 0) {
                  const lastSelected = Array.from(selectedItemIds).pop();
                  if (lastSelected) {
                    selectRange(lastSelected, id);
                  } else {
                    toggleItemSelection(id);
                  }
                } else {
                  toggleItemSelection(id);
                }
              }}
              onRemove={removeItem}
              onDragStart={(e) => playerDrag.handleDragStart(e, item.id)}
              onDragOver={(e) => {
                if (isLocked) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'none';
                  return;
                }
                playerDrag.handleDragOver(e, {
                  module: 'playlistItem',
                  targetId: item.id,
                  workspaceId: DEFAULT_PLAYER_WORKSPACE_ID,
                  zoneId,
                });
              }}
              onDrop={(e) => {
                if (isLocked) {
                  e.preventDefault();
                  return;
                }
                handleDropWithGroups(e, item.id);
              }}
              onDragEnd={playerDrag.handleDragEnd}
              isActive={isActive}
              isPlaying={isPlaying}
              onPlay={startTrackPlayback}
              onPause={pausePlayback}
              hidePlayButton={!isPreparationMode || isGroup}
              isPlayed={itemIsPlayed}
              isDisabled={itemIsDisabled}
              isCurrent={isCurrentTrack}
              onToggleDisabled={handleToggleDisabled}
              isLocked={isLocked}
              showDisableButton={!isPreparationMode}
              groupDuration={groupDurationWithPauses}
              onRenameGroup={setGroupName}
              settingsButton={
                <button
                  className="playlist-item-settings"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenTrackSettings(item.id);
                  }}
                  title={isGroup ? 'Настройки группы' : 'Настройки трека'}
                >
                  <SettingsIcon style={{ fontSize: '18px' }} />
                  {hasCustomSettings && settingsActionAfterTrack && (
                    <span className="player-settings-indicator">
                      {settingsActionAfterTrack === 'pause'
                        ? '⏸'
                        : settingsActionAfterTrack === 'pauseAndNext'
                          ? '⏸⏭'
                          : '⏭'}
                    </span>
                  )}
                </button>
              }
            />
            {showInsertLine && playerDrag.insertPosition === 'bottom' && (
              <div className="drag-insert-line" />
            )}
            {showDivider && track && (
              <div className="playlist-hour-divider">
                <span className="playlist-hour-divider-label">
                  {mode === 'session' &&
                  dividerTime !== undefined &&
                  dividerTime !== null &&
                  dividerTime > 0
                    ? formatTimeFromTimestamp(dividerTime)
                    : formatDividerLabel(track.id)}
                </span>
              </div>
            )}
            {hasPlannedEndDivider && (
              <div className="playlist-hour-divider playlist-hour-divider--planned-end">
                <span className="playlist-hour-divider-label">
                  {mode === 'session' ? formatPlannedEndMarkerTime() : formatPlannedEndTimeLabel()}
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}
      {!isPreparationMode &&
        plannedEndTime !== null &&
        plannedEndDividerPosition === null &&
        displayItems.length > 0 && (
          <div className="playlist-hour-divider playlist-hour-divider--planned-end">
            <span className="playlist-hour-divider-label">{formatPlannedEndTimeLabel()}</span>
          </div>
        )}
    </>
  );
};

