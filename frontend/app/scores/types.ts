export type SortDirection = 'asc' | 'desc' | null;

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

export interface SortConfig {
  column: SortableScoreColumn | null;
  direction: SortDirection;
}

export interface SortableHeaderProps {
  column: SortableScoreColumn;
  children: React.ReactNode;
  sortConfig: SortConfig;
  onSort: (column: SortableScoreColumn) => void;
  align?: 'left' | 'center' | 'right';
  width?: string;
}