'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, RefreshCw, SearchX, Share2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ICON_SIZE,
  NavItem,
  Page,
  PageHeader,
  SegmentedControl,
  TopNav,
  buttonClassName,
  topNavBrandClassName,
} from '@bracketworks/ui';
import type { StatusTone } from '@bracketworks/ui';

import type { LiveFinals, LiveStandings, LiveTournamentStatus } from './liveStandingsTypes';
import { useHasMounted } from './useLiveStandings';
import styles from './LiveShell.module.css';

/* The public live pages' shell (docs/ui-standards.md section 7a): top bar with the views and Share,
   the page header with status and "Updated", then the page's content and one footer line. Shared by
   the live standings page and the live finals page so both look and behave the same. */

/** How long TV mode shows each event, division, or finals group before moving on. */
export const TV_CYCLE_MS = 20_000;
export const EMPTY = '—';

export const STATUS_BADGE: Record<LiveTournamentStatus, { tone: StatusTone; label: string }> = {
  upcoming: { tone: 'info', label: 'Upcoming' },
  'in-progress': { tone: 'success', label: 'In progress' },
  final: { tone: 'neutral', label: 'Final' },
};

export const FINALS_BADGE: Record<LiveFinals['status'], { tone: StatusTone; label: string }> = {
  'not-started': { tone: 'neutral', label: 'Not started' },
  'in-progress': { tone: 'info', label: 'In progress' },
  complete: { tone: 'success', label: 'Complete' },
};

export function formatTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLocaleLowerCase() + value.slice(1) : value;
}

/** Adds `tv=1` to a live page link when the current page is in TV mode. */
export function withTv(href: string, tv: boolean): string {
  if (!tv) return href;
  return `${href}${href.includes('?') ? '&' : '?'}tv=1`;
}

function shareUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('tv');
  return url.toString();
}

function Brand() {
  return (
    <Link href="/" aria-label="Tournament Central home" className={topNavBrandClassName()}>
      <Image src="/TC_logo_No_Text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
      Tournament Central
    </Link>
  );
}

function Footer() {
  return <p className={styles.footer}>Powered by Tournament Central</p>;
}

export function LiveNotFound({ title = 'Live standings are not available' }: { title?: string }) {
  return (
    <div className={styles.shell}>
      <TopNav className={styles.topNav} brand={<Brand />} />
      <main id="main-content">
        <Page>
          <Card>
            <EmptyState
              icon={<SearchX size={ICON_SIZE['2xl']} aria-hidden="true" />}
              title={title}
              description="This tournament is not public, or the link is not correct."
              action={<Link href="/" className={buttonClassName({ variant: 'secondary' })}>Find a tournament</Link>}
            />
          </Card>
          <Footer />
        </Page>
      </main>
    </div>
  );
}

export type LiveNavItem<T extends string = string> = {
  value: T;
  label: string;
  /** A real link for views on another page; `#value` for views switched in place. */
  href: string;
};

export type LiveShellProps<T extends string> = {
  data: LiveStandings | null;
  tv: boolean;
  reconnecting: boolean;
  onRefresh: () => void;
  /** Top bar views. Shown when there are two or more. */
  views: Array<LiveNavItem<T>>;
  activeView: T;
  /** Switches views in place. Without it, views are links to other pages. */
  onViewChange?: (value: T) => void;
  /** Accessible name for the views ("Live standings views"). */
  viewsLabel: string;
  /** Share button's accessible name ("Share live standings"). */
  shareLabel: string;
  /** Header title before the first payload arrives. */
  fallbackTitle: string;
  /** Loading text before the first payload arrives. */
  loadingText: string;
  unavailableText: string;
  /** Page content once data has loaded. */
  children: ReactNode;
};

export function LiveShell<T extends string>({
  data,
  tv,
  reconnecting,
  onRefresh,
  views,
  activeView,
  onViewChange,
  viewsLabel,
  shareLabel,
  fallbackTitle,
  loadingText,
  unavailableText,
  children,
}: LiveShellProps<T>) {
  const mounted = useHasMounted();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  };

  const goTo = (value: T) => {
    if (onViewChange) {
      onViewChange(value);
      return;
    }
    const target = views.find((item) => item.value === value);
    if (target && value !== activeView) window.location.assign(target.href);
  };

  const tournament = data?.tournament;
  const status = tournament ? STATUS_BADGE[tournament.status] : null;
  const facts = tournament ? [tournament.dateText, tournament.locationText].filter(Boolean).join(' · ') : '';
  const updatedTime = mounted && data?.updatedAt ? formatTime(data.updatedAt) : null;
  const updatedText = data?.updatedAt ? (updatedTime ? `Updated ${updatedTime}` : 'Updated') : 'No scores yet';

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <TopNav
        className={styles.topNav}
        navLabel={viewsLabel}
        brand={<Brand />}
        actions={tv ? undefined : (
          <Button
            size="sm"
            variant="secondary"
            className={styles.share}
            icon={copied ? <Check size={ICON_SIZE.md} aria-hidden="true" /> : <Share2 size={ICON_SIZE.md} aria-hidden="true" />}
            aria-label={copied ? 'Link copied' : shareLabel}
            onClick={() => { void share(); }}
          >
            <span className={styles.shareLabel}>{copied ? 'Link copied' : 'Share'}</span>
          </Button>
        )}
      >
        {views.length > 1 ? views.map((item) => (
          <NavItem
            key={item.value}
            href={item.href}
            active={activeView === item.value}
            onClick={onViewChange ? (click) => { click.preventDefault(); onViewChange(item.value); } : undefined}
          >
            {item.label}
          </NavItem>
        )) : null}
      </TopNav>

      <main id="main-content">
        <Page>
          {views.length > 1 ? (
            <SegmentedControl
              label={viewsLabel}
              options={views.map((item) => ({ value: item.value, label: item.label }))}
              value={activeView}
              onChange={goTo}
              className={styles.phoneViews}
            />
          ) : null}

          <PageHeader
            title={tournament?.name ?? fallbackTitle}
            badge={status ? <Badge tone={status.tone}>{status.label}</Badge> : undefined}
            description={facts || undefined}
            actions={(
              <div className={styles.headerActions}>
                <span className={styles.updated}>{`${updatedText} · auto-refresh on`}</span>
                {reconnecting ? <span className={styles.updated} role="status">Reconnecting...</span> : null}
                {tv ? null : (
                  <Button size="sm" variant="ghost" icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />} onClick={onRefresh}>
                    Refresh
                  </Button>
                )}
              </div>
            )}
          />

          {data ? children : (
            <Card>
              <p className={styles.body} role="status">{reconnecting ? unavailableText : loadingText}</p>
            </Card>
          )}

          <Footer />
        </Page>
      </main>
    </div>
  );
}
