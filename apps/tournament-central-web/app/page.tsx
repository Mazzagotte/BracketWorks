import type { PublicTournamentDirectoryResponse } from '@bracketworks/types';

import HomePageClient from './HomePageClient';
import { PUBLIC_DIRECTORY_TAG } from '@/lib/publicDirectoryCache';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001')
  .replace(/\/+$/, '');

export const revalidate = 60;

async function loadInitialDirectory(): Promise<PublicTournamentDirectoryResponse | null> {
  try {
    const response = await fetch(`${backendUrl}/api/v1/public/tournaments?source=tc&limit=300`, {
      // Tagged so organizer changes expire it at once (app/actions/publicDirectory.ts); 60s is the fallback.
      next: { revalidate: 60, tags: [PUBLIC_DIRECTORY_TAG] },
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