"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import USAMap from 'react-usa-map';
import styles from './page.module.css';

type TournamentStatus = 'UPCOMING' | 'IN PROGRESS' | 'PAST RESULTS';
type StateTab = 'UPCOMING' | 'IN PROGRESS' | 'PAST RESULTS';

type Tournament = {
  id: string;
  name: string;
  date: string;
  startDate: Date | null;
  endDate: Date | null;
  venue: string;
  city: string;
  stateCode: string;
  status: TournamentStatus;
};

type StateSummary = {
  stateCode: string;
  stateName: string;
  tournaments: Tournament[];
  centerCount: number;
};

type PublicTournamentSummary = {
  id: number;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
};

type PublicTournamentDirectoryResponse = {
  tournaments?: PublicTournamentSummary[];
};

type MapStateTone = 'upcoming' | 'inprogress' | 'past' | 'none';

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const STATE_NICKNAME_BY_CODE: Partial<Record<string, string>> = {
  ID: 'Gem State',
};

const tabOrder: StateTab[] = ['UPCOMING', 'IN PROGRESS', 'PAST RESULTS'];

const statusLabel: Record<TournamentStatus, string> = {
  UPCOMING: 'Upcoming',
  'IN PROGRESS': 'In Progress',
  'PAST RESULTS': 'Past Results',
};

function getBadgeClass(status: TournamentStatus): string {
  if (status === 'UPCOMING') {
    return styles.badgeUpcoming;
  }

  if (status === 'IN PROGRESS') {
    return styles.badgeInProgress;
  }

  return styles.badgePast;
}

function getStateToneFromSummary(summary: StateSummary | undefined): MapStateTone {
  const tournaments = summary?.tournaments ?? [];

  if (tournaments.some((tournament) => tournament.status === 'IN PROGRESS')) {
    return 'inprogress';
  }

  if (tournaments.some((tournament) => tournament.status === 'UPCOMING')) {
    return 'upcoming';
  }

  if (tournaments.length > 0) {
    return 'past';
  }

  return 'none';
}

function getToneFill(tone: MapStateTone, isSelected: boolean): string {
  if (isSelected) {
    return '#ff8a12';
  }

  return '#515866';
}

function parseLocation(location: string | null): { venue: string; city: string; stateCode: string } {
  if (!location) {
    return { venue: 'Venue TBA', city: 'Unknown', stateCode: 'ID' };
  }

  const pieces = location.split(',').map((piece) => piece.trim()).filter(Boolean);
  const maybeState = pieces.at(-1)?.toUpperCase() ?? '';
  const stateCode = /^[A-Z]{2}$/.test(maybeState) ? maybeState : 'ID';
  const city = pieces.length > 1 ? pieces[pieces.length - 2] : pieces[0] ?? 'Unknown';
  const venue = pieces[0] ?? 'Venue TBA';

  return { venue, city, stateCode };
}

function formatDateRange(startDate: Date | null, endDate: Date | null): string {
  if (!startDate && !endDate) {
    return 'Date TBA';
  }

  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (startDate && endDate) {
    return `${fmt.format(startDate)} - ${fmt.format(endDate)}`;
  }

  return fmt.format(startDate ?? endDate ?? new Date());
}

function getTournamentStatus(startDate: Date | null, endDate: Date | null): TournamentStatus {
  const now = new Date();
  if (!startDate && !endDate) {
    return 'UPCOMING';
  }
  if (startDate && startDate > now) {
    return 'UPCOMING';
  }

  if (startDate && endDate && startDate <= now && endDate >= now) {
    return 'IN PROGRESS';
  }

  if (!endDate && startDate) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return now.getTime() - startDate.getTime() <= oneDayMs ? 'IN PROGRESS' : 'PAST RESULTS';
  }

  return 'PAST RESULTS';
}

export default function HomePage() {
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState('ID');
  const [selectedTab, setSelectedTab] = useState<StateTab>('UPCOMING');
  const [selectedStateOutline, setSelectedStateOutline] = useState<{ d: string; viewBox: string } | null>(null);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDirectory = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/v1/public/tournaments?limit=300', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to load tournaments.');
        }

        const payload = await response.json() as PublicTournamentDirectoryResponse;
        const items = Array.isArray(payload.tournaments) ? payload.tournaments : [];
        const normalized: Tournament[] = items.map((item) => {
          const startDate = item.start_date ? new Date(item.start_date) : null;
          const endDate = item.end_date ? new Date(item.end_date) : null;
          const location = parseLocation(item.location);

          return {
            id: String(item.id),
            name: item.name,
            date: formatDateRange(startDate, endDate),
            startDate,
            endDate,
            venue: location.venue,
            city: location.city,
            stateCode: location.stateCode,
            status: getTournamentStatus(startDate, endDate),
          };
        });

        if (!cancelled) {
          setAllTournaments(normalized);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load tournaments.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  const stateSummaries = useMemo(() => {
    const byState = new Map<string, Tournament[]>();

    for (const tournament of allTournaments) {
      const tournaments = byState.get(tournament.stateCode) ?? [];
      tournaments.push(tournament);
      byState.set(tournament.stateCode, tournaments);
    }

    const summaries: StateSummary[] = Object.keys(STATE_NAME_BY_CODE).map((stateCode) => {
      const tournaments = byState.get(stateCode) ?? [];
      const uniqueCenters = new Set(tournaments.map((tournament) => tournament.venue.toLowerCase()));
      return {
        stateCode,
        stateName: STATE_NAME_BY_CODE[stateCode] ?? stateCode,
        tournaments,
        centerCount: uniqueCenters.size,
      };
    });

    summaries.sort((a, b) => b.tournaments.length - a.tournaments.length);
    return summaries;
  }, [allTournaments]);

  const selectedState = useMemo(() => {
    const found = stateSummaries.find((summary) => summary.stateCode === selectedStateCode);
    return found ?? stateSummaries[0] ?? null;
  }, [selectedStateCode, stateSummaries]);

  const selectedStateSubtitle = useMemo(() => {
    if (!selectedState) {
      return 'View tournaments in the selected state.';
    }

    if (selectedState.tournaments.length === 0) {
      return `No live tournaments in ${selectedState.stateName} yet.`;
    }

    const nickname = STATE_NICKNAME_BY_CODE[selectedState.stateCode];
    if (nickname) {
      return `View tournaments in the ${nickname}.`;
    }

    return `View tournaments in the ${selectedState.stateName} state.`;
  }, [selectedState]);

  const tabCounts = useMemo(() => {
    const counts: Record<StateTab, number> = {
      UPCOMING: 0,
      'IN PROGRESS': 0,
      'PAST RESULTS': 0,
    };

    for (const tournament of selectedState?.tournaments ?? []) {
      counts[tournament.status] += 1;
    }

    return counts;
  }, [selectedState]);

  const nextAvailableTab = useMemo(
    () => tabOrder.find((tab) => tab !== selectedTab && tabCounts[tab] > 0) ?? null,
    [selectedTab, tabCounts],
  );

  const visibleTournaments = useMemo(
    () => (selectedState?.tournaments ?? []).filter((tournament) => tournament.status === selectedTab),
    [selectedState, selectedTab],
  );

  const stateToneByCode = useMemo<Record<string, MapStateTone>>(() => {
    const tones: Record<string, MapStateTone> = {};

    for (const stateCode of Object.keys(STATE_NAME_BY_CODE)) {
      const summary = stateSummaries.find((candidate) => candidate.stateCode === stateCode);
      tones[stateCode] = getStateToneFromSummary(summary);
    }

    return tones;
  }, [stateSummaries]);

  const mapCustomize = useMemo(() => {
    const customize: Record<string, { fill: string; clickHandler: () => void }> = {};

    for (const stateCode of Object.keys(STATE_NAME_BY_CODE)) {
      const tone = stateToneByCode[stateCode] ?? 'none';
      customize[stateCode] = {
        fill: getToneFill(tone, stateCode === selectedStateCode),
        clickHandler: () => {
          setSelectedStateCode(stateCode);
        },
      };
    }

    return customize;
  }, [selectedStateCode, stateToneByCode]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const mapRoot = mapWrapRef.current;
      if (!mapRoot) {
        setSelectedStateOutline(null);
        return;
      }

      mapRoot.querySelectorAll('title').forEach((titleNode) => {
        titleNode.remove();
      });

      mapRoot.querySelectorAll('path[data-name]').forEach((pathNode) => {
        pathNode.removeAttribute('data-active-state');
      });

      const selectedPath = mapRoot.querySelector(`path[data-name="${selectedStateCode}"]`) as SVGPathElement | null;
      if (!selectedPath) {
        setSelectedStateOutline(null);
        return;
      }

      selectedPath.setAttribute('data-active-state', 'true');

      const d = selectedPath.getAttribute('d');
      if (!d) {
        setSelectedStateOutline(null);
        return;
      }

      const bounds = selectedPath.getBBox();
      const padding = 5;
      const width = Math.max(bounds.width + padding * 2, 1);
      const height = Math.max(bounds.height + padding * 2, 1);
      const viewBox = `${bounds.x - padding} ${bounds.y - padding} ${width} ${height}`;

      setSelectedStateOutline({ d, viewBox });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [selectedStateCode]);

  return (
    <main className={styles.page}>
      <header className={`${styles.topNav} bw-public-header`}>
        <div className={`${styles.topNavInner} bw-public-header-inner`}>
          <Link href="/" aria-label="Tournament Central home" className={`${styles.brandLink} bw-public-brand-link`}>
            <span className={`${styles.brand} bw-public-brand`}>
              <Image
                src="/TC_logo_No_Text.svg"
                alt="Tournament Central"
                width={42}
                height={42}
                priority
                className={styles.brandLogo}
              />
              <span className={`${styles.brandText} bw-public-brand-text`}>
                <strong>TOURNAMENT <span>CENTRAL</span></strong>
                <small>by BracketWorks</small>
              </span>
            </span>
          </Link>

          <nav className={`${styles.navLinks} bw-public-nav`} aria-label="Primary">
            <a href="#">Tournaments</a>
            <a href="#">Bowling Centers</a>
            <a href="#">Results</a>
            <a href="#">About</a>
          </nav>

          <div className={`${styles.topActions} bw-public-actions`}>
            <Link href="/login" className={`${styles.ghostBtn} bw-public-secondary-btn`}>Sign In</Link>
            <Link href="/signup" className={`${styles.primaryBtn} bw-public-primary-btn`}>Register</Link>
          </div>
        </div>
      </header>

      <section className={`${styles.section} ${styles.explore}`}>
        <div className={styles.filterRow}>
          <input className={styles.searchInput} type="text" placeholder="Search tournaments..." aria-label="Search tournaments" />
          <button type="button" className={styles.filterBtn}>State</button>
          <button type="button" className={styles.filterBtn}>Date</button>
          <button type="button" className={styles.filterBtn}>Division</button>
          <button type="button" className={styles.filterBtn}>Format</button>
          <button type="button" className={styles.filterBtn}>Bowling Center</button>
          <button type="button" className={styles.clearBtn}>Clear Filters</button>
        </div>

        <div className={styles.layoutGrid}>
          <div className={styles.mapShell}>
            <div className={styles.mapCanvas}>
              <div className={styles.usMapWrap} role="group" aria-label="United States tournament map" ref={mapWrapRef}>
                <USAMap customize={mapCustomize} />
              </div>
            </div>
          </div>

          <aside className={styles.statePanel}>
            <div className={styles.stateHeader}>
              <div className={styles.stateMeta}>
                {selectedStateOutline ? (
                  <svg
                    className={styles.stateShape}
                    viewBox={selectedStateOutline.viewBox}
                    preserveAspectRatio="xMidYMid meet"
                    role="presentation"
                    focusable="false"
                    aria-hidden="true"
                  >
                    <path d={selectedStateOutline.d} />
                  </svg>
                ) : (
                  <span className={styles.stateFlagFallback} aria-hidden="true">{selectedState?.stateCode ?? '--'}</span>
                )}
                <div className={styles.stateTitleBlock}>
                  <h3>{selectedState?.stateName ?? 'No State'}</h3>
                  <p>{selectedStateSubtitle}</p>
                </div>
              </div>
            </div>

            <div className={styles.tabs}>
              {tabOrder.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={selectedTab === tab ? styles.tabActive : ''}
                  onClick={() => setSelectedTab(tab)}
                >
                  {statusLabel[tab]} <span>{tabCounts[tab]}</span>
                </button>
              ))}
            </div>

            <div className={styles.statGrid}>
              <article className={styles.statCard}>
                <span className={`${styles.statIcon} ${styles.statIconTournaments}`} aria-hidden="true" />
                <strong>{selectedState?.tournaments.length ?? 0}</strong>
                <span>Tournaments</span>
                <small className={styles.statHint}>Updated today</small>
              </article>
              <article className={styles.statCard}>
                <span className={`${styles.statIcon} ${styles.statIconCenters}`} aria-hidden="true" />
                <strong>{selectedState?.centerCount ?? 0}</strong>
                <span>Bowling Centers</span>
                <small className={styles.statHint}>Updated today</small>
              </article>
            </div>

            {isLoading && <p className={styles.panelMessage}>Loading tournaments...</p>}
            {loadError && <p className={styles.errorMessage}>{loadError}</p>}

            <div className={styles.cardList}>
              {visibleTournaments.map((tournament) => (
                <article key={tournament.id} className={styles.tournamentCard}>
                  <div className={styles.tournamentMedia} aria-hidden="true" />
                  <div className={styles.cardBody}>
                    <h4>{tournament.name}</h4>
                    <p className={styles.cardMetaLine}>{tournament.date}</p>
                    <p className={styles.cardMetaLine}>
                      {tournament.venue} • {tournament.city}, {tournament.stateCode}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    <span className={`${styles.badge} ${getBadgeClass(tournament.status)}`}>{tournament.status}</span>
                    <button type="button" className={styles.ghostBtn}>View Details</button>
                  </div>
                </article>
              ))}
              {!isLoading && visibleTournaments.length === 0 && (
                <div className={styles.emptyState}>
                  <h4>No {statusLabel[selectedTab].toLowerCase()} tournaments yet</h4>
                  <p>
                    {nextAvailableTab
                      ? `Try ${statusLabel[nextAvailableTab]} for ${selectedState?.stateName ?? 'this state'}.`
                      : 'Try another state on the map to find active events.'}
                  </p>
                  {nextAvailableTab && (
                    <button
                      type="button"
                      className={styles.emptyStateAction}
                      onClick={() => {
                        setSelectedTab(nextAvailableTab);
                      }}
                    >
                      View {statusLabel[nextAvailableTab]}
                    </button>
                  )}
                </div>
              )}
            </div>

            <button type="button" className={styles.panelFooter} disabled={!selectedState}>
              View All {selectedState?.stateName ?? 'State'} Tournaments
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
