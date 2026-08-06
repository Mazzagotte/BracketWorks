export interface TournamentSummary {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed';
}
