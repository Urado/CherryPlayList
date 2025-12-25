import BlockIcon from '@mui/icons-material/Block';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FolderIcon from '@mui/icons-material/Folder';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React from 'react';

import { PlayerItem, isPlayerGroup } from '../../core/types/player';
import { Track } from '../../core/types/track';
import { formatTrackDuration } from '../utils/durationUtils';
import { getGroupItemCount, getGroupTotalDuration } from '../utils/playerItemsUtils';

interface PlaylistItemProps {
  item: PlayerItem; // Трек или группа
  index: number;
  level?: number; // Уровень вложенности (для визуального смещения)
  isSelected: boolean;
  isDragging: boolean;
  isDragOver?: boolean;
  insertPosition?: 'top' | 'bottom' | null;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (track: Track) => Promise<void> | void;
  onPause: () => void;
  hidePlayButton?: boolean;
  settingsButton?: React.ReactNode;
  isPlayed?: boolean;
  isDisabled?: boolean;
  isCurrent?: boolean;
  onToggleDisabled?: (itemId: string) => void;
  isLocked?: boolean; // Запрет на манипуляции (drag, delete)
  showDisableButton?: boolean; // Показывать ли кнопку отключения
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({
  item,
  index,
  level = 0,
  isSelected,
  isDragging,
  isDragOver = false,
  insertPosition = null,
  onToggleSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isActive,
  isPlaying,
  onPlay,
  onPause,
  hidePlayButton = false,
  settingsButton,
  isPlayed = false,
  isDisabled = false,
  isCurrent = false,
  onToggleDisabled,
  isLocked = false,
  showDisableButton = true,
}) => {
  const isGroup = isPlayerGroup(item);
  const track = isGroup ? null : item;
  const group = isGroup ? item : null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleSelect(item.id);
    }
  };

  const handlePlayClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!track) return; // Группы не воспроизводятся напрямую
    if (isActive && isPlaying) {
      onPause();
    } else {
      const maybePromise = onPlay(track);
      if (
        maybePromise &&
        typeof (maybePromise as Promise<void>).then === 'function' &&
        typeof (maybePromise as Promise<void>).catch === 'function'
      ) {
        (maybePromise as Promise<void>).catch(() => undefined);
      }
    }
  };

  const className = [
    'playlist-item',
    isSelected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
    insertPosition ? `insert-${insertPosition}` : '',
    isPlayed ? 'playlist-item--played' : '',
    isDisabled ? 'playlist-item--disabled' : '',
    isCurrent ? 'playlist-item--current' : '',
    isGroup ? 'playlist-item--group' : '',
    level > 0 ? `playlist-item--level-${level}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleToggleDisabled = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onToggleDisabled) {
      onToggleDisabled(item.id);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    onDragStart(e, item.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isLocked) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    onDragOver(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isLocked) {
      return;
    }
    onDrop(e, item.id);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      onRemove(item.id);
    }
  };

  // Определяем отображаемое имя и длительность
  const displayName = isGroup
    ? `${group.name} (${getGroupItemCount(group)} ${getGroupItemCount(group) === 1 ? 'элемент' : 'элементов'})`
    : track?.name || '';
  const displayDuration = isGroup
    ? formatTrackDuration(getGroupTotalDuration(group))
    : track?.duration
      ? formatTrackDuration(track.duration)
      : '--:--';

  return (
    <div
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={className}
      onClick={(e) => onToggleSelect(item.id, e)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      style={level > 0 ? { marginLeft: `calc(var(--spacing-md, 16px) * ${level})` } : undefined}
    >
      {!hidePlayButton && track && (
        <button
          type="button"
          className={`playlist-item-play ${isActive ? 'active' : ''}`}
          onClick={handlePlayClick}
          aria-label={isActive && isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
          {isActive && isPlaying ? (
            <PauseIcon fontSize="small" />
          ) : (
            <PlayArrowIcon fontSize="small" />
          )}
        </button>
      )}
      {isGroup && (
        <div className="playlist-item-group-icon" style={{ marginRight: '4px' }}>
          <FolderIcon style={{ fontSize: '20px', color: 'var(--text-secondary)' }} />
        </div>
      )}
      <button
        type="button"
        className="playlist-item-drag-handle"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag item"
        style={{ visibility: isLocked ? 'hidden' : 'visible' }}
      >
        <DragIndicatorIcon className="drag-icon" />
      </button>
      <button
        type="button"
        className={`playlist-item-checkbox ${isSelected ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(item.id, e);
        }}
        aria-pressed={isSelected}
        aria-label={isSelected ? 'Deselect item' : 'Select item'}
      >
        {isSelected ? (
          <CheckBoxIcon className="checkbox-icon" />
        ) : (
          <CheckBoxOutlineBlankIcon className="checkbox-icon" />
        )}
      </button>
      {!isGroup && <div className="playlist-item-index">{index >= 0 ? index + 1 : ''}</div>}
      <div className="playlist-item-name">{displayName}</div>
      <div className="playlist-item-duration">{displayDuration}</div>
      {settingsButton}
      {onToggleDisabled && showDisableButton && (
        <button
          type="button"
          className="playlist-item-disable"
          onClick={handleToggleDisabled}
          title={isDisabled ? (isGroup ? 'Включить группу' : 'Включить трек') : isGroup ? 'Отключить группу' : 'Отключить трек'}
          aria-label={isDisabled ? (isGroup ? 'Включить группу' : 'Включить трек') : isGroup ? 'Отключить группу' : 'Отключить трек'}
        >
          <BlockIcon style={{ fontSize: '18px' }} />
        </button>
      )}
      <button
        className="playlist-item-delete"
        onClick={handleRemove}
        aria-label="Delete item"
        style={{ visibility: isLocked ? 'hidden' : 'visible' }}
      >
        <DeleteIcon />
      </button>
    </div>
  );
};
