// Re-export shared sort types so existing imports keep working
export type { SortConfig, SortDirection, SortableHeaderProps } from '../components/SortableHeader';

export type SortableScoreColumn =
  | 'firstName'
  | 'lastName'
  | 'lane'
  | 'average'
  | 'game1_scratch'
  | 'game1_total'
  | 'game2_scratch'
  | 'game2_total'
  | 'game3_scratch'
  | 'game3_total'
  | 'totalScratch'
  | 'totalWithHandicap';

export type RowSaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface ScoreEditHistory {
  playerId: number;
  field: string;
  previous: number | undefined;
}

export interface ScoreValidation {
  isValid: boolean;
  message: string;
}

export interface PlayerScoreStatus {
  label: 'Complete' | 'In Progress' | 'Not Started';
  tone: 'complete' | 'progress' | 'pending';
}
