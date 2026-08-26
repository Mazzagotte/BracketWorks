"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { CalendarCheck2, CalendarDays, ChevronRight, Clock3, Info, Link2, LocateFixed, MapPin, Menu, Plus, Search, ShieldCheck, UsersRound, X } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { PublicTournamentDirectoryItem, PublicTournamentDirectoryResponse } from '@bracketworks/types';
import TournamentRegistrationForm from '@/components/public/TournamentRegistrationForm';
import styles from './page.module.css';

const TOURNAMENT_PAGE_SIZE = 24;

function Brand() {
  return (
    <span className={`${styles.brand} bw-public-brand`}>
      <Image src="/TC_logo_No_Text.svg" alt="Tournament Central" width={38} height={38} priority />
      <span className="bw-public-brand-text">
        <strong>TOURNAMENT <span>CENTRAL</span></strong>
        <small>Bowling Tournament Management</small>
      </span>
    </span>
  );
}

type TournamentStatus = 'UPCOMING' | 'IN PROGRESS' | 'PAST RESULTS';
type StateTab = 'UPCOMING' | 'IN PROGRESS' | 'PAST RESULTS';
type DiscoveryFilter = 'upcoming' | 'weekend' | 'near' | 'in-progress' | 'past';

type Tournament = {
  id: string;
  name: string;
  date: string;
  startDate: Date | null;
  endDate: Date | null;
  venue: string;
  city: string;
  stateCode: string;
  stateLabel: string;
  logoUrl: string | null;
  publicUrl: string | null;
  registrationUrl: string | null;
  locationText: string;
  latitude: number | null;
  longitude: number | null;
  status: TournamentStatus;
};

type VenueMapMarker = {
  key: string;
  coordinates: [number, number];
  venue: string;
  city: string;
  stateCode: string;
  tournaments: Tournament[];
};

type StateSummary = {
  stateCode: string;
  stateName: string;
  tournaments: Tournament[];
};

type PublicTournamentSummary = PublicTournamentDirectoryItem;

type RegistrationFieldConfig = {
  id: string;
  key: string;
  label: string;
  customLabel?: string;
  mode: 'required' | 'optional' | 'dont-ask';
  displayOrder: number;
  validation?: string;
};

type RegistrationQuestionConfig = {
  id: string;
  label: string;
  type?: 'short-text' | 'long-text' | 'number' | 'yes-no' | 'dropdown' | 'multiple-choice' | 'checkbox' | 'date';
  required: boolean;
  enabled: boolean;
  displayOrder: number;
  options?: string[];
  scope?: {
    all: boolean;
    eventIds: string[];
    divisionIds: string[];
    squadIds: string[];
  };
};

type RegistrationQuestionAnswerValue = string | boolean | string[];

type RegistrationEventConfig = {
  id: string;
  name: string;
  enabled: boolean;
  connectedDivisionIds?: string[];
  connectedSquadIds?: string[];
  entryFeeCents?: number;
};

type RegistrationDivisionConfig = {
  id: string;
  name: string;
  enabled: boolean;
};

type RegistrationSquadConfig = {
  id: string;
  name: string;
  dateIso?: string;
  startTime?: string;
  requiredBowlerCount?: number;
  required_bowler_count?: number;
  capacity?: number;
  registeredCount?: number;
};

type PublicTcRegistrationConfigResponse = {
  tournament_id: number;
  tournament_name: string;
  events: RegistrationEventConfig[];
  divisions: RegistrationDivisionConfig[];
  squads: RegistrationSquadConfig[];
  fields: RegistrationFieldConfig[];
  questions: RegistrationQuestionConfig[];
};

type RegistrationFormState = {
  bowlers: Array<Record<string, string>>;
  eventId: string;
  divisionId: string;
  squadId: string;
  notes: string;
  bowlerQuestionAnswers: Array<Record<string, RegistrationQuestionAnswerValue>>;
  acceptTerms: boolean;
};

const EMPTY_REGISTRATION_FORM: RegistrationFormState = {
  bowlers: [{}],
  eventId: '',
  divisionId: '',
  squadId: '',
  notes: '',
  bowlerQuestionAnswers: [{}],
  acceptTerms: false,
};

type MapStateTone = 'upcoming' | 'inprogress' | 'past' | 'none';
type MapViewport = {
  center: [number, number];
  zoom: number;
};

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

const STATE_CODE_BY_NAME = new Map(
  Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name.toUpperCase(), code]),
);

const STATE_NICKNAME_BY_CODE: Partial<Record<string, string>> = {
  ID: 'Gem State',
};

const STATE_FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
  '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
  '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
};

const USA_STATES_GEO_URL = '/us-states-10m.json';
const DEFAULT_MAP_VIEWPORT: MapViewport = { center: [-96, 38], zoom: 1 };
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_STALE_AFTER_MS = 60000;
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 3.5;
const MAP_PAN_PADDING = 52;

const tabOrder: StateTab[] = ['UPCOMING', 'IN PROGRESS', 'PAST RESULTS'];

const statusLabel: Record<TournamentStatus, string> = {
  UPCOMING: 'Upcoming',
  'IN PROGRESS': 'In Progress',
  'PAST RESULTS': 'Past Results',
};

const mapGeographyStyle = {
  default: { outline: 'none' },
  hover: { outline: 'none' },
  pressed: { outline: 'none' },
} as const;

function getCardStatusClass(status: TournamentStatus): string {
  if (status === 'UPCOMING') {
    return styles.cardStatusUpcoming;
  }

  if (status === 'IN PROGRESS') {
    return styles.cardStatusInProgress;
  }

  return styles.cardStatusPast;
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

function getToneFill(tone: MapStateTone, isSelected: boolean, _stateCode: string): string {
  if (isSelected) {
    return '#313131';
  }

  if (tone === 'inprogress') {
    return '#292929';
  }

  if (tone === 'upcoming') {
    return '#202020';
  }

  if (tone === 'past') {
    return '#191919';
  }

  return '#111111';
}

function parseLocation(location: string | null): { venue: string; city: string; stateCode: string } {
  const resolveStateCode = (rawValue: string | undefined): string => {
    const value = (rawValue || '').trim();
    if (!value) {
      return '';
    }

    const normalizedCode = value.toUpperCase().replace(/[^A-Z]/g, '');
    if (normalizedCode.length === 2 && STATE_NAME_BY_CODE[normalizedCode]) {
      return normalizedCode;
    }

    const normalizedName = value
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return STATE_CODE_BY_NAME.get(normalizedName) ?? '';
  };

  if (!location) {
    return { venue: 'Venue TBA', city: 'Unknown', stateCode: '' };
  }

  const pieces = location.split(',').map((piece) => piece.trim()).filter(Boolean);

  // Look from right to left so values like "Boise, Idaho, USA" still resolve to ID.
  let stateCode = '';
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    stateCode = resolveStateCode(pieces[index]);
    if (stateCode) {
      break;
    }
  }

  if (!stateCode) {
    const upperLocation = location.toUpperCase();

    for (const code of Object.keys(STATE_NAME_BY_CODE)) {
      const codePattern = new RegExp(`\\b${code}\\b`);
      if (codePattern.test(upperLocation)) {
        stateCode = code;
        break;
      }
    }
  }

  if (!stateCode) {
    const upperLocation = location.toUpperCase();
    for (const [name, code] of STATE_CODE_BY_NAME.entries()) {
      if (upperLocation.includes(name)) {
        stateCode = code;
        break;
      }
    }
  }

  const city = pieces.length > 1 ? pieces[pieces.length - 2] : pieces[0] ?? 'Unknown';
  const venue = pieces[0] ?? 'Venue TBA';

  return { venue, city, stateCode };
}

function normalizeRegistrationFieldKey(key: string): string {
  return key.trim().toLowerCase();
}

function getRequiredBowlerCountFromSquad(squad: RegistrationSquadConfig | null | undefined): number | null {
  if (!squad) {
    return null;
  }

  const rawValue = typeof squad.requiredBowlerCount === 'number'
    ? squad.requiredBowlerCount
    : typeof squad.required_bowler_count === 'number'
      ? squad.required_bowler_count
      : null;

  if (rawValue === null || !Number.isFinite(rawValue)) {
    return null;
  }

  return Math.max(1, Math.round(rawValue));
}

function getRequiredBowlerCountFromEvent(event: RegistrationEventConfig | null | undefined): number {
  if (!event) {
    return 1;
  }

  const minPlayers = typeof (event as { minPlayers?: unknown }).minPlayers === 'number'
    ? Number((event as { minPlayers?: number }).minPlayers)
    : 1;
  const maxPlayers = typeof (event as { maxPlayers?: unknown }).maxPlayers === 'number'
    ? Number((event as { maxPlayers?: number }).maxPlayers)
    : minPlayers;

  return Math.max(1, Math.max(minPlayers, maxPlayers));
}

function normalizeQuestionOptions(options: string[] | undefined): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => option.trim()).filter(Boolean);
}

function isRegistrationQuestionAnswered(
  question: RegistrationQuestionConfig,
  answer: RegistrationQuestionAnswerValue | undefined,
): boolean {
  const type = (question.type || 'short-text').toLowerCase();
  const options = normalizeQuestionOptions(question.options);

  if (type === 'checkbox' && options.length > 0) {
    return Array.isArray(answer) && answer.some((value) => value.trim().length > 0);
  }

  if (type === 'checkbox') {
    return answer === true;
  }

  if (Array.isArray(answer)) {
    return answer.some((value) => value.trim().length > 0);
  }

  if (typeof answer === 'boolean') {
    return true;
  }

  return typeof answer === 'string' && answer.trim().length > 0;
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

function isTournamentThisWeekend(tournament: Tournament): boolean {
  const today = new Date();
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
  const weekendStart = new Date(today);
  weekendStart.setHours(0, 0, 0, 0);
  weekendStart.setDate(today.getDate() + daysUntilSaturday);
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setDate(weekendStart.getDate() + 2);

  const start = tournament.startDate ?? tournament.endDate;
  const end = tournament.endDate ?? tournament.startDate;
  return Boolean(start && end && start < weekendEnd && end >= weekendStart);
}

function clampZoom(zoom: number): number {
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));
}

function getMapTranslateExtent(viewportWidth: number, viewportHeight: number): [[number, number], [number, number]] {
  const minX = -MAP_PAN_PADDING;
  const minY = -MAP_PAN_PADDING;
  const maxX = viewportWidth + MAP_PAN_PADDING;
  const maxY = viewportHeight + MAP_PAN_PADDING;

  return [[minX, minY], [maxX, maxY]];
}

function buildVenueMapMarkers(tournaments: Tournament[]): VenueMapMarker[] {
  const markerGroups = new Map<string, VenueMapMarker>();

  for (const tournament of tournaments) {
    const { latitude, longitude } = tournament;
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      continue;
    }

    // Group identical and very-nearby venue coordinates to keep national view uncluttered.
    const key = `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    const existing = markerGroups.get(key);
    if (existing) {
      existing.tournaments.push(tournament);
      continue;
    }

    markerGroups.set(key, {
      key,
      coordinates: [longitude, latitude],
      venue: tournament.venue,
      city: tournament.city,
      stateCode: tournament.stateCode,
      tournaments: [tournament],
    });
  }

  return [...markerGroups.values()];
}

export default function HomePage() {
  const router = useRouter();
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heartbeatState, setHeartbeatState] = useState<'live' | 'stale' | 'checking'>('live');
  const [selectedStateCode, setSelectedStateCode] = useState('ID');
  const [panelStateCode, setPanelStateCode] = useState('ID');
  const [selectedTab, setSelectedTab] = useState<StateTab>('UPCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>('upcoming');
  const [selectedStateOutline, setSelectedStateOutline] = useState<{ d: string; viewBox: string } | null>(null);
  const [mapViewport, setMapViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [isMapActive, setIsMapActive] = useState(false);
  const [visibleTournamentCount, setVisibleTournamentCount] = useState(TOURNAMENT_PAGE_SIZE);
  const [mapSize, setMapSize] = useState({ width: 960, height: 520 });
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null);
  const [registrationTournamentId, setRegistrationTournamentId] = useState<string | null>(null);
  const [registrationConfig, setRegistrationConfig] = useState<PublicTcRegistrationConfigResponse | null>(null);
  const [isRegistrationConfigLoading, setIsRegistrationConfigLoading] = useState(false);
  const [registrationConfigError, setRegistrationConfigError] = useState<string | null>(null);
  const [registrationSubmitMessage, setRegistrationSubmitMessage] = useState<string | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(EMPTY_REGISTRATION_FORM);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const hasUserSelectedStateRef = useRef(false);
  const detailModalRef = useRef<HTMLElement | null>(null);
  const lastSuccessfulHeartbeatRef = useRef(0);

  useEffect(() => {
    lastSuccessfulHeartbeatRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!mapShellRef.current) {
      return;
    }

    const updateMapSize = () => {
      const rect = mapShellRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setMapSize({
        width: rect.width || 960,
        height: rect.height || 520,
      });
    };

    updateMapSize();

    const resizeObserver = new ResizeObserver(() => {
      updateMapSize();
    });

    resizeObserver.observe(mapShellRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  const registrationModalRef = useRef<HTMLElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const getRegistrationConfigUrl = useCallback((tournament: Tournament | null): string | null => {
    if (!tournament) {
      return null;
    }

    if (tournament.registrationUrl) {
      return tournament.registrationUrl;
    }

    if (tournament.id.startsWith('tc-')) {
      const rawId = tournament.id.slice(3).trim();
      if (/^\d+$/.test(rawId)) {
        return `/api/v1/public/tc-tournament/${rawId}/registration`;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    const hasToken = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('access_token'));
    const hasUser = typeof window !== 'undefined' && Boolean(localStorage.getItem('user_id'));
    if (hasToken && hasUser) {
      router.replace('/organizer');
    }
  }, [router]);

  const loadDirectory = useCallback(async () => {
    setIsLoading(true);
    setHeartbeatState('checking');

    try {
      const response = await fetch(`/api/v1/public/tournaments?source=tc&limit=300&ts=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Unable to load tournament directory.');
      }

      const payload = await response.json() as PublicTournamentDirectoryResponse;
      const items = Array.isArray(payload.tournaments) ? payload.tournaments : [];
      const normalized: Tournament[] = items.map((item) => {
        const startDate = item.start_date ? new Date(item.start_date) : null;
        const endDate = item.end_date ? new Date(item.end_date) : null;
        const location = parseLocation(item.location);
        const stateCodeFromPayload = (item.state_code ?? '').trim().toUpperCase();
        const stateNameFromPayload = (item.state_name ?? '').trim();
        const stateCodeFromStateName = stateNameFromPayload
          ? (STATE_CODE_BY_NAME.get(stateNameFromPayload.toUpperCase()) ?? '')
          : '';
        const normalizedStateCode =
          (stateCodeFromPayload && STATE_NAME_BY_CODE[stateCodeFromPayload]
            ? stateCodeFromPayload
            : '')
          || stateCodeFromStateName
          || location.stateCode;
        const normalizedStateName =
          stateNameFromPayload
          || (normalizedStateCode ? (STATE_NAME_BY_CODE[normalizedStateCode] ?? '') : '');
        const stateLabel = normalizedStateCode || normalizedStateName || 'TBD';
        const locationSuffix = normalizedStateCode || normalizedStateName;

        return {
          id: String(item.id),
          name: item.name,
          date: formatDateRange(startDate, endDate),
          startDate,
          endDate,
          venue: location.venue,
          city: location.city,
          stateCode: normalizedStateCode,
          stateLabel,
          logoUrl: item.logo_url ?? null,
          publicUrl: item.public_url ?? null,
          registrationUrl: item.registration_url ?? null,
          locationText: item.location?.trim() || `${location.venue} • ${location.city}${locationSuffix ? `, ${locationSuffix}` : ''}`,
          latitude: typeof item.latitude === 'number'
            ? item.latitude
            : (typeof item.venue?.latitude === 'number' ? item.venue.latitude : null),
          longitude: typeof item.longitude === 'number'
            ? item.longitude
            : (typeof item.venue?.longitude === 'number' ? item.venue.longitude : null),
          status: getTournamentStatus(startDate, endDate),
        };
      });

      setAllTournaments(normalized);
      lastSuccessfulHeartbeatRef.current = Date.now();
      setHeartbeatState('live');
    } catch {
      setHeartbeatState('stale');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    lastSuccessfulHeartbeatRef.current = Date.now();
    void loadDirectory();

    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - lastSuccessfulHeartbeatRef.current;
      if (document.visibilityState !== 'visible') {
        setHeartbeatState('stale');
        return;
      }

      if (elapsedMs >= HEARTBEAT_STALE_AFTER_MS) {
        setHeartbeatState('checking');
        void loadDirectory();
        return;
      }

      setHeartbeatState('live');
    }, HEARTBEAT_INTERVAL_MS);

    const handleFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      const elapsedMs = Date.now() - lastSuccessfulHeartbeatRef.current;
      if (elapsedMs >= HEARTBEAT_STALE_AFTER_MS) {
        setHeartbeatState('checking');
        void loadDirectory();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [loadDirectory]);

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setPanelStateCode(selectedStateCode);
    }, 80);

    return () => {
      window.clearTimeout(debounceId);
    };
  }, [selectedStateCode]);

  const stateSummariesByCode = useMemo(() => {
    const byState = new Map<string, Tournament[]>();

    for (const tournament of allTournaments) {
      if (!tournament.stateCode || !STATE_NAME_BY_CODE[tournament.stateCode]) {
        continue;
      }

      const tournaments = byState.get(tournament.stateCode) ?? [];
      tournaments.push(tournament);
      byState.set(tournament.stateCode, tournaments);
    }

    const summaries = new Map<string, StateSummary>();
    for (const stateCode of Object.keys(STATE_NAME_BY_CODE)) {
      const tournaments = byState.get(stateCode) ?? [];
      summaries.set(stateCode, {
        stateCode,
        stateName: STATE_NAME_BY_CODE[stateCode] ?? stateCode,
        tournaments,
      });
    }

    return summaries;
  }, [allTournaments]);

  const stateSummaries = useMemo(() => {
    const summaries = [...stateSummariesByCode.values()];

    summaries.sort((a, b) => b.tournaments.length - a.tournaments.length);
    return summaries;
  }, [stateSummariesByCode]);

  const firstStateWithTournaments = useMemo(
    () => stateSummaries.find((summary) => summary.tournaments.length > 0)?.stateCode ?? null,
    [stateSummaries],
  );

  useEffect(() => {
    if (hasUserSelectedStateRef.current) {
      return;
    }

    if (!firstStateWithTournaments) {
      return;
    }

    const selectedCount = stateSummariesByCode.get(selectedStateCode)?.tournaments.length ?? 0;
    if (selectedCount > 0) {
      return;
    }

    setSelectedStateCode(firstStateWithTournaments);
    setPanelStateCode(firstStateWithTournaments);
  }, [firstStateWithTournaments, selectedStateCode, stateSummariesByCode]);

  const selectedState = useMemo(() => {
    const found = stateSummariesByCode.get(panelStateCode);
    if (found) {
      return found;
    }

    if (!panelStateCode) {
      return stateSummaries[0] ?? null;
    }

    return {
      stateCode: panelStateCode,
      stateName: STATE_NAME_BY_CODE[panelStateCode] ?? panelStateCode,
      tournaments: [],
    };
  }, [panelStateCode, stateSummariesByCode, stateSummaries]);

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

  const visibleTournaments = useMemo(() => {
    const tournaments = deferredSearchQuery.trim() ? allTournaments : (selectedState?.tournaments ?? []);
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    const matchesSearch = (tournament: Tournament) => !normalizedQuery
      || tournament.name.toLowerCase().includes(normalizedQuery)
      || tournament.venue.toLowerCase().includes(normalizedQuery)
      || tournament.city.toLowerCase().includes(normalizedQuery)
      || tournament.stateLabel.toLowerCase().includes(normalizedQuery)
      || tournament.stateCode.toLowerCase().includes(normalizedQuery);
    const matchesDiscoveryFilter = (tournament: Tournament) => {
      if (discoveryFilter === 'weekend') {
        return isTournamentThisWeekend(tournament);
      }
      if (discoveryFilter === 'near') {
        return tournament.stateCode === selectedState?.stateCode;
      }
      if (discoveryFilter === 'in-progress') {
        return tournament.status === 'IN PROGRESS';
      }
      if (discoveryFilter === 'past') {
        return tournament.status === 'PAST RESULTS';
      }
      return tournament.status === 'UPCOMING';
    };
    const filteredTournaments = tournaments.filter((tournament) => matchesSearch(tournament) && matchesDiscoveryFilter(tournament));

    if (showAllStatuses || discoveryFilter === 'weekend' || discoveryFilter === 'near') {
      const statusRank: Record<TournamentStatus, number> = {
        'IN PROGRESS': 0,
        UPCOMING: 1,
        'PAST RESULTS': 2,
      };

      return [...filteredTournaments].sort((a, b) => {
        const rankDiff = statusRank[a.status] - statusRank[b.status];
        if (rankDiff !== 0) {
          return rankDiff;
        }

        const aTime = a.startDate ? a.startDate.getTime() : 0;
        const bTime = b.startDate ? b.startDate.getTime() : 0;
        return bTime - aTime;
      });
    }

    return filteredTournaments.filter((tournament) => tournament.status === selectedTab);
  }, [allTournaments, deferredSearchQuery, discoveryFilter, selectedState, selectedTab, showAllStatuses]);

  useEffect(() => {
    setVisibleTournamentCount(TOURNAMENT_PAGE_SIZE);
  }, [deferredSearchQuery, discoveryFilter, panelStateCode, selectedTab, showAllStatuses]);

  const renderedTournaments = useMemo(
    () => visibleTournaments.slice(0, visibleTournamentCount),
    [visibleTournamentCount, visibleTournaments],
  );

  const hasMoreTournaments = visibleTournaments.length > renderedTournaments.length;

  const detailTournament = useMemo(
    () => allTournaments.find((entry) => entry.id === detailTournamentId) ?? null,
    [allTournaments, detailTournamentId],
  );

  const registrationTournament = useMemo(
    () => allTournaments.find((entry) => entry.id === registrationTournamentId) ?? null,
    [allTournaments, registrationTournamentId],
  );

  useEffect(() => {
    const requestedTournamentId = new URLSearchParams(window.location.search).get('registration');
    if (requestedTournamentId && allTournaments.some((entry) => entry.id === requestedTournamentId)) {
      setRegistrationTournamentId(requestedTournamentId);
    }
  }, [allTournaments]);

  const registrationEvents = useMemo(
    () => (registrationConfig?.events ?? []).filter((event) => event.enabled),
    [registrationConfig],
  );

  const registrationDivisions = useMemo(
    () => (registrationConfig?.divisions ?? []).filter((division) => division.enabled),
    [registrationConfig],
  );

  const registrationSquads = useMemo(
    () => registrationConfig?.squads ?? [],
    [registrationConfig],
  );

  const registrationFields = useMemo(
    () => (registrationConfig?.fields ?? [])
      .filter((field) => field.mode !== 'dont-ask')
      .sort((a, b) => a.displayOrder - b.displayOrder),
    [registrationConfig],
  );

  const requiredRegistrationFields = useMemo(
    () => registrationFields.filter((field) => field.mode === 'required'),
    [registrationFields],
  );

  const registrationQuestions = useMemo(
    () => (registrationConfig?.questions ?? [])
      .filter((question) => question.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder),
    [registrationConfig],
  );

  const selectedRegistrationSquad = useMemo(
    () => registrationSquads.find((squad) => squad.id === registrationForm.squadId) ?? null,
    [registrationForm.squadId, registrationSquads],
  );

  const eventsForSelectedSquad = useMemo(() => {
    if (!registrationForm.squadId) {
      return registrationEvents;
    }

    const linked = registrationEvents.filter((event) => {
      const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];
      return connectedSquadIds.includes(registrationForm.squadId);
    });

    return linked.length > 0 ? linked : registrationEvents;
  }, [registrationEvents, registrationForm.squadId]);

  const selectedRegistrationEvent = useMemo(
    () => registrationEvents.find((event) => event.id === registrationForm.eventId) ?? eventsForSelectedSquad[0] ?? null,
    [eventsForSelectedSquad, registrationEvents, registrationForm.eventId],
  );

  const divisionsForSelectedEvent = useMemo(() => {
    const connectedIds = new Set(selectedRegistrationEvent?.connectedDivisionIds ?? []);
    return registrationDivisions.filter((division) => connectedIds.has(division.id));
  }, [registrationDivisions, selectedRegistrationEvent]);

  const squadsForSelectedEvent = useMemo(() => {
    const connectedIds = new Set(selectedRegistrationEvent?.connectedSquadIds ?? []);
    return registrationSquads.filter((squad) => connectedIds.has(squad.id));
  }, [registrationSquads, selectedRegistrationEvent]);

  useEffect(() => {
    setRegistrationForm((previous) => {
      const divisionId = divisionsForSelectedEvent.some((division) => division.id === previous.divisionId)
        ? previous.divisionId
        : divisionsForSelectedEvent[0]?.id ?? '';
      const squadId = squadsForSelectedEvent.some((squad) => squad.id === previous.squadId)
        ? previous.squadId
        : squadsForSelectedEvent[0]?.id ?? '';
      return divisionId === previous.divisionId && squadId === previous.squadId
        ? previous
        : { ...previous, divisionId, squadId };
    });
  }, [divisionsForSelectedEvent, squadsForSelectedEvent]);

  const requiredBowlerCount = useMemo(
    () => getRequiredBowlerCountFromSquad(selectedRegistrationSquad) ?? getRequiredBowlerCountFromEvent(selectedRegistrationEvent),
    [selectedRegistrationEvent, selectedRegistrationSquad],
  );

  const openRegistrationModal = (tournament: Tournament, triggerElement?: HTMLElement | null) => {
    if (triggerElement) {
      lastTriggerRef.current = triggerElement;
    }

    setDetailTournamentId(null);
    setRegistrationTournamentId(tournament.id);
    setRegistrationConfig(null);
    setRegistrationConfigError(null);
    setRegistrationSubmitMessage(null);
    setIsSubmittingRegistration(false);
    setRegistrationForm(EMPTY_REGISTRATION_FORM);
  };

  const closeRegistrationModal = () => {
    setRegistrationTournamentId(null);
    setRegistrationConfig(null);
    setRegistrationConfigError(null);
    setRegistrationSubmitMessage(null);
    setIsSubmittingRegistration(false);
    setRegistrationForm(EMPTY_REGISTRATION_FORM);

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        lastTriggerRef.current?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadRegistrationConfig = async () => {
      const tournament = allTournaments.find((entry) => entry.id === registrationTournamentId) ?? null;
      const registrationConfigUrl = getRegistrationConfigUrl(tournament);

      if (!tournament || !registrationConfigUrl) {
        setRegistrationConfig(null);
        setRegistrationConfigError(null);
        setIsRegistrationConfigLoading(false);
        return;
      }

      setIsRegistrationConfigLoading(true);
      setRegistrationConfigError(null);

      try {
        const response = await fetch(registrationConfigUrl, { cache: 'no-store' });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { detail?: string } | null;
          throw new Error(body?.detail || 'Registration setup is not available yet.');
        }
        const payload = await response.json() as PublicTcRegistrationConfigResponse;
        if (!cancelled) {
          setRegistrationConfig(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setRegistrationConfigError(error instanceof Error ? error.message : 'Unable to load registration setup.');
          setRegistrationConfig(null);
        }
      } finally {
        if (!cancelled) {
          setIsRegistrationConfigLoading(false);
        }
      }
    };

    if (registrationTournamentId) {
      void loadRegistrationConfig();
    }

    return () => {
      cancelled = true;
    };
  }, [allTournaments, getRegistrationConfigUrl, registrationTournamentId]);

  useEffect(() => {
    if (!registrationTournamentId) {
      return;
    }

    setRegistrationForm((prev) => {
      const next = { ...prev };
      if (!next.squadId && registrationSquads.length > 0) {
        next.squadId = registrationSquads[0].id;
      }

      const squadLinkedEvents = registrationEvents.filter((event) => {
        const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];
        return !next.squadId || connectedSquadIds.includes(next.squadId);
      });

      const allowedEvents = squadLinkedEvents.length > 0 ? squadLinkedEvents : registrationEvents;
      if (!next.eventId || (allowedEvents.length > 0 && !allowedEvents.some((event) => event.id === next.eventId))) {
        next.eventId = allowedEvents[0]?.id ?? '';
      }

      if (!next.divisionId && registrationDivisions.length > 0) {
        next.divisionId = registrationDivisions[0].id;
      }

      const selectedSquad = registrationSquads.find((squad) => squad.id === next.squadId) ?? null;
      const eventForCount = allowedEvents.find((event) => event.id === next.eventId) ?? allowedEvents[0] ?? null;
      const expectedBowlerCount = getRequiredBowlerCountFromSquad(selectedSquad) ?? getRequiredBowlerCountFromEvent(eventForCount);
      const currentBowlers = Array.isArray(next.bowlers) ? next.bowlers : [];
      const normalizedBowlers = currentBowlers.slice(0, expectedBowlerCount);
      while (normalizedBowlers.length < expectedBowlerCount) {
        normalizedBowlers.push({});
      }
      next.bowlers = normalizedBowlers;

      const currentBowlerQuestionAnswers = Array.isArray(next.bowlerQuestionAnswers)
        ? next.bowlerQuestionAnswers
        : [];
      const normalizedBowlerQuestionAnswers = currentBowlerQuestionAnswers.slice(0, expectedBowlerCount);
      while (normalizedBowlerQuestionAnswers.length < expectedBowlerCount) {
        normalizedBowlerQuestionAnswers.push({});
      }
      next.bowlerQuestionAnswers = normalizedBowlerQuestionAnswers;

      return next;
    });
  }, [registrationDivisions, registrationEvents, registrationSquads, registrationTournamentId]);

  const handleRegistrationSubmit = async () => {
    if (!registrationTournament) {
      return;
    }

    const registrationConfigUrl = getRegistrationConfigUrl(registrationTournament);

    if (!registrationConfigUrl) {
      setRegistrationSubmitMessage('Registration is not available for this tournament yet.');
      return;
    }

    if (!registrationForm.squadId) {
      setRegistrationSubmitMessage('Please select a squad first.');
      return;
    }

    if (registrationForm.bowlers.length !== requiredBowlerCount) {
      setRegistrationSubmitMessage(`This squad requires ${requiredBowlerCount} bowler form${requiredBowlerCount === 1 ? '' : 's'}.`);
      return;
    }

    let missingFieldLabel: string | null = null;
    let missingFieldBowlerIndex = -1;

    registrationForm.bowlers.some((bowlerFields, bowlerIndex) => {
      const missingRequiredField = requiredRegistrationFields.find((field) => {
        const key = normalizeRegistrationFieldKey(field.key);
        return !(bowlerFields[key] || '').trim();
      });

      if (!missingRequiredField) {
        return false;
      }

      missingFieldLabel = missingRequiredField.customLabel || missingRequiredField.label || 'Required field';
      missingFieldBowlerIndex = bowlerIndex;
      return true;
    });

    if (missingFieldLabel) {
      setRegistrationSubmitMessage(`Bowler ${missingFieldBowlerIndex + 1}: ${missingFieldLabel} is required.`);
      return;
    }

    if (!registrationForm.acceptTerms) {
      setRegistrationSubmitMessage('Please accept the tournament terms before continuing.');
      return;
    }

    let missingQuestionLabel: string | null = null;
    let missingQuestionBowlerIndex = -1;

    registrationQuestions.some((question) => {
      if (!question.required) {
        return false;
      }

      return registrationForm.bowlerQuestionAnswers.some((answersForBowler, bowlerIndex) => {
        const hasAnswer = isRegistrationQuestionAnswered(question, answersForBowler?.[question.id]);
        if (hasAnswer) {
          return false;
        }

        missingQuestionLabel = question.label || 'Required question';
        missingQuestionBowlerIndex = bowlerIndex;
        return true;
      });
    });

    if (missingQuestionLabel) {
      setRegistrationSubmitMessage(`Bowler ${missingQuestionBowlerIndex + 1}: ${missingQuestionLabel} is required.`);
      return;
    }

    const payload = {
      tournamentId: registrationTournament.id,
      tournamentName: registrationTournament.name,
      submittedAt: new Date().toISOString(),
      form: {
        firstName: registrationForm.bowlers[0]?.first_name || '',
        lastName: registrationForm.bowlers[0]?.last_name || '',
        email: registrationForm.bowlers[0]?.email || '',
        phone: registrationForm.bowlers[0]?.phone || '',
        usbcNumber: registrationForm.bowlers[0]?.usbc_number || '',
        bowlers: registrationForm.bowlers,
        eventId: registrationForm.eventId,
        divisionId: registrationForm.divisionId,
        squadId: registrationForm.squadId,
        notes: registrationForm.notes,
        questionAnswers: registrationForm.bowlerQuestionAnswers[0] || {},
        bowlerQuestionAnswers: registrationForm.bowlerQuestionAnswers,
        fieldValues: registrationForm.bowlers[0] || {},
        acceptTerms: registrationForm.acceptTerms,
      },
    };

    setIsSubmittingRegistration(true);
    setRegistrationSubmitMessage(null);

    try {
      const response = await fetch(registrationConfigUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(body?.detail || 'Unable to submit registration right now.');
      }

      setRegistrationSubmitMessage('Registration submitted successfully. The organizer can now review your request.');
      setRegistrationForm(EMPTY_REGISTRATION_FORM);
    } catch (error) {
      setRegistrationSubmitMessage(error instanceof Error ? error.message : 'Unable to submit registration right now.');
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const closeDetailModal = () => {
    setDetailTournamentId(null);

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        lastTriggerRef.current?.focus();
      }, 0);
    }
  };

  const trapFocusWithin = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') {
      return;
    }

    const container = event.currentTarget;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleDetailModalKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDetailModal();
      return;
    }

    trapFocusWithin(event);
  };

  const handleRegistrationModalKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRegistrationModal();
      return;
    }

    trapFocusWithin(event);
  };

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const hasOpenModal = Boolean(detailTournament || registrationTournament);
    if (!hasOpenModal) {
      document.body.style.removeProperty('overflow');
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailTournament, registrationTournament]);

  useEffect(() => {
    if (detailTournament && detailModalRef.current) {
      detailModalRef.current.focus();
    }
  }, [detailTournament]);

  useEffect(() => {
    if (registrationTournament && registrationModalRef.current) {
      registrationModalRef.current.focus();
    }
  }, [registrationTournament]);

  const featuredTournaments = useMemo(() => {
    return [...allTournaments]
      .filter((tournament) => tournament.status !== 'PAST RESULTS')
      .sort((a, b) => {
        const aTime = a.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 3)
      .map((tournament) => ({
        id: tournament.id,
        title: tournament.name,
        dateLabel: tournament.date,
        venue: tournament.venue,
        city: `${tournament.city}${tournament.stateLabel ? `, ${tournament.stateLabel}` : ''}`,
        slotText: tournament.status === 'IN PROGRESS' ? 'Live now' : 'Open for registration',
        tone: tournament.status === 'IN PROGRESS' ? 'tone-3' : tournament.status === 'UPCOMING' ? 'tone-1' : 'tone-2',
        logoUrl: tournament.logoUrl,
        isBrandCard: false,
      }));
  }, [allTournaments]);

  const stateToneByCode = useMemo(() => {
    const tones = new Map<string, MapStateTone>();

    for (const [stateCode, summary] of stateSummariesByCode.entries()) {
      tones.set(stateCode, getStateToneFromSummary(summary));
    }

    return tones;
  }, [stateSummariesByCode]);

  const venueMapMarkers = useMemo(() => buildVenueMapMarkers(allTournaments), [allTournaments]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const mapRoot = mapShellRef.current;
      if (!mapRoot || !selectedStateCode) {
        return;
      }

      const selectedPath = mapRoot.querySelector<SVGPathElement>(`[data-state-code="${selectedStateCode}"]`);
      if (!selectedPath) {
        return;
      }

      const d = selectedPath.getAttribute('d');
      if (!d) {
        return;
      }

      try {
        const bounds = selectedPath.getBBox();
        const padding = 5;
        const width = Math.max(bounds.width + padding * 2, 1);
        const height = Math.max(bounds.height + padding * 2, 1);
        const viewBox = `${bounds.x - padding} ${bounds.y - padding} ${width} ${height}`;
        setSelectedStateOutline({ d, viewBox });
      } catch {
        // Some browsers can throw on getBBox if SVG isn't fully laid out yet.
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [selectedStateCode, stateToneByCode]);

  const handleStateSelect = (stateCode: string, event: ReactMouseEvent<SVGPathElement>) => {
    hasUserSelectedStateRef.current = true;
    const selectedPath = event.currentTarget;
    const d = selectedPath.getAttribute('d');

    if (d) {
      const bounds = selectedPath.getBBox();
      const padding = 5;
      const width = Math.max(bounds.width + padding * 2, 1);
      const height = Math.max(bounds.height + padding * 2, 1);
      const viewBox = `${bounds.x - padding} ${bounds.y - padding} ${width} ${height}`;
      setSelectedStateOutline({ d, viewBox });
    } else {
      setSelectedStateOutline(null);
    }

    setSelectedStateCode(stateCode);
  };

  const mapTranslateExtent = useMemo(
    () => getMapTranslateExtent(mapSize.width, mapSize.height),
    [mapSize.height, mapSize.width],
  );

  const handleZoomChange = (delta: number) => {
    setMapViewport((prev) => {
      const nextZoom = clampZoom(prev.zoom + delta);
      if (nextZoom <= MIN_MAP_ZOOM + 0.0001) {
        return DEFAULT_MAP_VIEWPORT;
      }
      return { ...prev, zoom: nextZoom };
    });
  };

  const handleZoomReset = () => {
    setMapViewport(DEFAULT_MAP_VIEWPORT);
  };

  return (
    <main id="main-content" className={styles.page}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <header className={`${styles.header} bw-public-header`}>
        <div className={`${styles.headerInner} bw-public-header-inner`}>
          <Link href="/" aria-label="Tournament Central home" className="bw-public-brand-link"><Brand /></Link>

          <div className={`${styles.headerActions} bw-public-actions`}>
            <Link className={`${styles.secondaryButton} bw-public-secondary-btn`} href="/login">Sign In</Link>
            <Link className={`${styles.primaryButton} bw-public-primary-btn`} href="/signup">Create Account</Link>
          </div>

          <details className={styles.mobileMenu}>
            <summary aria-label="Open navigation"><Menu /></summary>
            <div>
              <Link href="/login">Sign In</Link>
              <Link href="/signup">Create Account</Link>
            </div>
          </details>
        </div>
      </header>

      <section id="tournament-directory" className={`${styles.section} ${styles.explore}`}>
        <div className={styles.discoveryHeader}>
          <div className={styles.discoveryIntro}>
            <h1>Find a Tournament</h1>
            <p>Search by tournament, bowling center, city, or state.</p>
          </div>
          <label className={styles.discoverySearch}>
            <Search size={18} aria-hidden="true" />
            <span className={styles.srOnly}>Search tournaments, bowling centers, cities, or states</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tournaments, bowling centers, cities, or states..."
              type="search"
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.discoverySearchClear}
                aria-label="Clear tournament search"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            ) : null}
          </label>
          <div className={styles.discoveryFilters} role="toolbar" aria-label="Tournament discovery filters">
            {([
              ['upcoming', 'Upcoming'],
              ['weekend', 'This Weekend'],
              ['near', 'Near Me'],
              ['in-progress', 'In Progress'],
              ['past', 'Past Results'],
            ] as const).map(([filter, label]) => (
              <button
                key={filter}
                type="button"
                className={discoveryFilter === filter ? styles.discoveryFilterActive : ''}
                onClick={() => {
                  setDiscoveryFilter(filter);
                  setShowAllStatuses(filter === 'near' || filter === 'weekend');
                  if (filter === 'upcoming') setSelectedTab('UPCOMING');
                  if (filter === 'in-progress') setSelectedTab('IN PROGRESS');
                  if (filter === 'past') setSelectedTab('PAST RESULTS');
                }}
              >
                {filter === 'near' ? <LocateFixed size={15} aria-hidden="true" /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.layoutGrid}>
          <div
            ref={mapShellRef}
            id="state-map"
            className={`${styles.mapShell} ${isMapInteracting ? styles.mapShellInteracting : ''}`}
            role="group"
            aria-label="United States tournament map"
            onMouseLeave={() => setIsMapActive(false)}
          >
            <div className={styles.mapControls} role="toolbar" aria-label="Map zoom controls">
              <button
                type="button"
                className={styles.mapControlButton}
                onClick={() => handleZoomChange(0.45)}
                aria-label="Zoom in on map"
              >
                +
              </button>
              <button
                type="button"
                className={styles.mapControlButton}
                onClick={() => handleZoomChange(-0.45)}
                aria-label="Zoom out on map"
              >
                -
              </button>
              <button
                type="button"
                className={`${styles.mapControlButton} ${styles.mapControlReset}`}
                onClick={handleZoomReset}
                aria-label="Reset map zoom"
              >
                Reset
              </button>
            </div>
            <p className={styles.mapHint}>
              {isMapActive
                ? 'Tip: Select a state, then use zoom controls, wheel, or pinch to inspect smaller states.'
                : 'Click into the map to enable scroll and pan.'}
            </p>
            <div
              className={styles.mapActivateOverlay}
              data-active={isMapActive ? 'true' : 'false'}
              onClick={() => setIsMapActive(true)}
              aria-hidden="true"
            />
            <ComposableMap projection="geoAlbersUsa" className={styles.usMapSvg}>
              <ZoomableGroup
                center={mapViewport.center}
                zoom={mapViewport.zoom}
                minZoom={MIN_MAP_ZOOM}
                maxZoom={MAX_MAP_ZOOM}
                translateExtent={mapTranslateExtent}
                onMoveStart={() => {
                  setIsMapInteracting(true);
                }}
                onMoveEnd={({ coordinates, zoom }) => {
                  const nextZoom = clampZoom(zoom);
                  if (nextZoom <= MIN_MAP_ZOOM + 0.0001) {
                    setMapViewport(DEFAULT_MAP_VIEWPORT);
                    setIsMapInteracting(false);
                    return;
                  }

                  setMapViewport({
                    center: [coordinates[0], coordinates[1]],
                    zoom: nextZoom,
                  });
                  setIsMapInteracting(false);
                }}
              >
                <Geographies geography={USA_STATES_GEO_URL}>
                  {({ geographies }) => [...geographies].sort((left, right) => {
                    const leftCode = STATE_FIPS_TO_CODE[String(left.id).padStart(2, '0')];
                    const rightCode = STATE_FIPS_TO_CODE[String(right.id).padStart(2, '0')];

                    return Number(leftCode === selectedStateCode) - Number(rightCode === selectedStateCode);
                  }).map((geo) => {
                    const fips = String(geo.id).padStart(2, '0');
                    const stateCode = STATE_FIPS_TO_CODE[fips];
                    const tone = stateCode ? (stateToneByCode.get(stateCode) ?? 'none') : 'none';
                    const isSelected = stateCode === selectedStateCode;
                    const fill = getToneFill(tone, Boolean(isSelected), stateCode ?? 'ZZ');

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        className={styles.geographyBase}
                        data-state-code={stateCode ?? ''}
                        data-selected={isSelected ? 'true' : 'false'}
                        fill={fill}
                        onClick={(event) => {
                          if (stateCode) {
                            handleStateSelect(stateCode, event as ReactMouseEvent<SVGPathElement>);
                          }
                        }}
                        style={mapGeographyStyle}
                      />
                    );
                  })}
                </Geographies>
                {venueMapMarkers.map((marker) => {
                  const tournamentCount = marker.tournaments.length;
                  const isInSelectedState = marker.stateCode === selectedStateCode;
                  const representativeTournament = marker.tournaments[0];
                  const markerRadius = tournamentCount >= 4 ? 4.5 : tournamentCount >= 2 ? 3.25 : 2.25;
                  const markerLabel = [
                    representativeTournament.name,
                    marker.venue,
                    `${marker.city}${marker.stateCode ? `, ${marker.stateCode}` : ''}`,
                    representativeTournament.date,
                    tournamentCount > 1 ? `${tournamentCount} tournaments at this venue` : null,
                  ].filter(Boolean).join('\n');

                  return (
                    <Marker key={marker.key} coordinates={marker.coordinates}>
                      <g
                        className={[
                          styles.venueMarker,
                          isInSelectedState ? styles.venueMarkerSelected : '',
                          selectedStateCode && !isInSelectedState ? styles.venueMarkerMuted : '',
                          tournamentCount >= 4 ? styles.venueMarkerHot : '',
                        ].filter(Boolean).join(' ')}
                        role="button"
                        tabIndex={0}
                        aria-label={markerLabel}
                        onClick={() => {
                          if (marker.stateCode) {
                            hasUserSelectedStateRef.current = true;
                            setSelectedStateCode(marker.stateCode);
                          }
                          setDetailTournamentId(marker.tournaments[0].id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            if (marker.stateCode) {
                              hasUserSelectedStateRef.current = true;
                              setSelectedStateCode(marker.stateCode);
                            }
                            setDetailTournamentId(marker.tournaments[0].id);
                          }
                        }}
                      >
                        <title>{markerLabel}</title>
                        <circle className={styles.venueMarkerDot} r={markerRadius} />
                        {tournamentCount >= 4 ? <text className={styles.venueMarkerCount} y={0.5}>{tournamentCount}</text> : null}
                      </g>
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>
          </div>

          <aside id="state-results" className={styles.statePanel}>
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

            <div className={styles.stateStatusSummary} aria-label="Tournament counts for selected state">
              {tabOrder.map((tab) => (
                <div key={tab} className={styles.stateStatusItem}>
                  <span>{statusLabel[tab]}</span>
                  <strong>{tabCounts[tab]}</strong>
                </div>
              ))}
            </div>

            {isLoading && (
              <div className={styles.resultsSkeletonList} aria-label="Loading tournaments" role="status">
                {[1, 2, 3].map((item) => <div key={item} className={styles.resultsSkeleton} />)}
              </div>
            )}

            <div className={styles.cardList}>
              {renderedTournaments.map((tournament) => (
                <article key={tournament.id} className={`${styles.tournamentCard} ${getCardStatusClass(tournament.status)}`}>
                  <div className={`${styles.tournamentMedia} ${tournament.logoUrl ? styles.tournamentMediaWithLogo : styles.tournamentMediaFallback}`} aria-hidden="true">
                    {tournament.logoUrl ? (
                      <img
                        src={tournament.logoUrl}
                        alt=""
                        className={styles.tournamentMediaLogo}
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeaderRow}>
                      <h4 className={styles.cardTitle} title={tournament.name}>{tournament.name}</h4>
                      <span className={styles.statusMicroChip}>
                        <span className={styles.statusMicroDot} aria-hidden="true" />
                        {statusLabel[tournament.status]}
                      </span>
                    </div>
                    <div className={styles.cardMetaBlock}>
                      <p className={`${styles.cardMetaLine} ${styles.cardMetaRow}`}>
                        <CalendarDays size={16} className={styles.cardMetaIcon} aria-hidden="true" />
                        <span>{tournament.date}</span>
                      </p>
                      <span className={styles.cardMetaDivider} aria-hidden="true" />
                      <p className={`${styles.cardMetaLine} ${styles.cardMetaRow}`}>
                        <MapPin size={16} className={styles.cardMetaIcon} aria-hidden="true" />
                        <span className={styles.cardMetaLocation}>{tournament.venue} • {tournament.city}, {tournament.stateLabel}</span>
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={`${styles.ghostBtn} ${styles.cardDetailButton}`}
                      onClick={(event) => {
                        lastTriggerRef.current = event.currentTarget;
                        setDetailTournamentId(tournament.id);
                      }}
                    >
                      View Details
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                    {tournament.registrationUrl ? (
                      <button
                        type="button"
                        className={styles.cardRegisterButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRegistrationModal(tournament, event.currentTarget);
                        }}
                      >
                        Register
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {hasMoreTournaments && (
                <button
                  type="button"
                  className={styles.loadMoreButton}
                  onClick={() => {
                    setVisibleTournamentCount((prev) => prev + TOURNAMENT_PAGE_SIZE);
                  }}
                >
                  Load more ({visibleTournaments.length - renderedTournaments.length} remaining)
                </button>
              )}
              {!isLoading && visibleTournaments.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon} aria-hidden="true">
                    <CalendarDays size={27} />
                  </div>
                  <h4>{searchQuery.trim() ? 'No matching tournaments' : showAllStatuses ? 'No tournaments yet' : `No ${statusLabel[selectedTab].toLowerCase()} tournaments yet`}</h4>
                  <p>
                    {searchQuery.trim()
                      ? 'Try a different search or clear the current filters.'
                      : !showAllStatuses && nextAvailableTab
                      ? `Try ${statusLabel[nextAvailableTab]} for ${selectedState?.stateName ?? 'this state'}.`
                      : 'There aren\'t any events listed yet.'}
                  </p>
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      className={styles.emptyStatePrimaryAction}
                      onClick={() => setSearchQuery('')}
                    >
                      <Search size={18} />
                      Clear Search
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={searchQuery.trim() ? styles.emptyStateSecondaryAction : styles.emptyStatePrimaryAction}
                    onClick={() => {
                      if (showAllStatuses) {
                        return;
                      }
                      setShowAllStatuses(true);
                    }}
                  >
                    <CalendarDays size={18} />
                    Browse All Tournaments
                  </button>
                  {!searchQuery.trim() ? <button
                    type="button"
                    className={styles.emptyStateSecondaryAction}
                    onClick={() => {
                      setShowAllStatuses(true);
                    }}
                  >
                    <Plus size={18} />
                    {`List a Tournament in ${selectedState?.stateName ?? 'This State'}`}
                  </button> : null}
                </div>
              )}
            </div>

            {!isLoading && visibleTournaments.length > 0 && (
              <button
                type="button"
                className={styles.panelFooter}
                disabled={!selectedState}
                onClick={() => {
                  setShowAllStatuses(true);
                }}
              >
                {showAllStatuses
                  ? `Showing All ${selectedState?.stateName ?? 'State'} Tournaments`
                  : `View All ${selectedState?.stateName ?? 'State'} Tournaments`}
              </button>
            )}

            {detailTournament && (
              <div className={styles.detailsModalBackdrop} onClick={closeDetailModal}>
                <section
                  ref={detailModalRef}
                  tabIndex={-1}
                  className={styles.detailsModalCard}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Tournament details"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={handleDetailModalKeyDown}
                >
                  <header className={styles.detailsModalHeader}>
                    <div className={styles.detailsModalTitleGroup}>
                      {detailTournament.logoUrl ? (
                        <div className={styles.detailsModalLogoWrap}>
                          <img src={detailTournament.logoUrl} alt="" className={styles.detailsModalLogo} />
                        </div>
                      ) : null}
                      <div>
                        <span className={styles.detailsModalEyebrow}>Tournament Details</span>
                        <h4>{detailTournament.name}</h4>
                      </div>
                    </div>
                    <button type="button" className={styles.detailsModalClose} onClick={closeDetailModal} aria-label="Close tournament details">
                      <X size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  </header>
                  <div className={styles.detailsModalBody}>
                    <div className={styles.detailsModalFacts}>
                      <p className={styles.detailsModalFactRow}>
                        <span className={styles.detailsModalFactIcon} aria-hidden="true"><CalendarDays size={28} /></span>
                        <strong>Date</strong>
                        <span>{detailTournament.date}</span>
                      </p>
                      <p className={styles.detailsModalFactRow}>
                        <span className={styles.detailsModalFactIcon} aria-hidden="true"><MapPin size={28} /></span>
                        <strong>Location</strong>
                        <span>{detailTournament.locationText}</span>
                      </p>
                      <p className={styles.detailsModalFactRow}>
                        <span className={styles.detailsModalFactIcon} aria-hidden="true"><Clock3 size={28} /></span>
                        <strong>Status</strong>
                        <span className={styles.detailsModalStatusValue}><span className={styles.detailsModalStatusDot} aria-hidden="true" />{statusLabel[detailTournament.status]}</span>
                      </p>
                      <p className={styles.detailsModalFactRow}>
                        <span className={styles.detailsModalFactIcon} aria-hidden="true"><UsersRound size={28} /></span>
                        <strong>Registration</strong>
                        <span className={styles.detailsModalRegistrationValue}><span className={styles.detailsModalRegistrationDot} aria-hidden="true" />{getRegistrationConfigUrl(detailTournament) ? 'Open now' : 'Coming soon'}</span>
                      </p>
                    </div>
                  </div>
                  <footer className={styles.detailsModalFooter}>
                    <span className={styles.detailsModalHint}>
                      <Info size={22} aria-hidden="true" />
                      Complete your bowler details and submit registration directly from this page.
                    </span>
                    <div className={styles.detailsModalActions}>
                      <button type="button" className={styles.detailsModalSecondaryAction} onClick={closeDetailModal}>
                        Done
                      </button>
                      <button
                        type="button"
                        className={styles.detailsModalPrimaryAction}
                        disabled={!getRegistrationConfigUrl(detailTournament)}
                        onClick={(event) => {
                          if (!getRegistrationConfigUrl(detailTournament)) {
                            return;
                          }
                          openRegistrationModal(detailTournament, event.currentTarget);
                        }}
                      >
                        {getRegistrationConfigUrl(detailTournament) ? 'Sign Up' : 'Registration Closed'}
                      </button>
                    </div>
                  </footer>
                </section>
              </div>
            )}

            {registrationTournament && (
              <div className={styles.detailsModalBackdrop} onClick={closeRegistrationModal}>
                <section
                  ref={registrationModalRef}
                  tabIndex={-1}
                  className={styles.registrationModalCard}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Tournament registration"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={handleRegistrationModalKeyDown}
                >
                  {isRegistrationConfigLoading && <p className={styles.detailsModalHint}>Loading tournament registration settings...</p>}
                  {registrationConfigError && <p className={styles.registrationError}>{registrationConfigError}</p>}

                  <TournamentRegistrationForm
                    tournamentName={registrationTournament.name}
                    tournamentDate={registrationTournament.date}
                    tournamentLocation={registrationTournament.locationText}
                    tournamentLogoUrl={registrationTournament.logoUrl}
                    squads={squadsForSelectedEvent}
                    events={eventsForSelectedSquad}
                    divisions={divisionsForSelectedEvent}
                    fields={registrationFields}
                    questions={registrationQuestions}
                    requiredBowlerCount={requiredBowlerCount}
                    formState={registrationForm}
                    setFormState={setRegistrationForm}
                    submitMessage={registrationSubmitMessage}
                    isSubmitting={isSubmittingRegistration}
                    onSubmit={() => {
                      void handleRegistrationSubmit();
                    }}
                    onClose={closeRegistrationModal}
                  />
                </section>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className={`${styles.section} ${styles.featuredSection}`}>
        <div className={styles.featuredLayout}>
          <div className={styles.featuredStrip} aria-label="Featured tournaments">
            <div className={styles.featuredHeader}>Featured Tournaments</div>
            <div className={styles.featuredGrid}>
              {featuredTournaments.map((tournament) => (
                <article key={tournament.id} className={`${styles.featuredCard} ${styles[tournament.tone]}`}>
                  <div className={styles.featuredCardContent}>
                    <div className={styles.featuredIntro}>
                      {tournament.logoUrl ? (
                        <div className={styles.featuredLogoWrap}>
                          <img src={tournament.logoUrl} alt="" className={styles.featuredLogo} loading="lazy" />
                        </div>
                      ) : null}
                      <h3>{tournament.title}</h3>
                    </div>

                    <div className={styles.featuredDivider} aria-hidden="true" />

                    <div className={styles.featuredInfoList}>
                      <p className={styles.featuredVenueRow}>
                        <span className={styles.featuredInfoIcon} aria-hidden="true"><MapPin size={20} /></span>
                        <span>{tournament.venue}</span>
                      </p>
                      {tournament.city ? <p className={styles.featuredCityRow}>{tournament.city}</p> : null}

                      <p className={styles.featuredFooterRow}>
                        <span className={styles.featuredInfoIcon} aria-hidden="true"><CalendarDays size={20} /></span>
                        <span>{tournament.dateLabel}</span>
                      </p>
                    </div>

                    <div className={styles.featuredRegistrationBlock}>
                      <span className={styles.featuredRegistrationIcon} aria-hidden="true">
                        <CalendarCheck2 size={18} />
                      </span>
                      <div className={styles.featuredRegistrationText}>
                        <div className={styles.featuredRegistrationLabel}>Registration Open</div>
                        <div className={styles.featuredRegistrationDate}>Closes {tournament.dateLabel.includes('2025') ? 'Jul 21' : 'Aug 29'}, 2027</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.featuredCardPrimaryAction}
                      onClick={(event) => {
                        lastTriggerRef.current = event.currentTarget;
                        setDetailTournamentId(tournament.id);
                      }}
                    >
                      View Tournament <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.featuredBrandPanel} aria-label="BracketWorks and Tournament Central overview">
            <h2 className={styles.featuredBrandTitle}>BracketWorks + Tournament Central</h2>

            <div className={styles.brandProductRow}>
              <div className={styles.brandProductBlock}>
                <div className={styles.brandWordmarkLogo}>
                  <Image src="/logo_no_text.svg" alt="BracketWorks" width={78} height={78} priority />
                </div>
              </div>

              <div className={styles.brandMath} aria-hidden="true">
                <Plus size={20} strokeWidth={3} />
              </div>

              <div className={styles.brandProductBlock}>
                <div className={styles.brandWordmarkLogo}>
                  <Image src="/TC_logo_No_Text.svg" alt="Tournament Central" width={78} height={78} priority />
                </div>
              </div>
            </div>

            <div className={styles.brandDivider} aria-hidden="true" />

            <div className={styles.brandWorkflowRow}>
              <span className={styles.brandCheck} aria-hidden="true">
                <Link2 size={12} strokeWidth={2.5} />
              </span>
              <p className={styles.featuredBrandSummary}>One connected tournament workflow.</p>
            </div>

            <p className={styles.featuredBrandText}>
              Registration in Tournament Central.<br />
              Brackets, scores, standings, and payouts in BracketWorks.
            </p>

            <button type="button" className={styles.featuredBrandCta}>
              Explore BracketWorks <span aria-hidden="true">→</span>
            </button>

            <div className={styles.featuredBrandFooter}>
              <span className={styles.brandFooterIcon} aria-hidden="true">
                <ShieldCheck size={14} strokeWidth={2.5} />
              </span>
              <span>Built for organizers. Trusted by players.</span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
