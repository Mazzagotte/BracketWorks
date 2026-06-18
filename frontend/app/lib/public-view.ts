import { apiClient } from './api'
import { Tournament } from './types'

export function slugifyTournamentName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function preparePublicTournamentView(tournamentId: string): Promise<string> {
  const encodedId = encodeURIComponent(tournamentId)
  let tournament = await apiClient.get<Tournament>(`/api/v1/tournaments/${encodedId}`, false)

  if (!tournament.is_public) {
    tournament = await apiClient.put<Tournament>(`/api/v1/tournaments/${encodedId}`, {
      name: tournament.name,
      location: tournament.location ?? null,
      start_date: tournament.start_date ?? null,
      end_date: tournament.end_date ?? null,
      squad_times: tournament.squad_times ?? {},
      is_public: true,
    })
  }

  const slug = slugifyTournamentName(tournament.name || '')
  return `/view/${encodeURIComponent(slug || tournamentId)}`
}
