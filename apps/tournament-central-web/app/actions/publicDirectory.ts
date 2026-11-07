'use server';

import { updateTag } from 'next/cache';

import { PUBLIC_DIRECTORY_TAG } from '@/lib/publicDirectoryCache';

/**
 * Expires the cached homepage directory so the next visitor sees an organizer's change right away.
 * It only clears a cache (no data is read or written), so it needs no sign-in.
 */
export async function refreshPublicDirectory(): Promise<void> {
  updateTag(PUBLIC_DIRECTORY_TAG);
}
