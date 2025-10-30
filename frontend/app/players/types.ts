export type Player = { 
  id: number, 
  usbc?: string, 
  firstName: string, 
  lastName: string, 
  average: number, 
  handicap: number, 
  scratch: number, 
  lane: string, 
  division: string, 
  totalCost: number, 
  amountPaid: number, 
  squad?: { id: number, date: string, time: string } 
}

export type SavingStatus = 'idle' | 'saving' | 'success' | 'error';

export type SortDirection = 'asc' | 'desc' | null;

export type SortableColumn = 'name' | 'average' | 'handicap' | 'scratch' | 'lane' | 'totalCost' | 'amountPaid' | 'division';

export interface SortConfig {
  column: SortableColumn | null;
  direction: SortDirection;
}

export interface PlayersTableProps {
  players: Player[];
  onUpdatePlayer: (playerId: number, field: string, value: string | number) => void;
  onDeletePlayer: (playerId: number) => void;
  savingStatus: Record<string, SavingStatus>;
  entryFee: number;
  sortConfig: SortConfig;
  onSort: (column: SortableColumn) => void;
  selectedSquad?: Squad | null;
}

export interface Squad {
  id: number;
  name: string;
  tournament_id?: number;
  date?: string;
  time?: string;
}

export interface PlayerFormProps {
  onAddPlayer: (player: Omit<Player, 'id'>) => void;
  isLoading: boolean;
  squads: Squad[];
  entryFee: number;
}

export interface PlayersStatsProps {
  players: Player[];
  totalPlayers: number;
  isDemoMode: boolean;
}
