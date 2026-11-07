'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { liveStandingsPath } from './liveStandingsPaths';
import type { LiveStandings } from './liveStandingsTypes';

/** Poll interval while the tab is visible. */
export const LIVE_POLL_MS = 10_000;
/** Consecutive failed refreshes before the page says it is reconnecting. */
export const LIVE_FAILURES_BEFORE_NOTICE = 2;

export type LiveStandingsState = {
  data: LiveStandings | null;
  /** The tournament is missing or not public (404). */
  notFound: boolean;
  /** Two or more refreshes in a row failed; the last data stays on screen. */
  reconnecting: boolean;
  /** Fetch now (the Refresh button). */
  refresh: () => void;
};

/**
 * Keeps live standings current without flashing: polls every 10 seconds while the tab is visible,
 * pauses while hidden, refreshes as soon as the tab is shown again, and only replaces state when the
 * payload's `fingerprint` changes so unchanged rows never re-render.
 */
export function useLiveStandings(
  tournamentId: number,
  initialData: LiveStandings | null,
  { intervalMs = LIVE_POLL_MS, initialNotFound = false }: { intervalMs?: number; initialNotFound?: boolean } = {},
): LiveStandingsState {
  const [data, setData] = useState<LiveStandings | null>(initialData);
  const [notFound, setNotFound] = useState(initialNotFound);
  const [reconnecting, setReconnecting] = useState(false);
  const fingerprintRef = useRef<string | null>(initialData?.fingerprint ?? null);
  const failuresRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);
  const notFoundRef = useRef(initialNotFound);

  const markFailure = useCallback(() => {
    failuresRef.current += 1;
    if (failuresRef.current === LIVE_FAILURES_BEFORE_NOTICE) setReconnecting(true);
  }, []);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    const controller = new AbortController();
    inFlightRef.current = controller;
    try {
      const response = await fetch(liveStandingsPath(tournamentId), { cache: 'no-store', signal: controller.signal });
      if (response.status === 404) {
        if (!notFoundRef.current) {
          notFoundRef.current = true;
          setNotFound(true);
        }
        return;
      }
      if (!response.ok) {
        markFailure();
        return;
      }
      const next = (await response.json()) as LiveStandings;
      if (failuresRef.current >= LIVE_FAILURES_BEFORE_NOTICE) setReconnecting(false);
      failuresRef.current = 0;
      if (notFoundRef.current) {
        notFoundRef.current = false;
        setNotFound(false);
      }
      if (next && next.fingerprint !== fingerprintRef.current) {
        fingerprintRef.current = next.fingerprint;
        setData(next);
      }
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      markFailure();
    } finally {
      if (inFlightRef.current === controller) inFlightRef.current = null;
    }
  }, [tournamentId, markFailure]);

  useEffect(() => {
    // A missing or private tournament (known from the server render) has nothing to refresh.
    if (initialNotFound) return undefined;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => { void load(); }, intervalMs);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        void load();
        start();
      }
    };

    // No first payload from the server (the API was unreachable): fetch right away.
    if (fingerprintRef.current === null) void load();
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      inFlightRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [load, intervalMs, initialNotFound]);

  const refresh = useCallback(() => { void load(); }, [load]);

  return { data, notFound, reconnecting, refresh };
}

function subscribeToQuery(query: string) {
  return (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };
}

/** True when the media query matches. False on the server and in environments without matchMedia. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => subscribeToQuery(query)(onChange), [query]);
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** False during the server render and hydration, true afterwards (for browser-only text such as local times). */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
