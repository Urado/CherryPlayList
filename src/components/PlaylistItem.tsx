import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React from 'react';

import { Track } from '../types/track';
import { formatTrackDuration } from '../utils/durationUtils';

interface PlaylistItemProps {
  track: Track;
  index: number;
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
}

export const PlaylistItem: React.FC<PlaylistItemProps> = ({
  track,
  index,
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
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleSelect(track.id);
    }
  };

  const handlePlayClick = (event: React.MouseEvent) => {
    event.stopPropagation();
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

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, track.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, track.id)}
      onDragEnd={onDragEnd}
      className={`playlist-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${insertPosition ? `insert-${insertPosition}` : ''}`}
      onClick={(e) => onToggleSelect(track.id, e)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
    >
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
      <button
        type="button"
        className="playlist-item-drag-handle"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag track"
      >
        <DragIndicatorIcon className="drag-icon" />
      </button>
      <button
        type="button"
        className={`playlist-item-checkbox ${isSelected ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(track.id, e);
        }}
        aria-pressed={isSelected}
        aria-label={isSelected ? 'Deselect track' : 'Select track'}
      >
        {isSelected ? (
          <CheckBoxIcon className="checkbox-icon" />
        ) : (
          <CheckBoxOutlineBlankIcon className="checkbox-icon" />
        )}
      </button>
      <div className="playlist-item-index">{index + 1}</div>
      <div className="playlist-item-name">{track.name}</div>
      <div className="playlist-item-duration">
        {track.duration ? formatTrackDuration(track.duration) : '--:--'}
      </div>
      <button
        className="playlist-item-delete"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(track.id);
        }}
        aria-label="Delete track"
      >
        <DeleteIcon />
      </button>
    </div>
  );
};
