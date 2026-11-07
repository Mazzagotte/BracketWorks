import { refreshPublicDirectory } from '@/app/actions/publicDirectory';

const DEBOUNCE_MS = 1500;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ask the homepage to drop its cached tournament list after an organizer creates, edits, publishes,
 * or deletes a tournament. Autosave can fire often, so calls within 1.5 seconds collapse into one.
 * Never throws: a missed refresh only means the homepage catches up on its normal short cache.
 */
export function requestPublicDirectoryRefresh(): void {
  if (typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void refreshPublicDirectory().catch(() => undefined);
  }, DEBOUNCE_MS);
}
