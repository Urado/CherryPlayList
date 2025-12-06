import React, { memo } from 'react';

import { WorkspaceZone } from '../types/layout';

import { CollectionView } from './CollectionView';
import { PlaylistView } from './PlaylistView';
import { SourcesPanel } from './SourcesPanel';
import { TestZone } from './TestZone';

interface WorkspaceRendererProps {
  zone: WorkspaceZone;
}

/**
 * Компонент для рендеринга workspace зон на основе типа
 */
const WorkspaceRendererComponent: React.FC<WorkspaceRendererProps> = ({ zone }) => {
  switch (zone.workspaceType) {
    case 'playlist':
      return <PlaylistView zoneId={zone.id} />;

    case 'collection':
      return <CollectionView workspaceId={zone.workspaceId} zoneId={zone.id} />;

    case 'fileBrowser':
      return (
        <>
          <h2 className="panel-title">Источники</h2>
          <SourcesPanel />
        </>
      );

    case 'test1':
      return <TestZone zoneId={zone.id} label="Test Zone 1" />;

    case 'test2':
      return <TestZone zoneId={zone.id} label="Test Zone 2" />;

    case 'test3':
      return <TestZone zoneId={zone.id} label="Test Zone 3" />;

    case 'test4':
      return <TestZone zoneId={zone.id} label="Test Zone 4" />;

    case 'test5':
      return <TestZone zoneId={zone.id} label="Test Zone 5" />;

    case 'test6':
      return <TestZone zoneId={zone.id} label="Test Zone 6" />;

    case 'test7':
      return <TestZone zoneId={zone.id} label="Test Zone 7" />;

    case 'test8':
      return <TestZone zoneId={zone.id} label="Test Zone 8" />;

    default:
      return (
        <div className="empty-state">
          <p>Unknown workspace type: {zone.workspaceType}</p>
        </div>
      );
  }
};

export const WorkspaceRenderer = memo(WorkspaceRendererComponent);

WorkspaceRenderer.displayName = 'WorkspaceRenderer';
