import { Track } from '../../core/types/track';

export type TrackDraft = Omit<Track, 'id'>;

function extractName(path: string): string {
  const segments = path.split(/[/\\]/);
  const fallback = 'Unknown';
  return segments[segments.length - 1] || fallback;
}

export function createTrackDraft(path: string): TrackDraft {
  return {
    path,
    name: extractName(path),
    duration: undefined,
  };
}

export function createTrackDrafts(paths: string[]): TrackDraft[] {
  return paths.map(createTrackDraft);
}
