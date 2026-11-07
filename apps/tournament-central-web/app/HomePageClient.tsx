"use client";

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ArrowRight, CalendarDays, Link2, LocateFixed, Minus, Plus } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { PublicTournamentDirectoryItem, PublicTournamentDirectoryResponse } from '@bracketworks/types';
import styles from './home.module.css';
import { formatTournamentDate, formatTournamentDateRange, parseTournamentDate } from '@/lib/tournamentDates';
import PublicAccountNav from '@/components/public/PublicAccountNav';
import TournamentInformation from '@/components/public/TournamentInformation';
import type { PublicTournamentDocument } from '@/components/public/TournamentRules';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  EmptyState,
  ICON_SIZE,
  Modal,
  Notice,
  Page,
  SearchField,
  SegmentedControl,
  SelectField,
  TopNav,
  buttonClassName,
  topNavBrandClassName,
} from '@bracketworks/ui';

const TournamentRegistrationForm = dynamic(() => import('@/components/public/TournamentRegistrationForm'));

const TOURNAMENT_PAGE_SIZE = 24;

type TournamentStatus = 'UPCOMING' | 'IN PROGRESS' | 'PAST RESULTS';
type StatusFilter = 'upcoming' | 'weekend' | 'in-progress' | 'past';
type NearMeState =
  | { status: 'off' }
  | { status: 'locating' }
  | { status: 'on'; latitude: number; longitude: number }
  | { status: 'error'; message: string };
type RegistrationWindow =
  | { kind: 'none' }
  | { kind: 'open'; closesLabel: string }
  | { kind: 'closing'; closesLabel: string; urgency: string }
  | { kind: 'closed' };

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
  registrationDeadline: string | null;
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
  details?: { rulesText?: string };
  documents?: PublicTournamentDocument[];
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

const STATUS_FILTERS: StatusFilter[] = ['upcoming', 'weekend', 'in-progress', 'past'];
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  upcoming: 'Upcoming',
  weekend: 'This weekend',
  'in-progress': 'In progress',
  past: 'Past results',
};
const CLOSING_SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const EARTH_RADIUS_MILES = 3958.8;

const statusLabel: Record<TournamentStatus, string> = {
  UPCOMING: 'Upcoming',
  'IN PROGRESS': 'In progress',
  'PAST RESULTS': 'Past results',
};

const mapGeographyStyle = {
  default: { outline: 'none' },
  hover: { outline: 'none' },
  pressed: { outline: 'none' },
} as const;

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
  // On Sunday the current weekend is still this weekend.
  const offsetToSaturday = today.getDay() === 0 ? -1 : 6 - today.getDay();
  const weekendStart = new Date(today);
  weekendStart.setHours(0, 0, 0, 0);
  weekendStart.setDate(today.getDate() + offsetToSaturday);
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setDate(weekendStart.getDate() + 2);

  const start = tournament.startDate ?? tournament.endDate;
  const end = tournament.endDate ?? tournament.startDate;
  return Boolean(start && end && start < weekendEnd && end >= weekendStart);
}

function matchesStatusFilter(tournament: Tournament, filter: StatusFilter): boolean {
  if (filter === 'weekend') return tournament.status !== 'PAST RESULTS' && isTournamentThisWeekend(tournament);
  if (filter === 'in-progress') return tournament.status === 'IN PROGRESS';
  if (filter === 'past') return tournament.status === 'PAST RESULTS';
  return tournament.status === 'UPCOMING';
}

function getDistanceInMiles(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(fromLatitude)) * Math.cos(toRadians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

function formatDistance(miles: number): string {
  if (miles < 1) return 'Under 1 mi away';
  return `${Math.round(miles).toLocaleString('en-US')} mi away`;
}

function getRegistrationWindow(tournament: Tournament): RegistrationWindow {
  if (tournament.status !== 'UPCOMING' || !tournament.registrationDeadline) return { kind: 'none' };
  const deadline = parseTournamentDate(tournament.registrationDeadline);
  if (!deadline) return { kind: 'none' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDay = new Date(deadline);
  deadlineDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((deadlineDay.getTime() - today.getTime()) / DAY_MS);
  const closesLabel = formatTournamentDate(tournament.registrationDeadline);
  if (daysLeft < 0) return { kind: 'closed' };
  if (daysLeft <= CLOSING_SOON_DAYS) {
    const urgency = daysLeft === 0 ? 'Closes today' : daysLeft === 1 ? 'Closes tomorrow' : `Closes in ${daysLeft} days`;
    return { kind: 'closing', closesLabel, urgency };
  }
  return { kind: 'open', closesLabel };
}

function readFiltersFromUrl(): { query: string; stateCode: string; status: StatusFilter } {
  const params = new URL(window.location.href).searchParams;
  const stateParam = (params.get('state') ?? '').trim().toUpperCase();
  const statusParam = params.get('status') as StatusFilter | null;
  return {
    query: params.get('q') ?? '',
    stateCode: STATE_NAME_BY_CODE[stateParam] ? stateParam : '',
    status: statusParam && STATUS_FILTERS.includes(statusParam) ? statusParam : 'upcoming',
  };
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

function normalizePublicTournamentItems(items: PublicTournamentDirectoryItem[]): Tournament[] {
  return items.map((item) => {
    const startDate = parseTournamentDate(item.start_date);
    const endDate = parseTournamentDate(item.end_date);
    if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(item.end_date ?? '')) endDate.setHours(23, 59, 59, 999);
    const location = parseLocation(item.location);
    const stateCodeFromPayload = (item.state_code ?? '').trim().toUpperCase();
    const stateNameFromPayload = (item.state_name ?? '').trim();
    const stateCodeFromStateName = stateNameFromPayload
      ? (STATE_CODE_BY_NAME.get(stateNameFromPayload.toUpperCase()) ?? '')
      : '';
    const normalizedStateCode =
      (stateCodeFromPayload && STATE_NAME_BY_CODE[stateCodeFromPayload] ? stateCodeFromPayload : '')
      || stateCodeFromStateName
      || location.stateCode;
    const normalizedStateName = stateNameFromPayload
      || (normalizedStateCode ? (STATE_NAME_BY_CODE[normalizedStateCode] ?? '') : '');
    const stateLabel = normalizedStateCode || normalizedStateName || 'TBD';
    const locationSuffix = normalizedStateCode || normalizedStateName;

    return {
      id: String(item.id),
      name: item.name,
      date: formatTournamentDateRange(item.start_date, item.end_date),
      startDate,
      endDate,
      venue: location.venue,
      city: location.city,
      stateCode: normalizedStateCode,
      stateLabel,
      logoUrl: item.logo_url ?? null,
      publicUrl: item.public_url ?? null,
      registrationUrl: item.registration_url ?? null,
      registrationDeadline: item.registration_close_date ?? null,
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
}

type HomePageClientProps = {
  initialDirectory: PublicTournamentDirectoryResponse | null;
};

export default function HomePageClient({ initialDirectory }: HomePageClientProps) {
  const [directoryTournaments, setAllTournaments] = useState<Tournament[]>(() =>
    normalizePublicTournamentItems(initialDirectory?.tournaments ?? []),
  );
  const [linkedTournament, setLinkedTournament] = useState<Tournament | null>(null);
  const allTournaments = useMemo(() => linkedTournament && !directoryTournaments.some((entry) => entry.id === linkedTournament.id)
    ? [...directoryTournaments, linkedTournament] : directoryTournaments, [directoryTournaments, linkedTournament]);
  const [isLoading, setIsLoading] = useState(initialDirectory === null);
  const [heartbeatState, setHeartbeatState] = useState<'live' | 'stale' | 'checking'>('live');
  // '' means all states. The map, the state select, and the URL all drive this one value.
  const [stateFilter, setStateFilter] = useState('');
  const selectedStateCode = stateFilter;
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('upcoming');
  const [nearMe, setNearMe] = useState<NearMeState>({ status: 'off' });
  const [filtersReady, setFiltersReady] = useState(false);
  const [selectedStateOutline, setSelectedStateOutline] = useState<{ d: string; viewBox: string } | null>(null);
  const [mapViewport, setMapViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [visibleTournamentCount, setVisibleTournamentCount] = useState(TOURNAMENT_PAGE_SIZE);
  const [mapSize, setMapSize] = useState({ width: 960, height: 520 });
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null);
  const [detailLinkError, setDetailLinkError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareError, setShareError] = useState('');
  const detailHistoryEntryRef = useRef(false);
  const [registrationTournamentId, setRegistrationTournamentId] = useState<string | null>(null);
  const [registrationConfig, setRegistrationConfig] = useState<PublicTcRegistrationConfigResponse | null>(null);
  const [isRegistrationConfigLoading, setIsRegistrationConfigLoading] = useState(false);
  const [registrationConfigError, setRegistrationConfigError] = useState<string | null>(null);
  const [registrationSubmitMessage, setRegistrationSubmitMessage] = useState<string | null>(null);
  const [registrationConfirmation, setRegistrationConfirmation] = useState<{ code: string; status: string } | null>(null);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(EMPTY_REGISTRATION_FORM);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const closeDetailModal = () => {
    setDetailTournamentId(null);
    setDetailLinkError('');
    if (detailHistoryEntryRef.current) {
      detailHistoryEntryRef.current = false;
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('tournament');
      window.history.replaceState(window.history.state, '', url);
    }
  };
  const openDetailModal = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tournament', id);
    window.history.pushState(window.history.state, '', url);
    detailHistoryEntryRef.current = true;
    setDetailTournamentId(id);
    setDetailLinkError('');
    setShareMessage('');
    setShareError('');
  };
  const lastSuccessfulHeartbeatRef = useRef(0);

  useEffect(() => {
    lastSuccessfulHeartbeatRef.current = Date.now();
  }, []);

  useEffect(() => {
    const syncDetailsFromUrl = () => {
      const id = new URL(window.location.href).searchParams.get('tournament');
      setDetailTournamentId(id);
      setRegistrationTournamentId(null);
      setDetailLinkError('');
      setShareMessage('');
      setShareError('');
      detailHistoryEntryRef.current = false;
    };
    syncDetailsFromUrl();
    window.addEventListener('popstate', syncDetailsFromUrl);
    return () => window.removeEventListener('popstate', syncDetailsFromUrl);
  }, []);

  useEffect(() => {
    if (!detailTournamentId || isLoading || allTournaments.some((entry) => entry.id === detailTournamentId)) return;
    if (!/^tc-[1-9]\d*$/.test(detailTournamentId)) {
      setDetailLinkError('This tournament link is invalid.');
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/v1/public/tournaments?source=tc&tournament_id=${detailTournamentId.slice(3)}&limit=1`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to load this tournament. Please reload to try again.');
        const payload = await response.json() as PublicTournamentDirectoryResponse;
        if (!Array.isArray(payload.tournaments)) throw new Error('The server returned invalid tournament details. Please reload to try again.');
        const tournament = normalizePublicTournamentItems(payload.tournaments).find((entry) => entry.id === detailTournamentId);
        if (!tournament) throw new Error('This tournament is unavailable or is no longer public.');
        if (!controller.signal.aborted) setLinkedTournament(tournament);
      } catch (cause) {
        if (!controller.signal.aborted) setDetailLinkError(cause instanceof Error ? cause.message : 'Unable to load this tournament.');
      }
    })();
    return () => controller.abort();
  }, [detailTournamentId, isLoading, allTournaments]);

  const copyDetailLink = async () => {
    setShareMessage('');
    setShareError('');
    try {
      const url = new URL('/', window.location.origin);
      if (detailTournamentId) url.searchParams.set('tournament', detailTournamentId);
      await navigator.clipboard.writeText(url.toString());
      setShareMessage('Tournament link copied.');
    } catch {
      setShareError('Unable to copy the link. Copy the tournament URL from your browser address bar.');
    }
  };

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

  const loadDirectory = useCallback(async () => {
    setHeartbeatState('checking');

    try {
      const response = await fetch('/api/v1/public/tournaments?source=tc&limit=300');

      if (!response.ok) {
        throw new Error('Unable to load tournament directory.');
      }

      const payload = await response.json() as PublicTournamentDirectoryResponse;
      const items = Array.isArray(payload.tournaments) ? payload.tournaments : [];
      setAllTournaments(normalizePublicTournamentItems(items));
      lastSuccessfulHeartbeatRef.current = Date.now();
      setHeartbeatState('live');
    } catch {
      setHeartbeatState('stale');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialDirectory) {
      lastSuccessfulHeartbeatRef.current = Date.now();
      setHeartbeatState('live');
    } else {
      void loadDirectory();
    }

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
  }, [initialDirectory, loadDirectory]);

  // Filters live in the URL (q, state, status) so Back, reloads, and shared links keep them.
  useEffect(() => {
    const filters = readFiltersFromUrl();
    setSearchQuery(filters.query);
    setStateFilter(filters.stateCode);
    setStatusFilter(filters.status);
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const url = new URL(window.location.href);
    const setParam = (key: string, value: string) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    };
    setParam('q', searchQuery.trim());
    setParam('state', stateFilter);
    setParam('status', statusFilter === 'upcoming' ? '' : statusFilter);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [filtersReady, searchQuery, stateFilter, statusFilter]);

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

  // States in the select: every state with a listing, plus the chosen state even when it has none.
  const stateOptions = useMemo(() => [...stateSummariesByCode.values()]
    .filter((summary) => summary.tournaments.length > 0 || summary.stateCode === stateFilter)
    .sort((a, b) => a.stateName.localeCompare(b.stateName)), [stateFilter, stateSummariesByCode]);

  const selectedStateName = stateFilter ? (STATE_NAME_BY_CODE[stateFilter] ?? stateFilter) : '';

  const userLocation = nearMe.status === 'on' ? nearMe : null;
  const distanceById = useMemo(() => {
    const distances = new Map<string, number>();
    if (!userLocation) return distances;
    for (const tournament of allTournaments) {
      if (tournament.latitude === null || tournament.longitude === null) continue;
      distances.set(tournament.id, getDistanceInMiles(
        userLocation.latitude, userLocation.longitude, tournament.latitude, tournament.longitude,
      ));
    }
    return distances;
  }, [allTournaments, userLocation]);

  // Everything that matches the search and state, before the status filter. Status counts come from this.
  const scopedTournaments = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    return allTournaments.filter((tournament) => {
      if (stateFilter && tournament.stateCode !== stateFilter) return false;
      return !normalizedQuery
        || tournament.name.toLowerCase().includes(normalizedQuery)
        || tournament.venue.toLowerCase().includes(normalizedQuery)
        || tournament.city.toLowerCase().includes(normalizedQuery)
        || (STATE_NAME_BY_CODE[tournament.stateCode] ?? '').toLowerCase().includes(normalizedQuery)
        || tournament.stateCode.toLowerCase() === normalizedQuery;
    });
  }, [allTournaments, deferredSearchQuery, stateFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { upcoming: 0, weekend: 0, 'in-progress': 0, past: 0 };
    for (const tournament of scopedTournaments) {
      for (const filter of STATUS_FILTERS) {
        if (matchesStatusFilter(tournament, filter)) counts[filter] += 1;
      }
    }
    return counts;
  }, [scopedTournaments]);

  const visibleTournaments = useMemo(() => {
    const byDate = (a: Tournament, b: Tournament) => {
      const aTime = a.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.startDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return statusFilter === 'past' ? bTime - aTime : aTime - bTime;
    };
    return scopedTournaments
      .filter((tournament) => matchesStatusFilter(tournament, statusFilter))
      .sort((a, b) => {
        if (distanceById.size > 0) {
          const aMiles = distanceById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bMiles = distanceById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          if (aMiles !== bMiles) return aMiles - bMiles;
        }
        return byDate(a, b);
      });
  }, [distanceById, scopedTournaments, statusFilter]);

  useEffect(() => {
    setVisibleTournamentCount(TOURNAMENT_PAGE_SIZE);
  }, [deferredSearchQuery, stateFilter, statusFilter, nearMe.status]);

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
    () => getRequiredBowlerCountFromEvent(selectedRegistrationEvent),
    [selectedRegistrationEvent],
  );

  const openRegistrationModal = (tournament: Tournament, triggerElement?: HTMLElement | null) => {
    setRegistrationConfirmation(null);
    if (triggerElement && !triggerElement.closest('[role="dialog"]')) {
      lastTriggerRef.current = triggerElement;
    }

    setRegistrationTournamentId(tournament.id);
    setRegistrationConfig(null);
    setRegistrationConfigError(null);
    setRegistrationSubmitMessage(null);
    setIsSubmittingRegistration(false);
    setRegistrationForm(EMPTY_REGISTRATION_FORM);
  };

  const closeRegistrationModal = () => {
    setRegistrationConfirmation(null);
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

      const eventForCount = allowedEvents.find((event) => event.id === next.eventId) ?? allowedEvents[0] ?? null;
      const expectedBowlerCount = getRequiredBowlerCountFromEvent(eventForCount);
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
  }, [registrationDivisions, registrationEvents, registrationForm.eventId, registrationSquads, registrationTournamentId]);

  const handleRegistrationSubmit = async () => {
    if (isSubmittingRegistration || registrationConfirmation) return;
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
      setRegistrationSubmitMessage(`This event requires ${requiredBowlerCount} bowler form${requiredBowlerCount === 1 ? '' : 's'}.`);
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

      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('registration_id' in result) || typeof result.registration_id !== 'string'
        || !('status' in result) || typeof result.status !== 'string') {
        throw new Error('The server did not return a confirmation number. Contact the organizer before submitting again.');
      }
      setRegistrationConfirmation({ code: result.registration_id, status: result.status });
    } catch (error) {
      setRegistrationSubmitMessage(error instanceof Error ? error.message : 'Unable to submit registration right now.');
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const closingSoonTournaments = useMemo(() => allTournaments
    .map((tournament) => ({ tournament, window: getRegistrationWindow(tournament) }))
    .filter((entry) => entry.window.kind === 'open' || entry.window.kind === 'closing')
    .sort((a, b) => (a.tournament.registrationDeadline ?? '').localeCompare(b.tournament.registrationDeadline ?? ''))
    .slice(0, 3), [allTournaments]);

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

  const scrollToResultsWhenStacked = () => {
    // Only scroll when the results are off screen (the stacked layout puts them above the map).
    const results = resultsRef.current;
    if (!results) return;
    const { top } = results.getBoundingClientRect();
    if (top >= 0 && top < window.innerHeight / 2) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    results.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const handleStateSelect = (stateCode: string, event: ReactMouseEvent<SVGPathElement>) => {
    if (stateCode === stateFilter) {
      setStateFilter('');
      return;
    }
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

    setStateFilter(stateCode);
    setNearMe((previous) => (previous.status === 'on' ? { status: 'off' } : previous));
    scrollToResultsWhenStacked();
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

  const statusOptions = STATUS_FILTERS.map((value) => ({
    value,
    label: STATUS_FILTER_LABEL[value],
    count: statusCounts[value],
  }));

  const selectState = (stateCode: string) => {
    setStateFilter(stateCode);
    if (stateCode) setNearMe((previous) => (previous.status === 'on' ? { status: 'off' } : previous));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStateFilter('');
  };

  const toggleNearMe = () => {
    if (nearMe.status === 'on' || nearMe.status === 'locating') {
      setNearMe({ status: 'off' });
      return;
    }
    if (!('geolocation' in navigator)) {
      setNearMe({ status: 'error', message: "This browser can't share your location. Choose a state instead." });
      return;
    }
    setNearMe({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStateFilter('');
        setNearMe((previous) => (previous.status === 'locating'
          ? { status: 'on', latitude: position.coords.latitude, longitude: position.coords.longitude }
          : previous));
      },
      (error) => {
        setNearMe((previous) => (previous.status === 'locating'
          ? {
            status: 'error',
            message: error.code === error.PERMISSION_DENIED
              ? 'Location access is blocked. Allow it in your browser settings, or choose a state instead.'
              : "We couldn't find your location. Try again, or choose a state instead.",
          }
          : previous));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const trimmedQuery = deferredSearchQuery.trim();
  const resultsTitle = trimmedQuery
    ? `Results for "${trimmedQuery}"${selectedStateName ? ` in ${selectedStateName}` : ''}`
    : selectedStateName || (userLocation ? 'Near you' : 'All states');
  const resultCount = visibleTournaments.length;
  const plural = resultCount === 1 ? '' : 's';
  const resultsCountText = {
    upcoming: `${resultCount} upcoming tournament${plural}`,
    weekend: `${resultCount} tournament${plural} this weekend`,
    'in-progress': `${resultCount} tournament${plural} in progress`,
    past: `${resultCount} past tournament${plural}`,
  }[statusFilter];
  const resultsOrderText = userLocation ? 'Nearest first' : statusFilter === 'past' ? 'Most recent first' : 'Soonest first';
  const otherStatusWithResults = STATUS_FILTERS.find((filter) => filter !== statusFilter && statusCounts[filter] > 0) ?? null;
  const statusNoun = {
    upcoming: 'upcoming tournaments',
    weekend: 'tournaments this weekend',
    'in-progress': 'tournaments in progress',
    past: 'past tournaments',
  }[statusFilter];

  const statusTone = (status: TournamentStatus) => (status === 'UPCOMING' ? 'info' : status === 'IN PROGRESS' ? 'success' : 'neutral') as 'info' | 'success' | 'neutral';

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <TopNav
        brand={(
          <Link href="/" aria-label="Tournament Central home" className={topNavBrandClassName()}>
            <Image src="/TC_logo_No_Text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
            Tournament Central
          </Link>
        )}
        actions={<PublicAccountNav />}
      />

      <main id="main-content">
        <Page>
          {detailTournamentId && !allTournaments.some((entry) => entry.id === detailTournamentId) ? (
            <Notice
              tone={detailLinkError ? 'danger' : 'info'}
              role={detailLinkError ? 'alert' : 'status'}
              action={<Button size="sm" variant="ghost" onClick={closeDetailModal}>Back to tournaments</Button>}
            >
              {detailLinkError || 'Loading tournament details...'}
            </Notice>
          ) : null}

          <Card id="tournament-directory" aria-labelledby="find-a-tournament-title">
            <div className={styles.discovery}>
              <div className={styles.discoveryIntro}>
                <h1 id="find-a-tournament-title" className={styles.pageTitle}>Find a tournament</h1>
                <p className={styles.body}>Search by tournament, bowling center, city, or state.</p>
              </div>
              <SearchField
                label="Search tournaments, bowling centers, cities, or states"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tournaments, bowling centers, cities, or states"
              />
              <div className={styles.filters}>
                <SegmentedControl
                  label="Tournament status"
                  className={styles.statusFilter}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
                />
                <SelectField
                  label="State"
                  hideLabel
                  className={styles.stateSelect}
                  value={stateFilter}
                  onChange={(event) => selectState(event.target.value)}
                >
                  <option value="">All states</option>
                  {stateOptions.map((summary) => (
                    <option key={summary.stateCode} value={summary.stateCode}>
                      {summary.stateName} ({summary.tournaments.length})
                    </option>
                  ))}
                </SelectField>
                <Button
                  className={styles.nearMe}
                  variant={nearMe.status === 'on' ? 'secondary' : 'ghost'}
                  icon={<LocateFixed size={ICON_SIZE.md} aria-hidden="true" />}
                  aria-pressed={nearMe.status === 'on'}
                  disabled={nearMe.status === 'locating'}
                  onClick={toggleNearMe}
                >
                  {nearMe.status === 'locating' ? 'Finding your location...' : 'Near me'}
                </Button>
              </div>
              {nearMe.status === 'error' ? (
                <Notice
                  tone="warning"
                  role="alert"
                  action={<Button size="sm" variant="ghost" onClick={() => setNearMe({ status: 'off' })}>Dismiss</Button>}
                >
                  {nearMe.message}
                </Notice>
              ) : null}
            </div>
          </Card>

          <div className={styles.layoutGrid}>
            <Card padding="flush" className={styles.mapCard} aria-label="United States tournament map">
              <div
                ref={mapShellRef}
                id="state-map"
                className={styles.map}
                role="group"
                aria-label="United States tournament map"
              >
                <div className={styles.mapControls} role="toolbar" aria-label="Map zoom controls">
                  <Button size="sm" variant="secondary" iconOnly icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => handleZoomChange(0.45)} aria-label="Zoom in on map" />
                  <Button size="sm" variant="secondary" iconOnly icon={<Minus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => handleZoomChange(-0.45)} aria-label="Zoom out on map" />
                  <Button size="sm" variant="secondary" onClick={handleZoomReset} aria-label="Reset map zoom">Reset</Button>
                </div>
                <p className={styles.mapHint}>
                  Select a state to filter. Drag to move the map; zoom with the buttons or hold Ctrl and scroll.
                </p>
                <ComposableMap projection="geoAlbersUsa" className={styles.mapSvg}>
                  <ZoomableGroup
                    center={mapViewport.center}
                    zoom={mapViewport.zoom}
                    minZoom={MIN_MAP_ZOOM}
                    maxZoom={MAX_MAP_ZOOM}
                    translateExtent={mapTranslateExtent}
                    filterZoomEvent={(event) => {
                      // Plain scrolling and one-finger swipes keep scrolling the page.
                      const sourceEvent = event as unknown as MouseEvent & { touches?: TouchList };
                      if (sourceEvent.type === 'wheel') return sourceEvent.ctrlKey || sourceEvent.metaKey;
                      if (sourceEvent.type === 'dblclick') return false;
                      if (sourceEvent.type.startsWith('touch')) return (sourceEvent.touches?.length ?? 0) > 1;
                      return !sourceEvent.button;
                    }}
                    onMoveStart={() => setIsMapInteracting(true)}
                    onMoveEnd={({ coordinates, zoom }) => {
                      const nextZoom = clampZoom(zoom);
                      if (nextZoom <= MIN_MAP_ZOOM + 0.0001) {
                        setMapViewport(DEFAULT_MAP_VIEWPORT);
                        setIsMapInteracting(false);
                        return;
                      }
                      setMapViewport({ center: [coordinates[0], coordinates[1]], zoom: nextZoom });
                      setIsMapInteracting(false);
                    }}
                  >
                    <Geographies geography={USA_STATES_GEO_URL}>
                      {({ geographies }) => [...geographies].sort((left, right) => {
                        const leftCode = STATE_FIPS_TO_CODE[String(left.id).padStart(2, '0')];
                        const rightCode = STATE_FIPS_TO_CODE[String(right.id).padStart(2, '0')];
                        return Number(leftCode === selectedStateCode) - Number(rightCode === selectedStateCode);
                      }).map((geo) => {
                        const stateCode = STATE_FIPS_TO_CODE[String(geo.id).padStart(2, '0')];
                        const tone = stateCode ? (stateToneByCode.get(stateCode) ?? 'none') : 'none';
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            className={styles.state}
                            data-state-code={stateCode ?? ''}
                            data-selected={stateCode === selectedStateCode ? 'true' : 'false'}
                            data-tone={tone}
                            onClick={(event) => {
                              if (stateCode) handleStateSelect(stateCode, event as ReactMouseEvent<SVGPathElement>);
                            }}
                            style={mapGeographyStyle}
                          />
                        );
                      })}
                    </Geographies>
                    {venueMapMarkers.map((marker) => {
                      const tournamentCount = marker.tournaments.length;
                      const representativeTournament = marker.tournaments[0];
                      const markerLabel = [
                        representativeTournament.name,
                        marker.venue,
                        `${marker.city}${marker.stateCode ? `, ${marker.stateCode}` : ''}`,
                        representativeTournament.date,
                        tournamentCount > 1 ? `${tournamentCount} tournaments at this venue` : null,
                      ].filter(Boolean).join('\n');
                      const selectMarker = () => {
                        if (tournamentCount > 1) {
                          setStateFilter('');
                          setSearchQuery(marker.venue);
                          scrollToResultsWhenStacked();
                          return;
                        }
                        openDetailModal(representativeTournament.id);
                      };
                      return (
                        <Marker key={marker.key} coordinates={marker.coordinates}>
                          <g
                            className={styles.marker}
                            data-muted={selectedStateCode && marker.stateCode !== selectedStateCode ? 'true' : 'false'}
                            role="button"
                            tabIndex={0}
                            aria-label={markerLabel}
                            onClick={selectMarker}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                selectMarker();
                              }
                            }}
                          >
                            <title>{markerLabel}</title>
                            <circle className={styles.markerDot} r={tournamentCount >= 4 ? 4.5 : tournamentCount >= 2 ? 3.25 : 2.25} />
                            {tournamentCount >= 4 ? <text className={styles.markerCount} y={0.5}>{tournamentCount}</text> : null}
                          </g>
                        </Marker>
                      );
                    })}
                  </ZoomableGroup>
                </ComposableMap>
              </div>
            </Card>

            <div ref={resultsRef} className={styles.resultsColumn}>
              <Card id="state-results" className={styles.statePanel} aria-labelledby="results-title">
                <div className={styles.stateHeader}>
                  {stateFilter && selectedStateOutline ? (
                    <svg className={styles.stateShape} viewBox={selectedStateOutline.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
                      <path d={selectedStateOutline.d} />
                    </svg>
                  ) : null}
                  <div className={styles.stateTitle}>
                    <h2 id="results-title" className={styles.sectionTitle}>{resultsTitle}</h2>
                    <p className={styles.helper} role="status">
                      {isLoading ? 'Loading tournaments...' : `${resultsCountText} · ${resultsOrderText}`}
                    </p>
                  </div>
                  {stateFilter || trimmedQuery ? (
                    <Button size="sm" variant="ghost" className={styles.clearFilters} onClick={clearFilters}>Clear filters</Button>
                  ) : null}
                </div>

                <div className={styles.stateList}>
                  {renderedTournaments.length > 0 ? (
                    <ul className={styles.rows}>
                      {renderedTournaments.map((tournament) => {
                        const registration = getRegistrationWindow(tournament);
                        const miles = distanceById.get(tournament.id);
                        const canRegister = Boolean(getRegistrationConfigUrl(tournament))
                          && tournament.status === 'UPCOMING'
                          && registration.kind !== 'closed';
                        return (
                          <li key={tournament.id} className={styles.row}>
                            <div className={styles.rowMain}>
                              {tournament.logoUrl ? (
                                <img src={tournament.logoUrl} alt="" className={styles.logo} loading="lazy" />
                              ) : (
                                <Avatar name={tournament.name} />
                              )}
                              <div className={styles.rowText}>
                                <span className={styles.rowTitle}>{tournament.name}</span>
                                <span className={styles.rowMeta}>{tournament.date}</span>
                                <span className={styles.rowMeta}>
                                  {tournament.venue} · {tournament.city}, {tournament.stateLabel}
                                  {miles !== undefined ? ` · ${formatDistance(miles)}` : ''}
                                </span>
                                {registration.kind === 'open' || registration.kind === 'closing' ? (
                                  <span className={styles.rowMeta}>Registration closes {registration.closesLabel}</span>
                                ) : null}
                              </div>
                              {registration.kind === 'closing' ? <Badge tone="warning">{registration.urgency}</Badge>
                                : registration.kind === 'closed' ? <Badge tone="neutral">Registration closed</Badge>
                                  : tournament.status !== 'UPCOMING' ? <Badge tone={statusTone(tournament.status)}>{statusLabel[tournament.status]}</Badge>
                                    : null}
                            </div>
                            <div className={styles.rowActions}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(event) => {
                                  lastTriggerRef.current = event.currentTarget;
                                  openDetailModal(tournament.id);
                                }}
                              >
                                View details
                              </Button>
                              {canRegister ? (
                                <Button size="sm" variant="accent-outline" onClick={(event) => openRegistrationModal(tournament, event.currentTarget)}>
                                  Register
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {hasMoreTournaments ? (
                    <Button variant="ghost" onClick={() => setVisibleTournamentCount((prev) => prev + TOURNAMENT_PAGE_SIZE)}>
                      Load more ({visibleTournaments.length - renderedTournaments.length} remaining)
                    </Button>
                  ) : null}

                  {!isLoading && visibleTournaments.length === 0 ? (
                    <EmptyState
                      icon={<CalendarDays size={ICON_SIZE['2xl']} aria-hidden="true" />}
                      title={trimmedQuery ? 'No matching tournaments' : `No ${statusNoun}${selectedStateName ? ` in ${selectedStateName}` : ''}`}
                      description={trimmedQuery
                        ? 'Check the spelling, or clear the search to see every tournament.'
                        : otherStatusWithResults
                          ? `There are ${statusCounts[otherStatusWithResults]} ${STATUS_FILTER_LABEL[otherStatusWithResults].toLowerCase()} instead.`
                          : selectedStateName
                            ? 'Try another state, or look at every state.'
                            : 'Check back soon. New tournaments are listed here as organizers publish them.'}
                      action={trimmedQuery ? (
                        <Button variant="secondary" onClick={() => setSearchQuery('')}>Clear search</Button>
                      ) : otherStatusWithResults ? (
                        <Button variant="secondary" onClick={() => setStatusFilter(otherStatusWithResults)}>
                          Show {STATUS_FILTER_LABEL[otherStatusWithResults].toLowerCase()}
                        </Button>
                      ) : selectedStateName ? (
                        <Button variant="secondary" onClick={() => setStateFilter('')}>Show all states</Button>
                      ) : undefined}
                    />
                  ) : null}
                </div>
              </Card>
            </div>
          </div>

          <div className={styles.featuredLayout}>
            <Card aria-labelledby="closing-soon-title">
              <CardHeader title={<span id="closing-soon-title">Registration closing soon</span>} />
              {closingSoonTournaments.length === 0 ? (
                <p className={styles.helper}>No tournaments are taking registrations right now.</p>
              ) : (
                <ul className={styles.featuredGrid}>
                  {closingSoonTournaments.map(({ tournament, window: registration }) => (
                    <li key={tournament.id} className={styles.featuredItem}>
                      <div className={styles.featuredIdentity}>
                        {tournament.logoUrl ? <img src={tournament.logoUrl} alt="" className={styles.logo} loading="lazy" /> : <Avatar name={tournament.name} />}
                        <h3 className={styles.featuredTitle}>{tournament.name}</h3>
                      </div>
                      <dl className={styles.featuredFacts}>
                        <div>
                          <dt>Registration</dt>
                          <dd>
                            {registration.kind === 'closing' ? <Badge tone="warning">{registration.urgency}</Badge> : null}
                            <span>{registration.kind === 'open' || registration.kind === 'closing' ? `Closes ${registration.closesLabel}` : ''}</span>
                          </dd>
                        </div>
                        <div><dt>Date</dt><dd>{tournament.date}</dd></div>
                        <div>
                          <dt>Location</dt>
                          <dd>{tournament.venue}<span className={styles.rowMeta}>{tournament.city}{tournament.stateLabel ? `, ${tournament.stateLabel}` : ''}</span></dd>
                        </div>
                      </dl>
                      <Button
                        variant="secondary"
                        fullWidth
                        icon={<ArrowRight size={ICON_SIZE.md} aria-hidden="true" />}
                        iconPosition="end"
                        onClick={(event) => {
                          lastTriggerRef.current = event.currentTarget;
                          openDetailModal(tournament.id);
                        }}
                      >
                        View tournament
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card aria-labelledby="organizers-title">
              <CardHeader title={<span id="organizers-title">Running a tournament?</span>} />
              <div className={styles.brandBody}>
                <p className={styles.body}>
                  List it on Tournament Central to take registrations online. Then run brackets, scores, standings, and payouts in BracketWorks.
                </p>
                <Link className={buttonClassName({ variant: 'secondary', fullWidth: true })} href="/organizer">
                  List your tournament
                </Link>
                <a className={buttonClassName({ variant: 'ghost', fullWidth: true })} href="https://bracketworks.app">
                  Learn about BracketWorks
                </a>
              </div>
            </Card>
          </div>
        </Page>
      </main>

      <Modal
        open={Boolean(detailTournament && !registrationTournament)}
        onClose={closeDetailModal}
        title={detailTournament?.name ?? 'Tournament'}
        description="Review tournament information, availability, and documents before registering."
        size="lg"
        closeLabel="Close tournament details"
        footer={detailTournament ? (
          <>
            <Button variant="secondary" icon={<Link2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => void copyDetailLink()}>Copy link</Button>
            <Button
              variant="primary"
              disabled={!getRegistrationConfigUrl(detailTournament)}
              onClick={(event) => {
                if (getRegistrationConfigUrl(detailTournament)) openRegistrationModal(detailTournament, event.currentTarget);
              }}
            >
              {getRegistrationConfigUrl(detailTournament) ? 'Register' : 'Registration closed'}
            </Button>
          </>
        ) : undefined}
      >
        {detailTournament ? (
          <div className={styles.details}>
            <div className={styles.detailsSummary}>
              {detailTournament.logoUrl ? <img src={detailTournament.logoUrl} alt="" className={styles.detailsLogo} /> : null}
              <dl className={styles.detailsFacts}>
                <div><dt>Status</dt><dd><Badge tone={statusTone(detailTournament.status)}>{statusLabel[detailTournament.status]}</Badge></dd></div>
                <div><dt>Date</dt><dd>{detailTournament.date}</dd></div>
                <div><dt>Location</dt><dd>{detailTournament.locationText}</dd></div>
              </dl>
            </div>
            {shareMessage ? <Notice tone="success" role="status">{shareMessage}</Notice> : null}
            {shareError ? <Notice tone="danger" role="alert">{shareError}</Notice> : null}
            <CardDivider />
            <TournamentInformation configUrl={getRegistrationConfigUrl(detailTournament)} />
          </div>
        ) : null}
      </Modal>

      {registrationTournament ? (
        <TournamentRegistrationForm
          notice={isRegistrationConfigLoading
            ? <Notice tone="info" role="status">Loading tournament registration settings...</Notice>
            : registrationConfigError ? <Notice tone="danger" role="alert">{registrationConfigError}</Notice> : null}
          tournamentName={registrationTournament.name}
          tournamentDate={registrationTournament.date}
          tournamentLocation={registrationTournament.locationText}
          tournamentLogoUrl={registrationTournament.logoUrl}
          rulesText={registrationConfig?.details?.rulesText}
          documents={registrationConfig?.documents}
          confirmation={registrationConfirmation}
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
          onSubmit={handleRegistrationSubmit}
          onClose={closeRegistrationModal}
        />
      ) : null}
    </div>
  );
}
