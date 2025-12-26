import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import React from 'react';

import { ListItemBase, ListItemBaseProps } from './ListItemBase';

export interface GroupHeaderProps extends Omit<ListItemBaseProps, 'displayName' | 'displaySecondary' | 'showPlayButton' | 'showIndex'> {
  groupName: string;
  itemCount: number;
  totalDuration?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showExpandButton?: boolean;
}

export const GroupHeader: React.FC<GroupHeaderProps> = ({
  groupName,
  itemCount,
  totalDuration,
  isExpanded = true,
  onToggleExpand,
  showExpandButton = true,
  id,
  isSelected,
  isDragging,
  isDragOver,
  insertPosition,
  isPlayed,
  isDisabled,
  isCurrent,
  isLocked,
  level = 0,
  onToggleSelect,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleDisabled,
  showCheckbox = true,
  showDragHandle = true,
  showDeleteButton = true,
  showDisableButton = false,
  customActions,
  className,
  style,
  baseClassName = 'playlist-item',
}) => {
  const displayName = `${groupName} (${itemCount} ${itemCount === 1 ? 'элемент' : 'элементов'})`;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand();
    }
  };

  const prefixIcon = showExpandButton ? (
    <button
      type="button"
      className="group-header-expand-button"
      onClick={handleToggleExpand}
      aria-label={isExpanded ? 'Свернуть группу' : 'Развернуть группу'}
    >
      {isExpanded ? (
        <ExpandLessIcon style={{ fontSize: '20px' }} />
      ) : (
        <ExpandMoreIcon style={{ fontSize: '20px' }} />
      )}
    </button>
  ) : (
    <div className="playlist-item-group-icon">
      <FolderIcon style={{ fontSize: '20px', color: 'var(--text-secondary)' }} />
    </div>
  );

  const computedClassName = [
    baseClassName,
    'playlist-item--group',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ListItemBase
      id={id}
      displayName={displayName}
      displaySecondary={totalDuration}
      prefixIcon={prefixIcon}
      isSelected={isSelected}
      isDragging={isDragging}
      isDragOver={isDragOver}
      insertPosition={insertPosition}
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
      onToggleDisabled={onToggleDisabled}
      showPlayButton={false}
      showCheckbox={showCheckbox}
      showDragHandle={showDragHandle}
      showDeleteButton={showDeleteButton}
      showDisableButton={showDisableButton}
      showIndex={false}
      customActions={customActions}
      className={computedClassName}
      style={style}
      baseClassName={baseClassName}
    />
  );
};

