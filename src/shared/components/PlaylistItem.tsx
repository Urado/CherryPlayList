import React from 'react';

import { Track } from '../../core/types/track';
import { formatTrackDuration } from '../utils/durationUtils';
import { ListItemBase } from './ListItemBase';

interface PlaylistItemProps {
  track: Track; // Только трек (плейлист не поддерживает группы)
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
  const handlePlay = () => {
    const maybePromise = onPlay(track);
    if (
      maybePromise &&
      typeof (maybePromise as Promise<void>).then === 'function' &&
      typeof (maybePromise as Promise<void>).catch === 'function'
    ) {
      (maybePromise as Promise<void>).catch(() => undefined);
    }
  };

  const handlePause = () => {
    onPause();
  };

  const displayName = track?.name || '';
  const displayDuration = track?.duration ? formatTrackDuration(track.duration) : '--:--';

  return (
    <ListItemBase
      id={track.id}
      displayName={displayName}
      displaySecondary={displayDuration}
      index={index}
      isSelected={isSelected}
      isDragging={isDragging}
      isDragOver={isDragOver}
      insertPosition={insertPosition}
      isActive={isActive}
      isPlaying={isPlaying}
      onToggleSelect={onToggleSelect}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onPlay={handlePlay}
      onPause={handlePause}
      showPlayButton={true}
      showCheckbox={true}
      showDragHandle={true}
      showDeleteButton={true}
      showDisableButton={false}
      showIndex={true}
    />
  );
};
