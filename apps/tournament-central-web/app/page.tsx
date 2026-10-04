import type { PublicTournamentDirectoryResponse } from '@bracketworks/types';

import HomePageClient from './HomePageClient';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001')
  .replace(/\/+$/, '');

export const revalidate = 60;

async function loadInitialDirectory(): Promise<PublicTournamentDirectoryResponse | null> {
  try {
    const response = await fetch(`${backendUrl}/api/v1/public/tournaments?source=tc&limit=300`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return null;
    }

    return await response.json() as PublicTournamentDirectoryResponse;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const initialDirectory = await loadInitialDirectory();
  return <HomePageClient initialDirectory={initialDirectory} />;
}