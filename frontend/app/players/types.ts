import { BracketProgramDefinition, SidePot, SidePotsSettings } from '../lib/types';

export type { SidePot, SidePotsSettings };

export type Player = { 
  id: number, 
  usbc?: string, 
  firstName: string, 
  lastName: string, 
  division?: string,
  average: number, 
  handicap: number, 
  scratch: number, 
  bracketEntries: Record<string, number>,
  sidePotEntries?: Record<string, boolean>,
  lane: string, 
  totalCost: number, 
  amountPaid: number, 
  squad?: { id: number, date: string, time: string } 
}

export type SavingStatus = 'idle' | 'saving' | 'success' | 'error';

export type SortDirection = 'asc' | 'desc' | null;

export type SortableColumn = 'name' | 'average' | 'handicap' | 'scratch' | 'lane' | 'totalCost' | 'amountPaid';

export interface SortConfig {
  column: SortableColumn | null;
  direction: SortDirection;
}

export interface PlayersTableProps {
  players: Player[];
  onUpdatePlayer: (playerId: number, field: string, value: string | number | boolean) => void;
  onDeletePlayer: (playerId: number) => void;
  savingStatus: Record<string, SavingStatus>;
  entryFee: number;
  bracketPrograms: BracketProgramDefinition[];
  selectedSquad?: Squad | null;
  sidePots?: SidePotsSettings | null;
}

export interface Squad {
  id: number;
  name: string;
  tournament_id?: number;
  date?: string;
  time?: string;
}

export interface PlayerFormProps {
  onAddPlayer: (player: Omit<Player, 'id'>) => Promise<void> | void;
  isLoading: boolean;
  squads: Squad[];
  entryFee: number;
  bracketPrograms: BracketProgramDefinition[];
}

export interface PlayersStatsProps {
  players: Player[];
  totalPlayers: number;
  isDemoMode: boolean;
}
