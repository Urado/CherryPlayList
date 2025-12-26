import ClearIcon from '@mui/icons-material/Clear';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ListIcon from '@mui/icons-material/List';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SettingsIcon from '@mui/icons-material/Settings';
import TimerIcon from '@mui/icons-material/Timer';
import React from 'react';

import { formatDuration } from '@shared/utils';

interface PlayerHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  allTracksCount: number;
  totalDuration: number;
  projectedEndTime: string | null;
  hasSelectedItems: boolean;
  isPreparationMode: boolean;
  selectedItemIds: Set<string>;
  areItemsConsecutive: (itemIds: string[]) => boolean;
  onDeselectAll: () => void;
  onSelectAll: () => void;
  onCreateGroup: () => void;
  onRemoveSelectedItems: () => void;
  canRemoveSelectedItems: boolean;
  onStartSession: () => void;
  onResetSession: () => void;
  onOpenGlobalSettings: () => void;
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  name,
  onNameChange,
  allTracksCount,
  totalDuration,
  projectedEndTime,
  hasSelectedItems,
  isPreparationMode,
  selectedItemIds,
  areItemsConsecutive,
  onDeselectAll,
  onSelectAll,
  onCreateGroup,
  onRemoveSelectedItems,
  canRemoveSelectedItems,
  onStartSession,
  onResetSession,
  onOpenGlobalSettings,
}) => {
  return (
    <div className="playlist-header-section">
      <div className="playlist-header-row">
        <input
          type="text"
          className="playlist-name-input-header"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Player"
        />
        {hasSelectedItems && (
          <>
            <button
              onClick={onDeselectAll}
              className="playlist-header-action-icon"
              title="Deselect All"
            >
              <ClearIcon style={{ fontSize: '20px' }} />
            </button>
            {isPreparationMode &&
              selectedItemIds.size >= 2 &&
              areItemsConsecutive(Array.from(selectedItemIds)) && (
                <button
                  onClick={onCreateGroup}
                  className="playlist-header-action-icon"
                  title="Создать группу"
                >
                  <GroupAddIcon style={{ fontSize: '20px' }} />
                </button>
              )}
            <button
              onClick={onRemoveSelectedItems}
              className="playlist-header-action-icon delete-button"
              disabled={!canRemoveSelectedItems}
              title={
                canRemoveSelectedItems
                  ? `Delete Selected (${selectedItemIds.size})`
                  : 'Нельзя удалить проигранные или текущий трек в режиме сессии'
              }
            >
              <DeleteSweepIcon style={{ fontSize: '20px' }} />
            </button>
          </>
        )}
        {!hasSelectedItems && allTracksCount > 0 && (
          <button onClick={onSelectAll} className="playlist-header-action-icon" title="Select All">
            <SelectAllIcon style={{ fontSize: '20px' }} />
          </button>
        )}
      </div>
      <div className="playlist-stats-header">
        <ListIcon style={{ fontSize: '18px', marginRight: '4px' }} />
        <span>{allTracksCount} треков</span>
        {allTracksCount > 0 && (
          <>
            <span style={{ margin: '0 8px' }}>•</span>
            <TimerIcon style={{ fontSize: '18px', marginRight: '4px' }} />
            <span>{formatDuration(totalDuration)}</span>
            {projectedEndTime !== null && (
              <>
                <span style={{ margin: '0 8px' }}>•</span>
                <span>Окончание: {projectedEndTime}</span>
              </>
            )}
          </>
        )}
      </div>

      <div className="player-header-actions">
        <div className="player-session-controls">
          {isPreparationMode ? (
            <button
              onClick={onStartSession}
              disabled={allTracksCount === 0}
              className="player-session-button player-session-button--start"
            >
              Начать сессию
            </button>
          ) : (
            <button
              onClick={onResetSession}
              className="player-session-button player-session-button--reset"
            >
              Сбросить
            </button>
          )}
        </div>

        <button
          onClick={onOpenGlobalSettings}
          className="player-settings-icon"
          title="Глобальные настройки"
        >
          <SettingsIcon style={{ fontSize: '20px' }} />
        </button>
      </div>
    </div>
  );
};

