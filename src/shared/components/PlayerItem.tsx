import FolderIcon from '@mui/icons-material/Folder';
import React, { useState, useRef, useEffect } from 'react';

import { PlayerItem as PlayerItemType, isPlayerGroup } from '../../core/types/player';
import { Track } from '../../core/types/track';
import { formatTrackDuration } from '../utils/durationUtils';
import { getGroupItemCount, getGroupTotalDuration } from '../utils/playerItemsUtils';

import { ListItemBase } from './ListItemBase';

interface PlayerItemProps {
  item: PlayerItemType; // Трек или группа
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
  groupDuration?: number; // Длительность группы с учетом пауз (если это группа)
  onRenameGroup?: (groupId: string, newName: string) => void; // Callback для переименования группы
}

export const PlayerItem: React.FC<PlayerItemProps> = ({
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
  groupDuration,
  onRenameGroup,
}) => {
  const isGroup = isPlayerGroup(item);
  const track = isGroup ? null : item;
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePlay = () => {
    if (!track) return;
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

  // Обработка начала редактирования имени группы
  const handleStartEdit = (e: React.MouseEvent) => {
    if (!isGroup || !onRenameGroup || isLocked) return;
    e.stopPropagation();
    setIsEditingName(true);
    setEditingName(item.name);
  };

  // Обработка сохранения имени
  const handleSaveName = () => {
    if (!isGroup || !onRenameGroup) return;
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== item.name) {
      onRenameGroup(item.id, trimmedName);
    }
    setIsEditingName(false);
  };

  // Обработка отмены редактирования
  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  // Обработка клавиатуры при редактировании
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Автофокус при начале редактирования
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Определяем отображаемое имя и длительность
  const groupDisplayName = isGroup
    ? `${item.name} (${getGroupItemCount(item)} ${getGroupItemCount(item) === 1 ? 'элемент' : 'элементов'})`
    : '';
  const trackDisplayName = track?.name || '';

  // Для групп используем переданную длительность с учетом пауз, если она есть, иначе базовую
  const displayDuration = isGroup
    ? groupDuration !== undefined && groupDuration > 0
      ? formatTrackDuration(groupDuration)
      : (() => {
          const baseDuration = getGroupTotalDuration(item);
          return baseDuration > 0 ? formatTrackDuration(baseDuration) : undefined;
        })()
    : track?.duration && track.duration > 0
      ? formatTrackDuration(track.duration)
      : undefined;

  const prefixIcon = isGroup ? (
    <div className="playlist-item-group-icon">
      <FolderIcon style={{ fontSize: '20px', color: 'var(--text-secondary)' }} />
    </div>
  ) : undefined;

  // Кастомный контент для группы с возможностью редактирования имени
  const customContent =
    isGroup && isEditingName ? (
      <>
        <div
          className="playlist-item-name"
          style={{ display: 'flex', alignItems: 'center', flex: 1 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleNameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="playlist-item-group-name-input"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: 'var(--font-size-body)',
              color: 'var(--text-primary)',
              outline: 'none',
              flex: 1,
              minWidth: 0,
            }}
          />
          <span style={{ marginLeft: '4px' }}>
            ({getGroupItemCount(item)} {getGroupItemCount(item) === 1 ? 'элемент' : 'элементов'})
          </span>
        </div>
        {displayDuration && <div className="playlist-item-duration">{displayDuration}</div>}
      </>
    ) : isGroup ? (
      <>
        <div
          className="playlist-item-name"
          onDoubleClick={handleStartEdit}
          style={{ cursor: onRenameGroup && !isLocked ? 'text' : 'default' }}
          title={onRenameGroup && !isLocked ? 'Двойной клик для переименования' : undefined}
        >
          {groupDisplayName}
        </div>
        {displayDuration && <div className="playlist-item-duration">{displayDuration}</div>}
      </>
    ) : undefined;

  return (
    <ListItemBase
      id={item.id}
      displayName={isGroup ? groupDisplayName : trackDisplayName}
      displaySecondary={displayDuration}
      index={index}
      prefixIcon={prefixIcon}
      isSelected={isSelected}
      isDragging={isDragging}
      isDragOver={isDragOver}
      insertPosition={insertPosition}
      isActive={isActive}
      isPlaying={isPlaying}
      isPlayed={isPlayed}
      isDisabled={isDisabled}
      isCurrent={isCurrent}
      isLocked={isLocked}
      level={level}
      onToggleSelect={onToggleSelect}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onPlay={handlePlay}
      onPause={handlePause}
      onToggleDisabled={onToggleDisabled}
      showPlayButton={!hidePlayButton && !!track}
      showCheckbox={true}
      showDragHandle={true}
      showDeleteButton={true}
      showDisableButton={showDisableButton}
      showIndex={!isGroup}
      customContent={customContent}
      customActions={settingsButton}
      className={isGroup ? 'playlist-item--group' : ''}
    />
  );
};
