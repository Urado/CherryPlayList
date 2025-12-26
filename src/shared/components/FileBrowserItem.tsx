import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import React from 'react';

import { ListItemBase } from './ListItemBase';

interface FileBrowserItemProps {
  id: string;
  name: string;
  size?: number;
  isDirectory: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isActive?: boolean;
  isPlaying?: boolean;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onPlay?: () => void;
  onPause?: () => void;
  showPlayButton?: boolean;
}

export const FileBrowserItem: React.FC<FileBrowserItemProps> = ({
  id,
  name,
  size,
  isDirectory,
  isSelected,
  isDragging,
  isActive = false,
  isPlaying = false,
  onToggleSelect,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  onPlay,
  onPause,
  showPlayButton = false,
}) => {
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    return `${kb.toFixed(1)} KB`;
  };

  const prefixIcon = isDirectory ? (
    <FolderIcon className="folder-icon" />
  ) : (
    <InsertDriveFileIcon className="file-icon" />
  );

  const customContent = (
    <>
      <div className="file-browser-item-info">
        <div className="file-browser-item-name">{name}</div>
        {!isDirectory && size && (
          <div className="file-browser-item-size">{formatFileSize(size)}</div>
        )}
      </div>
    </>
  );

  const customActions = showPlayButton && onPlay && (
    <div className="file-browser-item-actions">
      <button
        type="button"
        className={`file-browser-play-button ${isActive ? 'active' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          if (isPlaying && onPause) {
            onPause();
          } else if (onPlay) {
            onPlay();
          }
        }}
        title={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        {isPlaying ? (
          <PauseIcon fontSize="small" />
        ) : (
          <PlayArrowIcon fontSize="small" />
        )}
      </button>
    </div>
  );

  return (
    <div
      data-file-path={id}
      onDoubleClick={onDoubleClick}
      className="file-browser-item-wrapper"
    >
      <ListItemBase
        id={id}
        displayName={name}
        displaySecondary={!isDirectory && size ? formatFileSize(size) : undefined}
        prefixIcon={prefixIcon}
        isSelected={isSelected}
        isDragging={isDragging}
        isActive={isActive}
        isPlaying={isPlaying}
        onToggleSelect={onToggleSelect}
        onRemove={() => {}} // FileBrowser не поддерживает удаление через компонент
        onDragStart={onDragStart}
        onDragOver={() => {}} // FileBrowser не поддерживает drag over
        onDrop={() => {}} // FileBrowser не поддерживает drop
        onDragEnd={onDragEnd}
        onPlay={onPlay}
        onPause={onPause}
        showPlayButton={false} // Используем customActions
        showCheckbox={false} // FileBrowser использует свой механизм выбора
        showDragHandle={false} // FileBrowser использует свой drag
        showDeleteButton={false}
        showDisableButton={false}
        showIndex={false}
        customContent={customContent}
        customActions={customActions}
        baseClassName="file-browser-item"
      />
    </div>
  );
};

