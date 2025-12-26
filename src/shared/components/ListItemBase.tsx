import BlockIcon from '@mui/icons-material/Block';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React from 'react';

export interface ListItemBaseProps {
  // Базовые данные
  id: string;
  displayName: string;
  displaySecondary?: string; // длительность, размер и т.д.
  index?: number;

  // Иконка/префикс (для групп, папок и т.д.)
  prefixIcon?: React.ReactNode;

  // Состояния
  isSelected: boolean;
  isDragging: boolean;
  isDragOver?: boolean;
  insertPosition?: 'top' | 'bottom' | null;
  isActive?: boolean;
  isPlaying?: boolean;

  // Дополнительные состояния (опционально)
  isPlayed?: boolean;
  isDisabled?: boolean;
  isCurrent?: boolean;
  isLocked?: boolean;
  level?: number;

  // Callbacks
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onToggleDisabled?: (id: string) => void;

  // Feature flags
  showPlayButton?: boolean;
  showCheckbox?: boolean;
  showDragHandle?: boolean;
  showDeleteButton?: boolean;
  showDisableButton?: boolean;
  showIndex?: boolean;
  reserveIndexSpace?: boolean; // Резервировать место для индекса, даже если он не показывается

  // Custom slots
  customActions?: React.ReactNode;
  customContent?: React.ReactNode;

  // Styling
  className?: string;
  style?: React.CSSProperties;
  baseClassName?: string; // Базовый класс для стилей (по умолчанию 'playlist-item')
}

export const ListItemBase: React.FC<ListItemBaseProps> = ({
  id,
  displayName,
  displaySecondary,
  index,
  prefixIcon,
  isSelected,
  isDragging,
  isDragOver = false,
  insertPosition = null,
  isActive = false,
  isPlaying = false,
  isPlayed = false,
  isDisabled = false,
  isCurrent = false,
  isLocked = false,
  level = 0,
  onToggleSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPlay,
  onPause,
  onToggleDisabled,
  showPlayButton = true,
  showCheckbox = true,
  showDragHandle = true,
  showDeleteButton = true,
  showDisableButton = false,
  showIndex = true,
  reserveIndexSpace = true, // По умолчанию резервируем место для выравнивания
  customActions,
  customContent,
  className,
  style,
  baseClassName = 'playlist-item',
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleSelect(id);
    }
  };

  const handlePlayClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isActive && isPlaying && onPause) {
      onPause();
    } else if (onPlay) {
      onPlay();
    }
  };

  const computedClassName = [
    baseClassName,
    isSelected ? 'selected' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
    insertPosition ? `insert-${insertPosition}` : '',
    isPlayed ? `${baseClassName}--played` : '',
    isDisabled ? `${baseClassName}--disabled` : '',
    isCurrent ? `${baseClassName}--current` : '',
    level > 0 ? `${baseClassName}--level-${level}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleToggleDisabled = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onToggleDisabled) {
      onToggleDisabled(id);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    onDragStart(e, id);
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
    onDrop(e, id);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      onRemove(id);
    }
  };

  const computedStyle: React.CSSProperties = {
    ...(level > 0 ? { marginLeft: `calc(var(--spacing-md, 16px) * ${level})` } : {}),
    ...style,
  };

  return (
    <div
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={computedClassName}
      onClick={(e) => onToggleSelect(id, e)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      style={computedStyle}
    >
      {showPlayButton && onPlay && (
        <button
          type="button"
          className={`${baseClassName}-play ${isActive ? 'active' : ''}`}
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

      {prefixIcon && <div className={`${baseClassName}-prefix-icon`}>{prefixIcon}</div>}

      {showDragHandle && (
        <button
          type="button"
          className={`${baseClassName}-drag-handle`}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag item"
          style={{ visibility: isLocked ? 'hidden' : 'visible' }}
        >
          <DragIndicatorIcon className="drag-icon" />
        </button>
      )}

      {showCheckbox && (
        <button
          type="button"
          className={`${baseClassName}-checkbox ${isSelected ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(id, e);
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
      )}

      {(showIndex && index !== undefined && index >= 0) || reserveIndexSpace ? (
        <div className={`${baseClassName}-index`} style={showIndex && index !== undefined && index >= 0 ? undefined : { visibility: 'hidden' }}>
          {showIndex && index !== undefined && index >= 0 ? index + 1 : '\u200B'}
        </div>
      ) : null}

      {customContent || (
        <>
          <div className={`${baseClassName}-name`}>{displayName}</div>
          {displaySecondary && (
            <div className={`${baseClassName}-duration`}>{displaySecondary}</div>
          )}
        </>
      )}

      {customActions}

      {showDisableButton && onToggleDisabled && (
        <button
          type="button"
          className={`${baseClassName}-disable`}
          onClick={handleToggleDisabled}
          title={isDisabled ? 'Включить' : 'Отключить'}
          aria-label={isDisabled ? 'Включить' : 'Отключить'}
        >
          <BlockIcon style={{ fontSize: '18px' }} />
        </button>
      )}

      {showDeleteButton && (
        <button
          className={`${baseClassName}-delete`}
          onClick={handleRemove}
          aria-label="Delete item"
          style={{ visibility: isLocked ? 'hidden' : 'visible' }}
        >
          <DeleteIcon />
        </button>
      )}
    </div>
  );
};

