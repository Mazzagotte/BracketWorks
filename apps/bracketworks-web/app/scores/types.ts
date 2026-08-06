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
