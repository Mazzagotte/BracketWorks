'use client';

import { ArrowUpDown, CalendarDays, ChevronUp, CircleAlert, CircleCheck, ClipboardList, Clock3, Download, Eye, FileJson, Filter, Globe, GripVertical, Headphones, Layers, Link2, ListOrdered, Lock, MapPin, MoreHorizontal, PencilLine, Plus, RotateCcw, Save, Trash2, Trophy, Upload, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';

import ConfigDrawer from './ConfigDrawer';
import PublishValidationSummary from './PublishValidationSummary';
import { listMyOrganizerSetupStates, listMyTournaments, resolveTcVenue } from './organizerApi';
import { organizerRoutes } from './organizerRoutes';
import TournamentRegistrationForm from '../public/TournamentRegistrationForm';
import TournamentDetailsSection from './setup/TournamentDetailsSection';
import { initialRegistrationFields, setupSections } from './setupConfig';
import SetupStatusBadge from './SetupStatusBadge';
import {
  buildSquadDisplayName,
  buildSquadTimesPayload,
  countTournamentSquads,
  formatDateLabel,
  formatDateShort,
  formatEntryFeeInput,
  formatFileSize,
  formatMoney,
  formatSquadTimeLabel,
  formatTournamentCardDate,
  inferLogoFileLabel,
  normalizeEntryFeeInput,
  parseEntryFeeInputToCents,
} from './setupFormatting';
import {
  buildClientId,
  buildDuplicateName,
  emptyDivision,
  emptyEvent,
  emptyFee,
  emptyLocation,
  emptyQuestion,
  emptySquad,
  normalizeSquadDefaults,
} from './setupFactories';
import {
  getRegistrationFieldInputType,
  getRequiredBowlerCountFromEvent,
  getRequiredBowlerCountFromSquad,
  isRegistrationQuestionAnswered,
  isWideRegistrationField,
  normalizeQuestionOptions,
  normalizeRegistrationFieldKey,
  registrationFieldFallbackHelp,
} from './setupValidation';
import {
  buildDefaultDraft,
  buildOrganizerSetupPayload,
  buildTournamentPayload,
  builtInRegistrationFieldKeys,
  loadDraftFromStorage,
  normalizeEventConfig,
  normalizeEventList,
  normalizeOrganizerDraft,
  normalizeRegistrationFieldsList,
  normalizeSquadConfig,
  normalizeSquadList,
  parseTournamentLocation,
  recommendTournamentStatus,
  reorderItemsByDropTarget,
  toDraftFromTournament,
} from './setupSerialization';
import { DRAFT_VERSION, TIMEZONES, US_STATES, defaultTournamentDetails, getDraftStorageKey } from './setupDefaults';
import {
  deleteTournamentLogo,
  fetchTournamentLogoBlobUrl,
  getCsrfTokenFromCookie,
  saveOrganizerSetupState,
  saveTournamentRecord,
  loadOrganizerSetupState,
  uploadTournamentLogo,
} from './setupPersistence';
import { FeeEditor, FieldEditor, InlineDivisionEditor, InlineEventEditor, LocationEditor, QuestionEditor, SquadEditor } from './setup/InlineEditors';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, RegistrationFieldConfig, RegistrationQuestionAnswerValue, SetupSectionKey, SetupStatus, SquadConfig, ValidationIssue } from './types';
import type {
  OrganizerDraft,
  OrganizerSetupPayload,
  OrganizerSetupStateResponse,
  OrganizerSetupStateSummary,
  PaymentMode,
  PersistedTournament,
  TournamentDetails,
  TournamentTemplate,
  TournamentWritePayload,
  UserTournamentSummary,
} from './setupTypes';
import styles from './tournament-setup.module.css';

type DrawerState =
  | { kind: 'event'; id?: string }
  | { kind: 'division'; id?: string }
  | { kind: 'squad'; id?: string }
  | { kind: 'field'; id?: string }
  | { kind: 'question'; id?: string }
  | { kind: 'fee'; id?: string }
  | { kind: 'location'; id?: string }
  | null;

type CardMenuState =
  | { kind: 'event'; id: string }
  | { kind: 'division'; id: string }
  | null;

type OrganizerRegistrationFormState = {
  bowlers: Array<Record<string, string>>;
  eventId: string;
  divisionId: string;
  squadId: string;
  notes: string;
  bowlerQuestionAnswers: Array<Record<string, RegistrationQuestionAnswerValue>>;
  acceptTerms: boolean;
};

const EMPTY_ORGANIZER_REGISTRATION_FORM: OrganizerRegistrationFormState = {
  bowlers: [{}],
  eventId: '',
  divisionId: '',
  squadId: '',
  notes: '',
  bowlerQuestionAnswers: [{}],
  acceptTerms: false,
};

const sectionLabelMap = new Map(setupSections.map((section) => [section.key, section.label]));

function isSetupSectionKey(value: string | null): value is SetupSectionKey {
  return setupSections.some((section) => section.key === value);
}

function getUrlActiveSection(): SetupSectionKey {
  if (typeof window === 'undefined') {
    return 'tournament-details';
  }

  const params = new URLSearchParams(window.location.search);
  const querySection = params.get('section');
  return isSetupSectionKey(querySection) ? querySection : 'tournament-details';
}

function getInitialTournamentId(forcedTournamentId: number | null): number | null {
  if (typeof forcedTournamentId === 'number' && forcedTournamentId > 0) {
    return forcedTournamentId;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const rawTournamentId = params.get('tournament');
  if (!rawTournamentId) {
    return null;
  }

  const tournamentId = Number(rawTournamentId);
  return Number.isInteger(tournamentId) && tournamentId > 0 ? tournamentId : null;
}

function syncUrlState(params: { activeSection: SetupSectionKey; tournamentId: number | null; includeTournamentInQuery: boolean }): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('section', params.activeSection);

  if (params.includeTournamentInQuery && params.tournamentId) {
    nextUrl.searchParams.set('tournament', String(params.tournamentId));
  } else {
    nextUrl.searchParams.delete('tournament');
  }

  window.history.replaceState(window.history.state, '', nextUrl);
}

type TournamentSetupWorkspaceProps = {
  initialTournamentId?: number | null;
};

export default function TournamentSetupWorkspace({ initialTournamentId = null }: TournamentSetupWorkspaceProps) {
  const router = useRouter();
  const routeTournamentId = typeof initialTournamentId === 'number' && initialTournamentId > 0
    ? initialTournamentId
    : null;
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionKey>('tournament-details');
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [details, setDetails] = useState<TournamentDetails>(defaultTournamentDetails);

  const [events, setEvents] = useState<EventConfig[]>([]);
  const [divisions, setDivisions] = useState<DivisionConfig[]>([]);
  const [squads, setSquads] = useState<SquadConfig[]>([]);
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [questions, setQuestions] = useState<CustomQuestionConfig[]>([]);
  const [fields, setFields] = useState<RegistrationFieldConfig[]>([]);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [showHiddenRegistrationFields, setShowHiddenRegistrationFields] = useState(false);
  const [showRegistrationPreview, setShowRegistrationPreview] = useState(false);
  const [lastPreflightRunAt, setLastPreflightRunAt] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [openCardMenu, setOpenCardMenu] = useState<CardMenuState>(null);
  const [hasRulesDocument, setHasRulesDocument] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentProcessorConnected, setPaymentProcessorConnected] = useState(false);
  const [paymentPayoutConfigured, setPaymentPayoutConfigured] = useState(true);
  const [persistedTournamentId, setPersistedTournamentId] = useState<number | null>(null);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [userTournaments, setUserTournaments] = useState<UserTournamentSummary[]>([]);
  const [setupStateByTournamentId, setSetupStateByTournamentId] = useState<Record<number, OrganizerSetupStateSummary>>({});
  const [isLoadingTournamentLibrary, setIsLoadingTournamentLibrary] = useState(false);
  const [loadingTournamentId, setLoadingTournamentId] = useState<number | null>(null);
  const [deletingTournamentId, setDeletingTournamentId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSetupPublished, setIsSetupPublished] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [hasHydratedInitialState, setHasHydratedInitialState] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveSavedAt, setAutosaveSavedAt] = useState<string | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isLogoDragActive, setIsLogoDragActive] = useState(false);
  const [isSubmittingSignupPreview, setIsSubmittingSignupPreview] = useState(false);
  const [signupPreviewSubmitMessage, setSignupPreviewSubmitMessage] = useState<string | null>(null);
  const [signupPreviewForm, setSignupPreviewForm] = useState<OrganizerRegistrationFormState>(EMPTY_ORGANIZER_REGISTRATION_FORM);

  useEffect(() => {
    if (!openCardMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`.${styles.cardActions}`)) {
        return;
      }

      setOpenCardMenu(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openCardMenu]);

  useEffect(() => {
    setActiveSection(getUrlActiveSection());
  }, []);

  useEffect(() => {
    if (!hasHydratedInitialState) {
      return;
    }

    syncUrlState({
      activeSection,
      tournamentId: persistedTournamentId,
      includeTournamentInQuery: routeTournamentId === null,
    });
  }, [activeSection, persistedTournamentId, hasHydratedInitialState, routeTournamentId]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosaveFingerprintRef = useRef<string | null>(null);

  const setPreviewUrl = (nextUrl: string | null) => {
    setLogoPreviewUrl((previous) => {
      if (previous && previous.startsWith('blob:')) {
        URL.revokeObjectURL(previous);
      }
      return nextUrl;
    });
  };

  const autosaveFingerprint = useMemo(
    () => JSON.stringify({
      tournamentId: persistedTournamentId,
      details,
      events,
      divisions,
      squads,
      fees,
      locations,
      questions,
      fields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
      pendingLogoFile: pendingLogoFile
        ? {
            name: pendingLogoFile.name,
            size: pendingLogoFile.size,
            lastModified: pendingLogoFile.lastModified,
            type: pendingLogoFile.type,
          }
        : null,
    }),
    [
      persistedTournamentId,
      details,
      events,
      divisions,
      squads,
      fees,
      locations,
      questions,
      fields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
      pendingLogoFile,
    ],
  );

  const applyDraft = (draft: OrganizerDraft) => {
    setPersistedTournamentId(draft.tournamentId ?? null);
    setDetails(draft.details);
    setPendingLogoFile(null);
    setEvents(draft.events);
    setDivisions(draft.divisions);
    setSquads(draft.squads);
    setFees(draft.fees);
    setLocations(draft.locations);
    setQuestions(draft.questions);
    setFields(draft.fields);
    setHasRulesDocument(draft.hasRulesDocument);
    setPaymentMode(draft.paymentMode);
    setPaymentProcessorConnected(draft.paymentProcessorConnected);
    setPaymentPayoutConfigured(draft.paymentPayoutConfigured);
  };

  const hasLogoAsset = Boolean(logoPreviewUrl || details.logoFileName || pendingLogoFile);
  const logoAssetName = pendingLogoFile?.name || details.logoFileName || 'Tournament Logo';
  const logoAssetMeta = pendingLogoFile
    ? `${inferLogoFileLabel(pendingLogoFile.name)} - ${formatFileSize(pendingLogoFile.size)}`
    : `${inferLogoFileLabel(details.logoFileName)} - file uploaded`;

  const refreshTournamentLibrary = async (token: string) => {
    setIsLoadingTournamentLibrary(true);
    try {
      const [tournaments, setupStates] = await Promise.all([
        listMyTournaments(token),
        listMyOrganizerSetupStates(token),
      ]);

      setUserTournaments(tournaments);
      setSetupStateByTournamentId(
        Object.fromEntries(setupStates.map((state) => [state.tournament_id, state]))
      );

      return { tournaments, setupStates };
    } finally {
      setIsLoadingTournamentLibrary(false);
    }
  };

  useEffect(() => {
    const hasToken = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('access_token'));
    const hasUser = typeof window !== 'undefined' && Boolean(localStorage.getItem('user_id'));
    if (!hasToken || !hasUser) {
      router.replace('/login?expired=true');
    }
  }, [router]);

  useEffect(() => {
    return () => {
      setLogoPreviewUrl((previous) => {
        if (previous && previous.startsWith('blob:')) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const finishHydration = () => {
        if (!cancelled) {
          setHasHydratedInitialState(true);
        }
      };

      const draft = loadDraftFromStorage();
      applyDraft(draft);
      setIsSetupPublished(false);
      setPreviewUrl(null);
      setAutosaveEnabled(Boolean(draft.tournamentId));
      setAutosaveError(null);

      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
      if (!token) {
        finishHydration();
        return;
      }

      try {
        const { setupStates, tournaments } = await refreshTournamentLibrary(token);
        if (cancelled) {
          return;
        }

        const preferredTournamentId = getInitialTournamentId(routeTournamentId)
          ?? setupStates[0]?.tournament_id
          ?? null;

        if (!preferredTournamentId) {
          return;
        }

        const state = await loadOrganizerSetupState(token, preferredTournamentId);
        if (!state || cancelled) {
          return;
        }

        const hydratedDraft = normalizeOrganizerDraft({
          tournamentId: state.tournament_id,
          payload: state.payload,
        });
        applyDraft(hydratedDraft);
        setIsSetupPublished(Boolean(state.is_published));

        const selectedTournament = tournaments.find((entry) => entry.id === state.tournament_id);
        if (selectedTournament?.logo_file_name) {
          setDetails((prev) => ({ ...prev, logoFileName: selectedTournament.logo_file_name || '' }));
        }

        if (selectedTournament?.has_logo) {
          const previewUrl = await fetchTournamentLogoBlobUrl(token, state.tournament_id);
          if (!cancelled) {
            setPreviewUrl(previewUrl);
          }
        } else {
          setPreviewUrl(null);
        }

        if (!cancelled) {
          setAutosaveEnabled(true);
          setAutosaveError(null);
          autosaveFingerprintRef.current = null;
        }
      } catch {
        // Keep local draft when remote setup cannot be loaded.
      } finally {
        finishHydration();
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [routeTournamentId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const draft: OrganizerDraft = {
      version: DRAFT_VERSION,
      tournamentId: persistedTournamentId,
      details,
      events,
      divisions,
      squads,
      fees,
      locations,
      questions,
      fields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
    };

    localStorage.setItem(getDraftStorageKey(), JSON.stringify(draft));
    localStorage.setItem('tc_active_tournament_name', details.name || '');
    window.dispatchEvent(new Event('storage'));
  }, [details, events, divisions, squads, fees, locations, questions, fields, hasRulesDocument, paymentMode, paymentProcessorConnected, paymentPayoutConfigured, persistedTournamentId]);

  useEffect(() => {
    if (!autosaveEnabled || !persistedTournamentId || isSavingDraft || isPublishing) {
      return;
    }

    if (autosaveFingerprintRef.current === autosaveFingerprint) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (autosaveInFlightRef.current) {
        return;
      }

      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
      if (!token) {
        setAutosaveError('Autosave paused: session expired.');
        return;
      }

      const nextFingerprint = autosaveFingerprint;

      void (async () => {
        autosaveInFlightRef.current = true;
        setIsAutosaving(true);
        setAutosaveError(null);

        try {
          const detailsForSave = await resolveVenueForPersistence(token);
          const payload = buildTournamentPayload(detailsForSave, squads, detailsForSave.visibility !== 'private');
          const saved = await saveTournamentRecord({
            token,
            payload,
            tournamentId: persistedTournamentId,
          });

          if (pendingLogoFile) {
            const logoResult = await uploadTournamentLogo({
              token,
              tournamentId: saved.id,
              file: pendingLogoFile,
            });
            setDetails((prev) => ({
              ...prev,
              logoFileName: logoResult.logo_file_name || prev.logoFileName,
            }));
            setPendingLogoFile(null);
          }

          const organizerPayload = buildOrganizerSetupPayload({
            details: detailsForSave,
            events,
            divisions,
            squads,
            fees,
            locations,
            questions,
            fields,
            hasRulesDocument,
            paymentMode,
            paymentProcessorConnected,
            paymentPayoutConfigured,
          });

          await saveOrganizerSetupState({
            token,
            tournamentId: saved.id,
            payload: organizerPayload,
            isPublished: false,
          });

          setPersistedTournamentId(saved.id);
          autosaveFingerprintRef.current = nextFingerprint;
          setAutosaveSavedAt(new Date().toISOString());
        } catch (error) {
          setAutosaveError(error instanceof Error ? error.message : 'Autosave failed.');
        } finally {
          setIsAutosaving(false);
          autosaveInFlightRef.current = false;
        }
      })();
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    autosaveEnabled,
    autosaveFingerprint,
    details,
    divisions,
    events,
    fees,
    fields,
    hasRulesDocument,
    isPublishing,
    isSavingDraft,
    locations,
    paymentMode,
    paymentPayoutConfigured,
    paymentProcessorConnected,
    pendingLogoFile,
    persistedTournamentId,
    questions,
    squads,
    isSetupPublished,
  ]);

  const handleOpenTournamentModal = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setIsTournamentModalOpen(true);
    setSaveError(null);
    try {
      await refreshTournamentLibrary(token);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to load tournaments.');
    }
  };

  const handleLoadExistingTournament = async (tournamentId: number) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    if (routeTournamentId && routeTournamentId !== tournamentId) {
      router.push(organizerRoutes.setup(tournamentId));
      return;
    }

    setSaveError(null);
    setLoadingTournamentId(tournamentId);

    try {
      const state = await loadOrganizerSetupState(token, tournamentId);
      const selectedTournament = userTournaments.find((entry) => entry.id === tournamentId) ?? null;
      if (state) {
        const hydratedDraft = normalizeOrganizerDraft({
          tournamentId: state.tournament_id,
          payload: state.payload,
        });
        applyDraft(hydratedDraft);
        setIsSetupPublished(Boolean(state.is_published));
        if (selectedTournament?.logo_file_name) {
          setDetails((prev) => ({ ...prev, logoFileName: selectedTournament.logo_file_name || '' }));
        }
      } else {
        const tournament = selectedTournament;
        if (!tournament) {
          throw new Error('Tournament was not found.');
        }

        applyDraft(toDraftFromTournament(tournament));
        setIsSetupPublished(false);
      }

      if (selectedTournament?.has_logo) {
        const previewUrl = await fetchTournamentLogoBlobUrl(token, tournamentId);
        setPreviewUrl(previewUrl);
      } else {
        setPreviewUrl(null);
      }

      setAutosaveError(null);
      setAutosaveEnabled(true);
      setAutosaveSavedAt(null);
      autosaveFingerprintRef.current = null;
      setActiveSection('tournament-details');
      setIsTournamentModalOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to load selected tournament.');
    } finally {
      setLoadingTournamentId(null);
    }
  };

  const handleDeleteTournament = async (tournamentId: number) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    const shouldDelete = window.confirm('Delete this tournament? This action cannot be undone.');
    if (!shouldDelete) {
      return;
    }

    setSaveError(null);
    setDeletingTournamentId(tournamentId);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      const responseData = await response.json().catch(() => null) as { detail?: string } | null;
      if (!response.ok) {
        const detail = responseData && typeof responseData.detail === 'string'
          ? responseData.detail
          : `Failed to delete tournament (${response.status})`;
        throw new Error(detail);
      }

      if (persistedTournamentId === tournamentId) {
        applyDraft(buildDefaultDraft());
        setIsSetupPublished(false);
        setPreviewUrl(null);
      }

      await refreshTournamentLibrary(token);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete tournament.');
    } finally {
      setDeletingTournamentId(null);
    }
  };

  const handleExportTemplate = () => {
    const template: TournamentTemplate = {
      format: 'tc-tournament-template',
      version: 1,
      exported_at: new Date().toISOString(),
      payload: buildOrganizerSetupPayload({
        details: { ...details, venueId: null, logoFileName: '' },
        events,
        divisions,
        squads,
        fees,
        locations,
        questions,
        fields,
        hasRulesDocument: false,
        paymentMode,
        paymentProcessorConnected: false,
        paymentPayoutConfigured: false,
      }),
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(details.name.trim() || 'tournament').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tournament'}-template.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportReport = () => {
    const escapeHtml = (value: string | number | null | undefined): string => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const formatCurrency = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
    const rows = (items: string[][]) => items.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    const location = [details.bowlingCenter, details.venueAddressLine1, details.city, details.state, details.venueZip].filter(Boolean).join(', ');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(details.name || 'Tournament')} - Tournament Summary</title>
<style>body{margin:0;background:#f4f4f2;color:#1b1b1b;font:14px/1.5 Arial,sans-serif}.page{max-width:900px;margin:32px auto;background:#fff;padding:42px;box-sizing:border-box}h1,h2{margin:0;color:#171717}h1{font-size:30px}h2{font-size:18px;margin-top:32px;border-bottom:2px solid #ff7a00;padding-bottom:6px}.eyebrow{color:#a84f00;font-size:11px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase}.meta{color:#565656;margin:8px 0 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.fact{border:1px solid #ddd;padding:12px}.fact b{display:block;font-size:11px;letter-spacing:.08em;color:#666}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#191919;color:#fff;font-size:11px;letter-spacing:.05em;text-transform:uppercase}.footer{margin-top:32px;color:#777;font-size:12px}@media print{body{background:#fff}.page{margin:0;max-width:none;padding:0}}</style></head>
<body><main class="page"><p class="eyebrow">Tournament Central | Tournament Summary</p><h1>${escapeHtml(details.name || 'Untitled Tournament')}</h1><p class="meta">${escapeHtml(details.subtitle || details.organizer || 'Tournament configuration export')}</p>
<section class="grid"><div class="fact"><b>DATES</b>${escapeHtml([details.startDateIso, details.endDateIso].filter(Boolean).join(' to ') || 'Not set')}</div><div class="fact"><b>LOCATION</b>${escapeHtml(location || 'Not set')}</div><div class="fact"><b>ORGANIZER</b>${escapeHtml(details.organizer || 'Not set')}</div><div class="fact"><b>REGISTRATION</b>${escapeHtml([details.registrationOpenIso, details.registrationCloseIso].filter(Boolean).join(' to ') || 'Not set')}</div></section>
<h2>Events</h2><table><thead><tr><th>Event</th><th>Format</th><th>Players</th><th>Entry Fee</th></tr></thead><tbody>${rows(events.filter((event) => event.enabled).map((event) => [event.name || 'Untitled Event', event.scoring, `${event.minPlayers}-${event.maxPlayers}`, formatCurrency(event.entryFeeCents)])) || '<tr><td colspan="4">No events configured.</td></tr>'}</tbody></table>
<h2>Divisions</h2><table><thead><tr><th>Division</th><th>Average</th><th>Age</th><th>Mode</th></tr></thead><tbody>${rows(divisions.map((division) => [division.name || 'Untitled Division', `${division.minAverage ?? 'Any'}-${division.maxAverage ?? 'Any'}`, `${division.minAge ?? 'Any'}-${division.maxAge ?? 'Any'}`, division.mode])) || '<tr><td colspan="4">No divisions configured.</td></tr>'}</tbody></table>
<h2>Squads</h2><table><thead><tr><th>Squad</th><th>Date</th><th>Start</th><th>Capacity</th></tr></thead><tbody>${rows([...squads].sort((a, b) => `${a.dateIso}${a.startTime}`.localeCompare(`${b.dateIso}${b.startTime}`)).map((squad) => [squad.name || 'Squad', squad.dateIso || 'Not set', squad.startTime || 'Not set', String(squad.capacity)])) || '<tr><td colspan="4">No squads configured.</td></tr>'}</tbody></table>
<h2>Fees and Registration</h2><table><thead><tr><th>Add-on</th><th>Amount</th><th>Required</th></tr></thead><tbody>${rows(fees.filter((fee) => fee.enabled).map((fee) => [fee.name || 'Untitled Add-on', formatCurrency(fee.amountCents), fee.required ? 'Yes' : 'No'])) || '<tr><td colspan="3">No add-ons configured.</td></tr>'}</tbody></table>
<p class="footer">Generated ${escapeHtml(new Date().toLocaleString())}. This report excludes registrations, payments, and uploaded files.</p></main></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(details.name.trim() || 'tournament').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tournament'}-summary.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplate = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as Partial<TournamentTemplate>;
      if (parsed.format !== 'tc-tournament-template' || parsed.version !== 1 || !parsed.payload || typeof parsed.payload !== 'object') {
        throw new Error('Choose a Tournament Central template JSON file.');
      }

      const imported = normalizeOrganizerDraft({ tournamentId: null, payload: parsed.payload });
      const eventIds = new Map(imported.events.map((entry) => [entry.id, buildClientId('ev')]));
      const divisionIds = new Map(imported.divisions.map((entry) => [entry.id, buildClientId('div')]));
      const squadIds = new Map(imported.squads.map((entry) => [entry.id, buildClientId('sq')]));
      const resolveIds = (ids: string[], map: Map<string, string>) => ids.map((id) => map.get(id)).filter((id): id is string => Boolean(id));
      const remappedDraft: OrganizerDraft = {
        ...imported,
        tournamentId: null,
        details: {
          ...imported.details,
          venueId: null,
          logoFileName: '',
          tournamentStatus: 'draft',
          visibility: 'private',
        },
        events: imported.events.map((entry) => ({
          ...entry,
          id: eventIds.get(entry.id) || buildClientId('ev'),
          connectedDivisionIds: resolveIds(entry.connectedDivisionIds, divisionIds),
          connectedSquadIds: resolveIds(entry.connectedSquadIds, squadIds),
        })),
        divisions: imported.divisions.map((entry) => ({
          ...entry,
          id: divisionIds.get(entry.id) || buildClientId('div'),
          eventIds: resolveIds(entry.eventIds, eventIds),
        })),
        squads: imported.squads.map((entry) => ({
          ...entry,
          id: squadIds.get(entry.id) || buildClientId('sq'),
          eventIds: resolveIds(entry.eventIds, eventIds),
          registeredCount: 0,
        })),
        fees: imported.fees.map((entry) => ({
          ...entry,
          id: buildClientId('fee'),
          eventIds: resolveIds(entry.eventIds, eventIds),
          divisionIds: resolveIds(entry.divisionIds, divisionIds),
          squadIds: resolveIds(entry.squadIds, squadIds),
        })),
        locations: imported.locations.map((entry) => ({ ...entry, id: buildClientId('loc') })),
        questions: imported.questions.map((entry) => ({
          ...entry,
          id: buildClientId('cq'),
          scope: {
            ...entry.scope,
            eventIds: resolveIds(entry.scope.eventIds, eventIds),
            divisionIds: resolveIds(entry.scope.divisionIds, divisionIds),
            squadIds: resolveIds(entry.scope.squadIds, squadIds),
          },
        })),
        fields: imported.fields.map((entry) => ({ ...entry, id: buildClientId('rf') })),
        hasRulesDocument: false,
        paymentProcessorConnected: false,
        paymentPayoutConfigured: false,
      };

      applyDraft(remappedDraft);
      setIsSetupPublished(false);
      setAutosaveEnabled(false);
      setAutosaveSavedAt(null);
      setDraftSavedAt(null);
      setPublishedAt(null);
      setPreviewUrl(null);
      setSaveError(null);
      setAutosaveError(null);
      setActiveSection('tournament-details');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to import the tournament template.');
    }
  };

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const issues: ValidationIssue[] = [];

    const detailsName = details.name.trim();
    const detailsSupportEmail = details.supportEmail.trim();
    const detailsCenter = details.bowlingCenter.trim();
    const detailsOrganizer = details.organizer.trim();
    const enabledEvents = events.filter((event) => event.enabled);
    const visibleFields = fields.filter((field) => field.mode !== 'dont-ask');
    const firstNameField = fields.find((field) => field.key === 'first_name');
    const lastNameField = fields.find((field) => field.key === 'last_name');
    const optionQuestionTypes = new Set<CustomQuestionConfig['type']>(['dropdown', 'multiple-choice', 'checkbox']);
    const eventIds = new Set(events.map((event) => event.id));
    const divisionIds = new Set(divisions.map((division) => division.id));
    const squadIds = new Set(squads.map((squad) => squad.id));

    if (!detailsName) {
      issues.push({
        id: 'details-name-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Tournament name is required.',
      });
    }

    if (!detailsCenter) {
      issues.push({
        id: 'details-center-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Bowling center is required.',
      });
    }

    if (!detailsSupportEmail) {
      issues.push({
        id: 'details-support-email-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Support email is required.',
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detailsSupportEmail)) {
      issues.push({ id: 'details-support-email-invalid', section: 'tournament-details', severity: 'error', message: 'Enter a valid support email.' });
    }

    if (!detailsOrganizer) {
      issues.push({ id: 'details-organizer-missing', section: 'tournament-details', severity: 'error', message: 'Host organization is required.' });
    }
    if (!details.contactName.trim()) {
      issues.push({ id: 'details-contact-name-missing', section: 'tournament-details', severity: 'error', message: 'Participant contact name is required.' });
    }
    if (details.preferredContactMethod === 'phone' && !details.supportPhone.trim()) {
      issues.push({ id: 'details-contact-phone-missing', section: 'tournament-details', severity: 'error', message: 'Contact phone is required when Phone is the preferred contact method.' });
    }

    if (detailsName && userTournaments.some((tournament) => tournament.id !== persistedTournamentId && tournament.name.trim().toLowerCase() === detailsName.toLowerCase())) {
      issues.push({ id: 'details-name-duplicate', section: 'tournament-details', severity: 'warning', message: 'You already have another tournament with this name.' });
    }

    if (!details.state) issues.push({ id: 'details-state-missing', section: 'tournament-details', severity: 'error', message: 'Tournament state is required.' });
    if (!details.city.trim()) issues.push({ id: 'details-city-missing', section: 'tournament-details', severity: 'error', message: 'Tournament city is required.' });
    if (!details.timezone) issues.push({ id: 'details-timezone-missing', section: 'tournament-details', severity: 'error', message: 'Tournament timezone is required.' });
    if (!details.tournamentType) issues.push({ id: 'details-type-missing', section: 'tournament-details', severity: 'error', message: 'Tournament type is required.' });

    if (!details.startDateIso || !details.endDateIso) {
      issues.push({
        id: 'details-tournament-dates-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Tournament start and end dates are required.',
      });
    } else if (details.startDateIso > details.endDateIso) {
      issues.push({
        id: 'details-tournament-dates-invalid',
        section: 'tournament-details',
        severity: 'error',
        message: 'Tournament end date must be on or after the start date.',
      });
    }

    if (!details.registrationOpenIso || !details.registrationCloseIso) {
      issues.push({
        id: 'details-registration-dates-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Registration open and close dates are required.',
      });
    } else {
      if (`${details.registrationOpenIso}T${details.registrationOpenTime}` > `${details.registrationCloseIso}T${details.registrationCloseTime}`) {
        issues.push({
          id: 'details-registration-window-invalid',
          section: 'tournament-details',
          severity: 'error',
          message: 'Registration close date must be on or after the open date.',
        });
      }

      if (details.startDateIso && details.registrationCloseIso > details.startDateIso) {
        issues.push({
          id: 'details-registration-after-start',
          section: 'tournament-details',
          severity: 'warning',
          message: 'Registration currently closes after tournament start date.',
        });
      }
    }

    if (enabledEvents.length === 0) {
      issues.push({
        id: 'events-none-enabled',
        section: 'events-divisions',
        severity: 'error',
        message: 'Enable at least one event before publishing.',
      });
    }

    if (enabledEvents.length > 0 && divisions.length === 0 && squads.length === 0) {
      issues.push({
        id: 'tournament-structure-missing',
        section: 'events-divisions',
        severity: 'error',
        message: 'Add at least one division or squad before publishing.',
      });
    }

    for (const event of enabledEvents) {
      if (!event.name.trim()) {
        issues.push({
          id: `event-name-missing-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: 'All enabled events need a name.',
        });
      }

      if (event.requireSquad && event.connectedSquadIds.length === 0) {
        issues.push({
          id: `event-squad-required-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An enabled event'} requires squad selection but has no squads assigned.`,
        });
      }

      if (event.requireDivision && event.connectedDivisionIds.length === 0) {
        issues.push({
          id: `event-division-required-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An enabled event'} requires division selection but has no divisions assigned.`,
        });
      }

      if (event.minPlayers < 1 || event.maxPlayers < 1 || event.maxPlayers < event.minPlayers) {
        issues.push({
          id: `event-player-count-invalid-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An enabled event'} has an invalid required bowler count.`,
        });
      }
    }

    for (const squad of squads) {
      if (details.startDateIso && squad.dateIso && squad.dateIso < details.startDateIso) {
        issues.push({ id: `squad-before-tournament-${squad.id}`, section: 'squads-availability', severity: 'error', message: `${squad.name || 'A squad'} is scheduled before the tournament starts.` });
      }
      if (details.endDateIso && squad.dateIso && squad.dateIso > details.endDateIso) {
        issues.push({ id: `squad-after-tournament-${squad.id}`, section: 'squads-availability', severity: 'error', message: `${squad.name || 'A squad'} is scheduled after the tournament ends.` });
      }
      if (!squad.dateIso || !squad.startTime) {
        issues.push({
          id: `squad-datetime-missing-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} is missing date or start time.`,
        });
      }
      if (!details.bowlingCenter.trim()) {
        issues.push({
          id: `squad-location-missing-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} needs a location.`,
        });
      }
      if (squad.checkInTime && squad.startTime && squad.checkInTime >= squad.startTime) {
        issues.push({
          id: `squad-checkin-invalid-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} must have a check-in time before its start time.`,
        });
      }
      if (squad.capacity < squad.registeredCount) {
        issues.push({ id: `squad-capacity-below-registration-${squad.id}`, section: 'squads-availability', severity: 'error', message: `${squad.name || 'A squad'} has more registrations than its capacity allows.` });
      }
    }

    const squadDateTimes = new Map<string, SquadConfig[]>();
    for (const squad of squads) {
      if (!squad.dateIso || !squad.startTime) continue;
      const key = `${squad.dateIso}-${squad.startTime}`;
      squadDateTimes.set(key, [...(squadDateTimes.get(key) ?? []), squad]);
    }
    for (const duplicates of squadDateTimes.values()) {
      if (duplicates.length > 1) {
        for (const squad of duplicates) {
          issues.push({ id: `squad-duplicate-time-${squad.id}`, section: 'squads-availability', severity: 'error', message: `${squad.name || 'A squad'} shares the same date and start time as another squad.` });
        }
      }
    }

    if (visibleFields.length === 0) {
      issues.push({
        id: 'registration-fields-none-visible',
        section: 'registration-setup',
        severity: 'error',
        message: 'At least one registration field must be visible.',
      });
    }

    if (!firstNameField || firstNameField.mode !== 'required') {
      issues.push({
        id: 'registration-first-name-required',
        section: 'registration-setup',
        severity: 'error',
        message: 'First name must be required for registration.',
      });
    }

    if (!lastNameField || lastNameField.mode !== 'required') {
      issues.push({
        id: 'registration-last-name-required',
        section: 'registration-setup',
        severity: 'error',
        message: 'Last name must be required for registration.',
      });
    }

    for (const question of questions.filter((entry) => entry.enabled)) {
      if (!question.label.trim()) {
        issues.push({
          id: `question-label-missing-${question.id}`,
          section: 'registration-setup',
          severity: 'error',
          message: 'Enabled custom questions need a prompt.',
        });
      }

      if (optionQuestionTypes.has(question.type) && question.options.length === 0) {
        issues.push({
          id: `question-options-missing-${question.id}`,
          section: 'registration-setup',
          severity: 'error',
          message: `${question.label || 'An enabled question'} needs at least one option.`,
        });
      }
    }

    for (const event of events) {
      const hasMissingDivisionRef = event.connectedDivisionIds.some((divisionId) => !divisionIds.has(divisionId));
      if (hasMissingDivisionRef) {
        issues.push({
          id: `event-division-reference-invalid-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An event'} references one or more deleted divisions.`,
        });
      }

      const hasMissingSquadRef = event.connectedSquadIds.some((squadId) => !squadIds.has(squadId));
      if (hasMissingSquadRef) {
        issues.push({
          id: `event-squad-reference-invalid-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An event'} references one or more deleted squads.`,
        });
      }
    }

    for (const division of divisions) {
      const hasMissingEventRef = division.eventIds.some((eventId) => !eventIds.has(eventId));
      if (hasMissingEventRef) {
        issues.push({
          id: `division-event-reference-invalid-${division.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${division.name || 'A division'} references one or more deleted events.`,
        });
      }
    }

    for (const squad of squads) {
      const hasMissingEventRef = squad.eventIds.some((eventId) => !eventIds.has(eventId));
      if (hasMissingEventRef) {
        issues.push({
          id: `squad-event-reference-invalid-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} references one or more deleted events.`,
        });
      }
    }

    for (const fee of fees) {
      const hasMissingEventRef = fee.eventIds.some((eventId) => !eventIds.has(eventId));
      const hasMissingDivisionRef = fee.divisionIds.some((divisionId) => !divisionIds.has(divisionId));
      const hasMissingSquadRef = fee.squadIds.some((squadId) => !squadIds.has(squadId));
      if (hasMissingEventRef || hasMissingDivisionRef || hasMissingSquadRef) {
        issues.push({
          id: `fee-reference-invalid-${fee.id}`,
          section: 'fees-payments-documents',
          severity: 'error',
          message: `${fee.name || 'An add-on fee'} references deleted events, divisions, or squads.`,
        });
      }
    }

    for (const question of questions) {
      const hasMissingEventRef = question.scope.eventIds.some((eventId) => !eventIds.has(eventId));
      const hasMissingDivisionRef = question.scope.divisionIds.some((divisionId) => !divisionIds.has(divisionId));
      const hasMissingSquadRef = question.scope.squadIds.some((squadId) => !squadIds.has(squadId));
      if (hasMissingEventRef || hasMissingDivisionRef || hasMissingSquadRef) {
        issues.push({
          id: `question-reference-invalid-${question.id}`,
          section: 'registration-setup',
          severity: 'error',
          message: `${question.label || 'A custom question'} references deleted events, divisions, or squads.`,
        });
      }
    }

    // Cash-only mode is active for this release; online processor checks come later.

    return issues;
  }, [details, divisions, events, fees, fields, persistedTournamentId, questions, squads, userTournaments]);

  async function resolveVenueForPersistence(token: string): Promise<TournamentDetails> {
    if (details.venueId || !details.bowlingCenter.trim()) {
      return details;
    }

    const shouldResolve = Boolean(
      details.venueAddressLine1.trim()
      || details.city.trim()
      || details.state.trim()
      || details.venueExternalPlaceId.trim(),
    );
    if (!shouldResolve) {
      return details;
    }

    const resolvedVenue = await resolveTcVenue(token, {
      name: details.bowlingCenter,
      address_line_1: details.venueAddressLine1 || undefined,
      address_line_2: details.venueAddressLine2 || undefined,
      city: details.city || undefined,
      state: details.state || undefined,
      zip: details.venueZip || undefined,
      country: details.venueCountry || undefined,
      latitude: details.venueLatitude,
      longitude: details.venueLongitude,
      external_provider: details.venueExternalProvider || undefined,
      external_place_id: details.venueExternalPlaceId || undefined,
    });

    const nextDetails: TournamentDetails = {
      ...details,
      venueId: typeof resolvedVenue.id === 'number' ? resolvedVenue.id : null,
      bowlingCenter: resolvedVenue.name || details.bowlingCenter,
      venueAddressLine1: resolvedVenue.address_line_1 || details.venueAddressLine1,
      venueAddressLine2: resolvedVenue.address_line_2 || details.venueAddressLine2,
      city: resolvedVenue.city || details.city,
      state: resolvedVenue.state || details.state,
      venueZip: resolvedVenue.zip || details.venueZip,
      venueCountry: resolvedVenue.country || details.venueCountry,
      venueLatitude: resolvedVenue.latitude ?? details.venueLatitude,
      venueLongitude: resolvedVenue.longitude ?? details.venueLongitude,
      venueExternalProvider: resolvedVenue.external_provider || details.venueExternalProvider,
      venueExternalPlaceId: resolvedVenue.external_place_id || details.venueExternalPlaceId,
    };

    setDetails(nextDetails);
    return nextDetails;
  }

  const handleSaveDraft = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setSaveError(null);
    setIsSavingDraft(true);

    try {
      const detailsForSave = await resolveVenueForPersistence(token);
      const payload = buildTournamentPayload(detailsForSave, squads, detailsForSave.visibility !== 'private');
      const saved = await saveTournamentRecord({
        token,
        payload,
        tournamentId: persistedTournamentId,
      });

      if (pendingLogoFile) {
        const logoResult = await uploadTournamentLogo({
          token,
          tournamentId: saved.id,
          file: pendingLogoFile,
        });
        setDetails((prev) => ({
          ...prev,
          logoFileName: logoResult.logo_file_name || prev.logoFileName,
        }));
        setPendingLogoFile(null);
      }

      const organizerPayload = buildOrganizerSetupPayload({
        details: detailsForSave,
        events,
        divisions,
        squads,
        fees,
        locations,
        questions,
        fields,
        hasRulesDocument,
        paymentMode,
        paymentProcessorConnected,
        paymentPayoutConfigured,
      });
      await saveOrganizerSetupState({
        token,
        tournamentId: saved.id,
        payload: organizerPayload,
        isPublished: false,
      });

      await refreshTournamentLibrary(token);

      setPersistedTournamentId(saved.id);
      setDraftSavedAt(new Date().toISOString());
      setAutosaveError(null);
      setAutosaveEnabled(true);
      setAutosaveSavedAt(new Date().toISOString());
      autosaveFingerprintRef.current = null;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save tournament draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (validationIssues.some((issue) => issue.severity === 'error')) {
      setActiveSection('review-publish');
      return;
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setSaveError(null);
    setIsPublishing(true);

    try {
      const detailsForSave = await resolveVenueForPersistence(token);
      const payload = buildTournamentPayload(detailsForSave, squads, detailsForSave.visibility !== 'private');
      const saved = await saveTournamentRecord({
        token,
        payload,
        tournamentId: persistedTournamentId,
      });

      if (pendingLogoFile) {
        const logoResult = await uploadTournamentLogo({
          token,
          tournamentId: saved.id,
          file: pendingLogoFile,
        });
        setDetails((prev) => ({
          ...prev,
          logoFileName: logoResult.logo_file_name || prev.logoFileName,
        }));
        setPendingLogoFile(null);
      }

      const organizerPayload = buildOrganizerSetupPayload({
        details: detailsForSave,
        events,
        divisions,
        squads,
        fees,
        locations,
        questions,
        fields,
        hasRulesDocument,
        paymentMode,
        paymentProcessorConnected,
        paymentPayoutConfigured,
      });
      await saveOrganizerSetupState({
        token,
        tournamentId: saved.id,
        payload: organizerPayload,
        isPublished: true,
      });

      await refreshTournamentLibrary(token);

      setPersistedTournamentId(saved.id);
      setPublishedAt(new Date().toISOString());
      setIsSetupPublished(true);
      setDetails((prev) => ({ ...prev, tournamentStatus: 'active' }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to publish tournament.');
      setActiveSection('review-publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const statusBySection = useMemo<Record<SetupSectionKey, SetupStatus>>(() => {
    const hasError = (section: SetupSectionKey) => validationIssues.some((issue) => issue.section === section && issue.severity === 'error');
    const sectionStatus = (section: SetupSectionKey): SetupStatus => {
      if (hasError(section)) {
        return 'needs-attention';
      }
      return 'complete';
    };
    const squadsAreApplicable = squads.length > 0 || events.some(
      (event) => event.enabled && (event.requireSquad || event.connectedSquadIds.length > 0),
    );

    return {
      'tournament-details': sectionStatus('tournament-details'),
      'events-divisions': sectionStatus('events-divisions'),
      'squads-availability': squadsAreApplicable ? sectionStatus('squads-availability') : 'not-used',
      'registration-setup': sectionStatus('registration-setup'),
      'fees-payments-documents': sectionStatus('fees-payments-documents'),
      'review-publish': validationIssues.some((issue) => issue.severity === 'error')
        ? 'needs-attention'
        : 'complete',
    };
  }, [events, squads.length, validationIssues]);

  const enabledEvents = useMemo(
    () => events.filter((event) => event.enabled),
    [events],
  );
  const baseEntryTotalCents = useMemo(
    () => enabledEvents.reduce((sum, event) => sum + Math.max(event.entryFeeCents, 0), 0),
    [enabledEvents],
  );
  const addOnFees = useMemo(
    () => fees.filter((fee) => fee.enabled && !fee.required),
    [fees],
  );
  const addOnsTotalCents = useMemo(
    () => addOnFees.reduce((sum, fee) => sum + Math.max(fee.amountCents, 0), 0),
    [addOnFees],
  );

  const paymentModeLabel = 'Cash Only';
  const paymentModeReady = true;

  const completion = useMemo(() => {
    const statuses = setupSections
      .map((section) => statusBySection[section.key])
      .filter((status) => status !== 'not-used');
    const completeCount = statuses.filter((entry) => entry === 'complete').length;
    return Math.round((completeCount / statuses.length) * 100);
  }, [statusBySection]);
  const completedSectionCount = setupSections.filter((section) => statusBySection[section.key] === 'complete').length;

  const supportEmailLooksValid = useMemo(() => {
    const value = details.supportEmail.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }, [details.supportEmail]);

  const hasTournamentDateRange = Boolean(details.startDateIso && details.endDateIso);
  const hasRegistrationWindow = Boolean(details.registrationOpenIso && details.registrationCloseIso);
  const tournamentDateOrderInvalid = hasTournamentDateRange && details.startDateIso > details.endDateIso;
  const registrationDateOrderInvalid = hasRegistrationWindow
    && `${details.registrationOpenIso}T${details.registrationOpenTime}` > `${details.registrationCloseIso}T${details.registrationCloseTime}`;
  const registrationAfterStartWarning = hasRegistrationWindow
    && Boolean(details.startDateIso)
    && details.registrationCloseIso > details.startDateIso;

  const visibilitySummary = details.visibility === 'public'
    ? 'Listed in directory and visible to everyone.'
    : details.visibility === 'unlisted'
      ? 'Only visible to users with a direct link.'
      : 'Hidden from public directory and invite-only.';

  const recommendedTournamentStatus = useMemo(() => {
    return recommendTournamentStatus({
      details,
      isTournamentDetailsComplete: statusBySection['tournament-details'] === 'complete',
    });
  }, [
    details,
    statusBySection,
  ]);

  const activeEvent = drawerState?.kind === 'event'
    ? events.find((entry) => entry.id === drawerState.id) ?? emptyEvent(events.length + 1)
    : null;

  const activeDivision = drawerState?.kind === 'division'
    ? divisions.find((entry) => entry.id === drawerState.id) ?? emptyDivision()
    : null;

  const activeSquad = drawerState?.kind === 'squad'
    ? squads.find((entry) => entry.id === drawerState.id) ?? emptySquad()
    : null;

  const activeQuestion = drawerState?.kind === 'question'
    ? questions.find((entry) => entry.id === drawerState.id) ?? emptyQuestion(questions.length + 1)
    : null;

  const activeField = drawerState?.kind === 'field'
    ? fields.find((entry) => entry.id === drawerState.id) ?? null
    : null;

  const activeFee = drawerState?.kind === 'fee'
    ? fees.find((entry) => entry.id === drawerState.id) ?? emptyFee(fees.length + 1)
    : null;

  const activeLocation = drawerState?.kind === 'location'
    ? locations.find((entry) => entry.id === drawerState.id) ?? emptyLocation()
    : null;

  const autosaveStatusLabel = !autosaveEnabled
    ? 'Autosave off'
    : isAutosaving
      ? 'Autosaving...'
      : autosaveSavedAt
        ? `Autosaved ${new Date(autosaveSavedAt).toLocaleTimeString()}`
        : 'Autosave on';

  const sortedSquads = useMemo(() => {
    return [...squads].sort((a, b) => {
      const byDate = a.dateIso.localeCompare(b.dateIso);
      if (byDate !== 0) {
        return byDate;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [squads]);

  const groupsByDate = useMemo(() => {
    const groups = new Map<string, SquadConfig[]>();
    for (const squad of sortedSquads) {
      const list = groups.get(squad.dateIso) ?? [];
      list.push(squad);
      groups.set(squad.dateIso, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sortedSquads]);

  const squadGroups = useMemo(() => groupsByDate.map(([dateIso, dateSquads]) => ({
      key: dateIso,
      label: formatDateLabel(dateIso),
      squads: dateSquads,
    })), [groupsByDate]);

  const totalSquadCapacity = useMemo(
    () => squads.reduce((sum, squad) => sum + Math.max(squad.capacity, 0), 0),
    [squads],
  );

  const totalRegisteredSpots = useMemo(
    () => squads.reduce((sum, squad) => sum + Math.max(squad.registeredCount, 0), 0),
    [squads],
  );


  const fillPercent = totalSquadCapacity > 0
    ? Math.min(Math.round((totalRegisteredSpots / totalSquadCapacity) * 100), 100)
    : 0;
  const fillGaugeStyle = {
    background: `conic-gradient(#22c55e ${fillPercent * 3.6}deg, color-mix(in srgb, var(--bw-border-subtle) 75%, transparent) 0deg 360deg)`,
  };


  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.displayOrder - b.displayOrder), [fields]);
  const askedFields = useMemo(() => sortedFields.filter((field) => field.mode !== 'dont-ask'), [sortedFields]);
  const hiddenFields = useMemo(() => sortedFields.filter((field) => field.mode === 'dont-ask'), [sortedFields]);

  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => a.displayOrder - b.displayOrder), [questions]);
  const enabledQuestions = useMemo(() => sortedQuestions.filter((question) => question.enabled), [sortedQuestions]);
  const disabledQuestions = useMemo(() => sortedQuestions.filter((question) => !question.enabled), [sortedQuestions]);

  const enabledDivisions = useMemo(
    () => divisions.filter((division) => division.enabled),
    [divisions],
  );

  const enabledSquads = useMemo(
    () => sortedSquads,
    [sortedSquads],
  );

  const eventsForSelectedPreviewSquad = useMemo(() => {
    if (!signupPreviewForm.squadId) {
      return enabledEvents;
    }

    const linked = enabledEvents.filter((event) => {
      const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];
      return connectedSquadIds.includes(signupPreviewForm.squadId);
    });

    return linked.length > 0 ? linked : enabledEvents;
  }, [enabledEvents, signupPreviewForm.squadId]);

  const selectedPreviewSquad = useMemo(
    () => enabledSquads.find((squad) => squad.id === signupPreviewForm.squadId) ?? null,
    [enabledSquads, signupPreviewForm.squadId],
  );

  const selectedPreviewEvent = useMemo(
    () => enabledEvents.find((event) => event.id === signupPreviewForm.eventId) ?? eventsForSelectedPreviewSquad[0] ?? null,
    [enabledEvents, eventsForSelectedPreviewSquad, signupPreviewForm.eventId],
  );

  const requiredPreviewBowlerCount = useMemo(
    () => getRequiredBowlerCountFromSquad(selectedPreviewSquad) ?? getRequiredBowlerCountFromEvent(selectedPreviewEvent),
    [selectedPreviewEvent, selectedPreviewSquad],
  );

  useEffect(() => {
    setSignupPreviewForm((prev) => {
      const next = { ...prev };

      if (!next.squadId && enabledSquads.length > 0) {
        next.squadId = enabledSquads[0].id;
      }

      const squadLinkedEvents = enabledEvents.filter((event) => {
        const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];
        return connectedSquadIds.includes(next.squadId);
      });

      const allowedEvents = squadLinkedEvents.length > 0 ? squadLinkedEvents : enabledEvents;
      if (!next.eventId || !allowedEvents.some((event) => event.id === next.eventId)) {
        next.eventId = allowedEvents[0]?.id ?? '';
      }

      if (!next.divisionId && enabledDivisions.length > 0) {
        next.divisionId = enabledDivisions[0].id;
      }

      if (next.divisionId && !enabledDivisions.some((division) => division.id === next.divisionId)) {
        next.divisionId = enabledDivisions[0]?.id ?? '';
      }

      const selectedSquad = enabledSquads.find((squad) => squad.id === next.squadId) ?? null;
      const selectedEvent = enabledEvents.find((event) => event.id === next.eventId) ?? null;
      const requiredCount = getRequiredBowlerCountFromSquad(selectedSquad) ?? getRequiredBowlerCountFromEvent(selectedEvent);

      if (next.bowlers.length !== requiredCount) {
        const nextBowlers = Array.from({ length: requiredCount }, (_, index) => next.bowlers[index] ?? {});
        const nextAnswers = Array.from({ length: requiredCount }, (_, index) => next.bowlerQuestionAnswers[index] ?? {});
        next.bowlers = nextBowlers;
        next.bowlerQuestionAnswers = nextAnswers;
      }

      return next;
    });
  }, [enabledDivisions, enabledEvents, enabledSquads]);

  const handleSignupPreviewSubmit = async () => {
    if (!signupPreviewForm.squadId) {
      setSignupPreviewSubmitMessage('Please select a squad first.');
      return;
    }

    if (signupPreviewForm.bowlers.length !== requiredPreviewBowlerCount) {
      setSignupPreviewSubmitMessage(`This squad requires ${requiredPreviewBowlerCount} bowler form${requiredPreviewBowlerCount === 1 ? '' : 's'}.`);
      return;
    }

    let missingFieldLabel = '';
    let missingFieldBowlerIndex = -1;
    signupPreviewForm.bowlers.some((bowlerFields, bowlerIndex) => {
      const missingRequiredField = askedFields.filter((field) => field.mode === 'required').find((field) => {
        const key = normalizeRegistrationFieldKey(field.key);
        const value = bowlerFields?.[key];
        return typeof value !== 'string' || value.trim().length === 0;
      });

      if (missingRequiredField) {
        missingFieldLabel = missingRequiredField.customLabel || missingRequiredField.label || 'Required field';
        missingFieldBowlerIndex = bowlerIndex;
        return true;
      }

      return false;
    });

    if (missingFieldBowlerIndex >= 0) {
      setSignupPreviewSubmitMessage(`Bowler ${missingFieldBowlerIndex + 1}: ${missingFieldLabel} is required.`);
      return;
    }

    if (!signupPreviewForm.acceptTerms) {
      setSignupPreviewSubmitMessage('Please accept the tournament terms before continuing.');
      return;
    }

    let missingQuestionLabel = '';
    let missingQuestionBowlerIndex = -1;
    enabledQuestions.filter((question) => question.required).some((question) => {
      return signupPreviewForm.bowlerQuestionAnswers.some((answersForBowler, bowlerIndex) => {
        const hasAnswer = isRegistrationQuestionAnswered(question, answersForBowler?.[question.id]);
        if (!hasAnswer) {
          missingQuestionLabel = question.label || 'Required question';
          missingQuestionBowlerIndex = bowlerIndex;
          return true;
        }

        return false;
      });
    });

    if (missingQuestionBowlerIndex >= 0) {
      setSignupPreviewSubmitMessage(`Bowler ${missingQuestionBowlerIndex + 1}: ${missingQuestionLabel} is required.`);
      return;
    }

    setIsSubmittingSignupPreview(true);
    setSignupPreviewSubmitMessage(null);

    try {
      await Promise.resolve();
      setSignupPreviewSubmitMessage('Preview looks good. This is the same public-facing signup experience bowlers will use.');
    } catch (error) {
      setSignupPreviewSubmitMessage(error instanceof Error ? error.message : 'Unable to submit registration preview.');
    } finally {
      setIsSubmittingSignupPreview(false);
    }
  };

  const handleSaveEvent = (nextEvent: EventConfig) => {
    const normalizedEvent = normalizeEventConfig(nextEvent);
    const exists = events.some((entry) => entry.id === normalizedEvent.id);
    const nextEvents = exists
      ? events.map((entry) => (entry.id === normalizedEvent.id ? normalizedEvent : entry))
      : [...events, normalizedEvent].sort((a, b) => a.displayOrder - b.displayOrder);
    const nextDivisions = divisions.map((entry) => ({
      ...entry,
      eventIds: normalizedEvent.connectedDivisionIds.includes(entry.id)
        ? Array.from(new Set([...entry.eventIds, normalizedEvent.id]))
        : entry.eventIds.filter((id) => id !== normalizedEvent.id),
    }));
    const nextSquads = squads.map((entry) => ({
      ...entry,
      eventIds: normalizedEvent.connectedSquadIds.includes(entry.id)
        ? Array.from(new Set([...entry.eventIds, normalizedEvent.id]))
        : entry.eventIds.filter((id) => id !== normalizedEvent.id),
    }));
    setEvents(nextEvents);
    setDivisions(nextDivisions);
    setSquads(nextSquads);
    setDrawerState(null);
    void persistOrganizerChanges({ events: nextEvents, divisions: nextDivisions, squads: nextSquads });
  };

  const persistOrganizerChanges = async (overrides: {
    events?: EventConfig[];
    divisions?: DivisionConfig[];
    squads?: SquadConfig[];
    fees?: FeeConfig[];
    locations?: LocationConfig[];
    questions?: CustomQuestionConfig[];
    fields?: RegistrationFieldConfig[];
  }) => {
    if (!persistedTournamentId || autosaveInFlightRef.current || isSavingDraft || isPublishing) {
      return;
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setAutosaveError('Autosave paused: session expired.');
      return;
    }

    const nextEvents = overrides.events ?? events;
    const nextDivisions = overrides.divisions ?? divisions;
    const nextSquads = overrides.squads ?? squads;
    const nextFees = overrides.fees ?? fees;
    const nextLocations = overrides.locations ?? locations;
    const nextQuestions = overrides.questions ?? questions;
    const nextFields = overrides.fields ?? fields;

    const nextFingerprint = JSON.stringify({
      tournamentId: persistedTournamentId,
      details,
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
      fees: nextFees,
      locations: nextLocations,
      questions: nextQuestions,
      fields: nextFields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
      pendingLogoFile: pendingLogoFile
        ? {
            name: pendingLogoFile.name,
            size: pendingLogoFile.size,
            lastModified: pendingLogoFile.lastModified,
            type: pendingLogoFile.type,
          }
        : null,
    });

    autosaveInFlightRef.current = true;
    setIsAutosaving(true);
    setAutosaveError(null);

    try {
      const organizerPayload = buildOrganizerSetupPayload({
        details,
        events: nextEvents,
        divisions: nextDivisions,
        squads: nextSquads,
        fees: nextFees,
        locations: nextLocations,
        questions: nextQuestions,
        fields: nextFields,
        hasRulesDocument,
        paymentMode,
        paymentProcessorConnected,
        paymentPayoutConfigured,
      });

      await saveOrganizerSetupState({
        token,
        tournamentId: persistedTournamentId,
        payload: organizerPayload,
        isPublished: false,
      });

      await refreshTournamentLibrary(token);
      autosaveFingerprintRef.current = nextFingerprint;
      setAutosaveEnabled(true);
      setAutosaveSavedAt(new Date().toISOString());
      router.refresh();
    } catch (error) {
      setAutosaveError(error instanceof Error ? error.message : 'Autosave failed.');
    } finally {
      setIsAutosaving(false);
      autosaveInFlightRef.current = false;
    }
  };

  const handleDuplicateEvent = (eventId: string) => {
    const sourceEvent = events.find((entry) => entry.id === eventId);
    if (!sourceEvent) {
      return;
    }

    const duplicatedEvent = normalizeEventConfig({
      ...sourceEvent,
      id: buildClientId('ev'),
      name: buildDuplicateName(sourceEvent.name, 'Untitled Event'),
      displayOrder: events.length + 1,
    });

    const nextEvents = [...events, duplicatedEvent].sort((a, b) => a.displayOrder - b.displayOrder);
    const nextDivisions = divisions.map((entry) => (
      sourceEvent.connectedDivisionIds.includes(entry.id)
        ? { ...entry, eventIds: entry.eventIds.includes(duplicatedEvent.id) ? entry.eventIds : [...entry.eventIds, duplicatedEvent.id] }
        : entry
    ));
    const nextSquads = squads.map((entry) => (
      sourceEvent.connectedSquadIds.includes(entry.id)
        ? { ...entry, eventIds: entry.eventIds.includes(duplicatedEvent.id) ? entry.eventIds : [...entry.eventIds, duplicatedEvent.id] }
        : entry
    ));

    setEvents(nextEvents);
    setDivisions(nextDivisions);
    setSquads(nextSquads);
    setSelectedEventId(duplicatedEvent.id);
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this event?')) {
      return;
    }

    const nextEvents = events.filter((entry) => entry.id !== eventId);
    const nextDivisions = divisions.map((entry) => ({
      ...entry,
      eventIds: entry.eventIds.filter((id) => id !== eventId),
    }));
    const nextSquads = squads.map((entry) => ({
      ...entry,
      eventIds: entry.eventIds.filter((id) => id !== eventId),
    }));
    const nextFees = fees.map((entry) => ({
      ...entry,
      eventIds: entry.eventIds.filter((id) => id !== eventId),
    }));
    const nextQuestions = questions.map((entry) => ({
      ...entry,
      scope: {
        ...entry.scope,
        eventIds: entry.scope.eventIds.filter((id) => id !== eventId),
      },
    }));

    setEvents(nextEvents);
    setDivisions(nextDivisions);
    setSquads(nextSquads);
    setFees(nextFees);
    setQuestions(nextQuestions);
    setSelectedEventId((prev) => (prev === eventId ? null : prev));
    setDrawerState((prev) => (prev?.kind === 'event' && prev.id === eventId ? null : prev));
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
      fees: nextFees,
      questions: nextQuestions,
    });
  };

  const handleSaveDivision = (nextDivision: DivisionConfig) => {
    const exists = divisions.some((entry) => entry.id === nextDivision.id);
    const nextDivisions = exists
      ? divisions.map((entry) => (entry.id === nextDivision.id ? nextDivision : entry))
      : [...divisions, nextDivision];
    setDivisions(nextDivisions);
    setDrawerState(null);
    void persistOrganizerChanges({ divisions: nextDivisions });
  };

  const handleDuplicateDivision = (divisionId: string) => {
    const sourceDivision = divisions.find((entry) => entry.id === divisionId);
    if (!sourceDivision) {
      return;
    }

    const duplicatedDivision: DivisionConfig = {
      ...sourceDivision,
      id: buildClientId('div'),
      name: buildDuplicateName(sourceDivision.name, 'Untitled Division'),
      eventIds: [],
    };

    const nextDivisions = [...divisions, duplicatedDivision];

    setDivisions(nextDivisions);
    setSelectedDivisionId(duplicatedDivision.id);
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      divisions: nextDivisions,
    });
  };

  const handleDeleteDivision = (divisionId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this division?')) {
      return;
    }

    const nextDivisions = divisions.filter((entry) => entry.id !== divisionId);
    const nextEvents = events.map((entry) => {
      const connectedDivisionIds = entry.connectedDivisionIds.filter((id) => id !== divisionId);
      return {
        ...entry,
        connectedDivisionIds,
        requireDivision: entry.requireDivision,
      };
    });
    const nextFees = fees.map((entry) => ({
      ...entry,
      divisionIds: entry.divisionIds.filter((id) => id !== divisionId),
    }));
    const nextQuestions = questions.map((entry) => ({
      ...entry,
      scope: {
        ...entry.scope,
        divisionIds: entry.scope.divisionIds.filter((id) => id !== divisionId),
      },
    }));

    setDivisions(nextDivisions);
    setEvents(nextEvents);
    setFees(nextFees);
    setQuestions(nextQuestions);
    setSelectedDivisionId((prev) => (prev === divisionId ? null : prev));
    setDrawerState((prev) => (prev?.kind === 'division' && prev.id === divisionId ? null : prev));
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      fees: nextFees,
      questions: nextQuestions,
    });
  };

  const handleSaveSquad = (nextSquad: SquadConfig) => {
    const normalizedSquad = normalizeSquadConfig(nextSquad, {
      locationName: details.bowlingCenter,
      registrationDeadlineIso: details.registrationCloseIso,
    });
    const exists = squads.some((entry) => entry.id === normalizedSquad.id);
    const nextSquads = exists
      ? squads.map((entry) => (entry.id === normalizedSquad.id ? normalizedSquad : entry))
      : [...squads, normalizedSquad];
    setSquads(nextSquads);
    setDrawerState(null);
    void persistOrganizerChanges({ squads: nextSquads });
  };

  const handleDeleteSquad = (squadId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this squad? Existing event, fee, and question references will also be removed.')) return;
    const nextSquads = squads.filter((entry) => entry.id !== squadId);
    const nextEvents = events.map((entry) => ({ ...entry, connectedSquadIds: entry.connectedSquadIds.filter((id) => id !== squadId) }));
    const nextFees = fees.map((entry) => ({ ...entry, squadIds: entry.squadIds.filter((id) => id !== squadId) }));
    const nextQuestions = questions.map((entry) => ({ ...entry, scope: { ...entry.scope, squadIds: entry.scope.squadIds.filter((id) => id !== squadId) } }));
    setSquads(nextSquads);
    setEvents(nextEvents);
    setFees(nextFees);
    setQuestions(nextQuestions);
    setDrawerState(null);
    void persistOrganizerChanges({ squads: nextSquads, events: nextEvents, fees: nextFees, questions: nextQuestions });
  };

  const handleSaveQuestion = (nextQuestion: CustomQuestionConfig) => {
    const exists = questions.some((entry) => entry.id === nextQuestion.id);
    const nextQuestions = exists
      ? questions.map((entry) => (entry.id === nextQuestion.id ? nextQuestion : entry))
      : [...questions, nextQuestion];
    setQuestions(nextQuestions);
    setDrawerState(null);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleSaveField = (nextField: RegistrationFieldConfig) => {
    const normalizedField = nextField.key === 'bowling_hand'
      ? {
          ...nextField,
          mode: 'dont-ask' as RegistrationFieldConfig['mode'],
        }
      : nextField;
    const nextFields = fields.map((entry) => (entry.id === normalizedField.id ? normalizedField : entry));
    setFields(nextFields);
    setDrawerState(null);
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleDeleteField = (fieldId: string) => {
    const targetField = fields.find((entry) => entry.id === fieldId);
    if (!targetField) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`Delete ${targetField.customLabel || targetField.label}?`)) {
      return;
    }

    const nextFields = builtInRegistrationFieldKeys.has(targetField.key)
      ? fields.map((entry) => (
        entry.id === fieldId
          ? {
              ...entry,
              mode: 'dont-ask' as RegistrationFieldConfig['mode'],
              customLabel: '',
              helpText: '',
            }
          : entry
      ))
      : fields.filter((entry) => entry.id !== fieldId);

    setFields(nextFields);
    setDrawerState((prev) => (prev?.kind === 'field' && prev.id === fieldId ? null : prev));
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleSetFieldMode = (fieldId: string, mode: RegistrationFieldConfig['mode']) => {
    const nextFields = fields.map((entry) => {
      if (entry.id !== fieldId) {
        return entry;
      }

      return {
        ...entry,
        mode,
      };
    });

    setFields(nextFields);
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleSetQuestionEnabled = (questionId: string, enabled: boolean) => {
    const nextQuestions = questions.map((entry) => (
      entry.id === questionId
        ? { ...entry, enabled }
        : entry
    ));

    setQuestions(nextQuestions);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleSetQuestionRequired = (questionId: string, required: boolean) => {
    const nextQuestions = questions.map((entry) => (
      entry.id === questionId
        ? { ...entry, required }
        : entry
    ));

    setQuestions(nextQuestions);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleFieldDragStart = (fieldId: string, event: DragEvent<HTMLElement>) => {
    setDraggingFieldId(fieldId);
    setDragOverFieldId(fieldId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFieldDragOver = (targetFieldId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverFieldId((prev) => (prev === targetFieldId ? prev : targetFieldId));
  };

  const handleFieldDrop = (targetFieldId: string) => {
    if (!draggingFieldId) {
      return;
    }

    const draggedId = draggingFieldId;
    setDraggingFieldId(null);
    setDragOverFieldId(null);

    if (draggedId === targetFieldId) {
      return;
    }

    const nextFields = reorderItemsByDropTarget(fields, draggedId, targetFieldId);
    setFields(nextFields);
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleFieldDragEnd = () => {
    setDraggingFieldId(null);
    setDragOverFieldId(null);
  };

  const handleQuestionDragStart = (questionId: string, event: DragEvent<HTMLElement>) => {
    setDraggingQuestionId(questionId);
    setDragOverQuestionId(questionId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleQuestionDragOver = (targetQuestionId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverQuestionId((prev) => (prev === targetQuestionId ? prev : targetQuestionId));
  };

  const handleQuestionDrop = (targetQuestionId: string) => {
    if (!draggingQuestionId) {
      return;
    }

    const draggedId = draggingQuestionId;
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);

    if (draggedId === targetQuestionId) {
      return;
    }

    const nextQuestions = reorderItemsByDropTarget(questions, draggedId, targetQuestionId);
    setQuestions(nextQuestions);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleQuestionDragEnd = () => {
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
  };

  const handleSaveFee = (nextFee: FeeConfig) => {
    const normalizedFee: FeeConfig = {
      ...nextFee,
      required: false,
    };

    const exists = fees.some((entry) => entry.id === normalizedFee.id);
    const nextFees = exists
      ? fees.map((entry) => (entry.id === normalizedFee.id ? normalizedFee : entry))
      : [...fees, normalizedFee];

    setFees(nextFees);
    setDrawerState(null);
    void persistOrganizerChanges({ fees: nextFees });
  };

  const handleSaveLocation = (nextLocation: LocationConfig) => {
    const exists = locations.some((entry) => entry.id === nextLocation.id);
    const nextLocations = exists
      ? locations.map((entry) => (entry.id === nextLocation.id ? nextLocation : entry))
      : [...locations, nextLocation];

    setLocations(nextLocations);
    setDrawerState(null);
    void persistOrganizerChanges({ locations: nextLocations });
  };

  const applyLogoFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg']);
    const isAllowedType = allowedTypes.has(file.type.toLowerCase());
    if (!isAllowedType) {
      setLogoUploadError('Please upload a PNG or JPG file.');
      return;
    }

    if (file.size > maxBytes) {
      setLogoUploadError('Logo file is too large. Max size is 5MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setLogoUploadError(null);
    setPendingLogoFile(file);
    setPreviewUrl(previewUrl);
    setDetails((prev) => ({
      ...prev,
      logoFileName: file.name,
    }));
  };

  const clearLogo = async () => {
    setLogoUploadError(null);

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (token && persistedTournamentId) {
      try {
        await deleteTournamentLogo({ token, tournamentId: persistedTournamentId });
      } catch (error) {
        setLogoUploadError(error instanceof Error ? error.message : 'Failed to remove logo.');
        return;
      }
    }

    setPendingLogoFile(null);
    setPreviewUrl(null);
    setDetails((prev) => ({
      ...prev,
      logoFileName: '',
    }));
  };

  const handleLogoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void applyLogoFile(event.target.files?.[0] ?? null);
    // Allow re-selecting the same file by clearing the current value.
    event.target.value = '';
  };

  const handleLogoDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsLogoDragActive(false);
    void applyLogoFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className={styles.shell}>
      <section className={styles.topOverviewCard} aria-label="Builder overview">
        <header className={styles.topBar}>
          <div className={styles.builderIdentity}>
            <p className={styles.eyebrow}>Tournament Builder</p>
            <div className={styles.builderTitleRow}>
              <h1>{details.name.trim() || 'Untitled Tournament'}</h1>
              <span className={`${styles.builderStateBadge} ${publishedAt ? styles.builderStatePublished : ''}`}>
                {publishedAt ? 'Published' : completion === 100 ? 'Ready to Publish' : validationIssues.some((issue) => issue.severity === 'error') ? 'Needs Attention' : 'Draft'}
              </span>
            </div>
            <p>{setupSections.find((section) => section.key === activeSection)?.label} · Step {setupSections.findIndex((section) => section.key === activeSection) + 1} of {setupSections.length}</p>
          </div>
          <div className={styles.topActions}>
            <input
              ref={templateInputRef}
              type="file"
              accept="application/json,.json"
              className={styles.visuallyHidden}
              onChange={(event) => { void handleImportTemplate(event); }}
            />
            <details className={styles.builderActionsMenu}>
              <summary><MoreHorizontal size={15} /> More</summary>
              <div className={styles.builderActionsMenuPanel}>
                <button type="button" onClick={() => { void handleOpenTournamentModal(); }} disabled={isLoadingTournamentLibrary}><RotateCcw size={14} /> {isLoadingTournamentLibrary ? 'Loading...' : 'Load Tournament'}</button>
                <button type="button" onClick={() => templateInputRef.current?.click()}><Upload size={14} /> Import Template</button>
                <button type="button" onClick={handleExportReport}><Download size={14} /> Download Summary</button>
                <button type="button" onClick={handleExportTemplate}><FileJson size={14} /> Export Template</button>
              </div>
            </details>
            <button type="button" className={styles.secondaryAction} onClick={() => { void handleSaveDraft(); }} disabled={isSavingDraft || isPublishing}>
              <Save size={15} /> {isSavingDraft ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className={styles.primaryAction} onClick={() => setActiveSection('review-publish')}>
              Review & Publish
            </button>
          </div>
        </header>

        <div className={styles.topOverviewMeta}>
          {(draftSavedAt || publishedAt || saveError || autosaveError) ? (
            <div
              className={styles.noticeRow}
              role={saveError ? 'alert' : 'status'}
              aria-live={saveError ? 'assertive' : 'polite'}
            >
              {publishedAt && <span className={styles.publishSuccess}>Tournament published {new Date(publishedAt).toLocaleString()}.</span>}
              {draftSavedAt && <span>Draft saved {new Date(draftSavedAt).toLocaleString()}.</span>}
              {autosaveError && <span className={styles.autosaveError}>{autosaveError}</span>}
              {saveError && <span className={styles.saveError}>{saveError}</span>}
            </div>
          ) : null}

          <div className={styles.builderProgressRow}>
            <div className={styles.builderProgressCopy}>
              <strong>{completion}% complete</strong>
              <span>{completedSectionCount} of {setupSections.length} sections ready</span>
            </div>
            <div className={styles.builderProgressTrack} aria-label={`${completion}% of tournament setup complete`}>
              <span style={{ width: `${completion}%` }} />
            </div>
            <span className={styles.builderSaveState}><CircleCheck size={13} /> {autosaveStatusLabel}</span>
          </div>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <aside className={styles.navRail}>
          <div className={styles.navRailTitle}><h2>Tournament Setup</h2><span>{completedSectionCount} of {setupSections.length} ready</span></div>
          <div className={styles.mobileSectionPicker}>
            <label htmlFor="section-picker">Step {setupSections.findIndex((section) => section.key === activeSection) + 1} of {setupSections.length}</label>
            <select id="section-picker" value={activeSection} onChange={(event) => setActiveSection(event.target.value as SetupSectionKey)}>
              {setupSections.map((section) => (
                <option key={section.key} value={section.key}>{section.label}</option>
              ))}
            </select>
          </div>
          <span className={styles.navGroupLabel}>Setup</span>
          <ul>
            {setupSections.filter((section) => section.key !== 'review-publish').map((section) => {
              const index = setupSections.findIndex((entry) => entry.key === section.key);
              const active = section.key === activeSection;
              const status = statusBySection[section.key];
              const issueCount = validationIssues.filter((issue) => issue.section === section.key).length;
              const optional = section.key === 'squads-availability' || section.key === 'fees-payments-documents';
              return (
                <li key={section.key}>
                  <button
                    type="button"
                    className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    onClick={() => setActiveSection(section.key)}
                  >
                    <span className={styles.navText}>
                      <strong>{section.label}</strong>
                      <small>{active ? `Step ${index + 1} of ${setupSections.length}` : status === 'not-used' ? 'Not Used' : optional ? 'Optional' : ''}</small>
                    </span>
                    {issueCount > 0 ? <span className={styles.navIssueCount}>{issueCount} issue{issueCount === 1 ? '' : 's'}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.navReviewGroup}>
            <span className={styles.navGroupLabel}>Review</span>
            {setupSections.filter((section) => section.key === 'review-publish').map((section) => {
              const active = section.key === activeSection;
              const issueCount = validationIssues.filter((issue) => issue.severity === 'error').length;
              return <button key={section.key} type="button" className={`${styles.navItem} ${styles.navReviewItem} ${active ? styles.navItemActive : ''}`} onClick={() => setActiveSection(section.key)}><span className={styles.navText}><strong>{section.label}</strong><small>{issueCount > 0 ? `${issueCount} blocking` : 'Ready'}</small></span></button>;
            })}
          </div>

        </aside>

        <main className={styles.workspace}>
          {activeSection === 'tournament-details' && (
            <TournamentDetailsSection
              details={details}
              setDetails={setDetails}
              statusBySection={statusBySection}
              supportEmailLooksValid={supportEmailLooksValid}
              hasLogoAsset={hasLogoAsset}
              logoAssetName={logoAssetName}
              logoAssetMeta={logoAssetMeta}
              logoPreviewUrl={logoPreviewUrl}
              isLogoDragActive={isLogoDragActive}
              logoUploadError={logoUploadError}
              pendingLogoFile={pendingLogoFile}
              tournamentDateOrderInvalid={tournamentDateOrderInvalid}
              registrationDateOrderInvalid={registrationDateOrderInvalid}
              registrationAfterStartWarning={registrationAfterStartWarning}
              usStates={US_STATES}
              timezones={TIMEZONES}
              logoInputRef={logoInputRef}
              handleLogoInputChange={handleLogoInputChange}
              handleLogoDrop={handleLogoDrop}
              clearLogo={clearLogo}
              setIsLogoDragActive={setIsLogoDragActive}
            />
          )}
              {activeSection === 'events-divisions' && (
                <section className={`${styles.sectionCard} ${styles.evDivSection}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Events &amp; Divisions</h2>
                      <p>Define registration offerings and optional eligibility groups.</p>
                    </div>
                    <SetupStatusBadge status={statusBySection['events-divisions']} />
                  </div>

                  <div className={styles.evDivLayout}>
                    <div className={styles.evDivColumn}>
                      <div className={styles.evDivListCard}>
                        <div className={styles.evDivListHead}>
                          <div className={styles.evDivListHeadText}>
                            <span className={styles.evDivListHeadIcon}><Trophy size={14} /></span>
                            <h2>Events</h2>
                            <p>Define what bowlers can enter.</p>
                          </div>
                          <div className={styles.evDivListHeadActions}>
                            <span className={styles.evDivCountPill}>{events.length} event{events.length === 1 ? '' : 's'}</span>
                            <button
                              type="button"
                              className={styles.inlineAction}
                              onClick={() => {
                                const next = emptyEvent(events.length + 1);
                                const nextEvents = [...events, next];
                                setEvents(nextEvents);
                                setSelectedEventId(next.id);
                                setOpenCardMenu(null);
                                void persistOrganizerChanges({ events: nextEvents });
                              }}
                            >
                              <Plus size={14} /> Add Event
                            </button>
                          </div>
                        </div>
                        <div className={styles.evDivListBody}>
                          {events.length === 0 && (
                            <div className={styles.evDivEmpty}><strong>No events configured</strong><span>Add an event to define what bowlers can register for.</span></div>
                          )}
                          {events.map((ev) => {
                            const squadCount = ev.connectedSquadIds.length;
                            const eventStatus = !ev.name.trim() ? 'Needs Name' : ev.requireSquad && squadCount === 0 ? 'Needs Squads' : ev.requireDivision && ev.connectedDivisionIds.length === 0 ? 'Needs Divisions' : ev.enabled ? 'Ready' : 'Draft';
                            const metaParts = [
                              ev.minPlayers === ev.maxPlayers ? `${ev.minPlayers} Bowler${ev.minPlayers !== 1 ? 's' : ''}` : `${ev.minPlayers}-${ev.maxPlayers} Bowlers`,
                              ev.scoring.charAt(0).toUpperCase() + ev.scoring.slice(1),
                              ev.requireDivision ? 'Division Required' : 'Division Optional',
                              `${squadCount} Squad${squadCount !== 1 ? 's' : ''}`,
                            ];
                            return (
                              <div
                                key={ev.id}
                                className={`${styles.evCardRow} ${selectedEventId === ev.id ? styles.evCardRowActive : ''}`}
                                onClick={() => {
                                  setSelectedEventId(ev.id);
                                  setOpenCardMenu(null);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setSelectedEventId(ev.id);
                                    setOpenCardMenu(null);
                                  }
                                }}
                              >
                                <div className={styles.dragHandle}><GripVertical size={15} /></div>
                                <div className={styles.evCardMain}>
                                  <div className={styles.evCardTitle}>
                                    <strong>{ev.name || 'Untitled Event'}</strong>
                                    <span className={`${styles.evCardBadge} ${eventStatus === 'Ready' ? styles.evCardBadgeEnabled : styles.evCardBadgeDraft}`}>
                                      {eventStatus}
                                    </span>
                                  </div>
                                  <p className={styles.evCardMeta}>{metaParts.join(' · ')}</p>
                                  <p className={styles.evCardFee}>{formatMoney(ev.entryFeeCents)} Entry Fee</p>
                                </div>
                                <div className={styles.cardActions}>
                                  <button type="button" className={styles.iconButton} onClick={(e) => { e.stopPropagation(); setSelectedEventId(ev.id); }} aria-label="Edit event"><PencilLine size={14} /></button>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenCardMenu((prev) => prev?.kind === 'event' && prev.id === ev.id ? null : { kind: 'event', id: ev.id });
                                    }}
                                    aria-label="More actions"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {openCardMenu?.kind === 'event' && openCardMenu.id === ev.id ? (
                                    <div className={styles.cardMenu} onClick={(e) => e.stopPropagation()}>
                                      <button type="button" className={styles.cardMenuButton} onClick={() => handleDuplicateEvent(ev.id)}>Duplicate</button>
                                      <button type="button" className={`${styles.cardMenuButton} ${styles.cardMenuButtonDanger}`} onClick={() => handleDeleteEvent(ev.id)}>Delete</button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={styles.evDivColumn}>
                      <div className={styles.evDivListCard}>
                        <div className={styles.evDivListHead}>
                          <div className={styles.evDivListHeadText}>
                            <span className={styles.evDivListHeadIcon}><ListOrdered size={14} /></span>
                            <h2>Divisions</h2>
                            <p>Define optional eligibility groups used by events.</p>
                          </div>
                          <div className={styles.evDivListHeadActions}>
                            <span className={styles.evDivCountPill}>{divisions.length} division{divisions.length === 1 ? '' : 's'}</span>
                            <button
                              type="button"
                              className={styles.inlineAction}
                              onClick={() => {
                                const next: DivisionConfig = emptyDivision();
                                const nextDivisions = [...divisions, next];
                                setDivisions(nextDivisions);
                                setSelectedDivisionId(next.id);
                                setOpenCardMenu(null);
                                void persistOrganizerChanges({ divisions: nextDivisions });
                              }}
                            >
                              <Plus size={14} /> Add Division
                            </button>
                          </div>
                        </div>
                        <div className={styles.evDivListBody}>
                          {divisions.length === 0 && (
                            <div className={styles.evDivEmpty}><strong>No divisions needed</strong><span>Divisions are optional. Add one when eligibility or scoring groups differ.</span></div>
                          )}
                          {divisions.map((div) => {
                            const avgLabel = div.minAverage !== null && div.maxAverage !== null
                              ? `Avg ${div.minAverage}–${div.maxAverage}`
                              : div.minAverage !== null
                                ? `Avg ${div.minAverage}+`
                                : div.maxAverage !== null
                                  ? `Avg ${div.maxAverage} & Below`
                                  : 'No Avg Restriction';
                            const scoringLabel = div.mode.charAt(0).toUpperCase() + div.mode.slice(1);
                            const usedByNames = events.filter((ev) => ev.connectedDivisionIds.includes(div.id)).map((ev) => ev.name).filter(Boolean);
                            const divisionStatus = !div.name.trim() ? 'Needs Name' : usedByNames.length > 0 ? 'In Use' : 'Not Used';
                            return (
                              <div
                                key={div.id}
                                className={`${styles.evCardRow} ${selectedDivisionId === div.id ? styles.evCardRowActive : ''}`}
                                onClick={() => {
                                  setSelectedDivisionId(div.id);
                                  setOpenCardMenu(null);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setSelectedDivisionId(div.id);
                                    setOpenCardMenu(null);
                                  }
                                }}
                              >
                                <div className={styles.dragHandle}><ListOrdered size={15} /></div>
                                <div className={styles.evCardMain}>
                                  <div className={styles.evCardTitle}>
                                    <strong className={styles.evCardDivName}>{div.name || 'Untitled Division'}</strong>
                                    <span className={`${styles.evCardBadge} ${divisionStatus === 'In Use' ? styles.evCardBadgeEnabled : styles.evCardBadgeDraft}`}>
                                      {divisionStatus}
                                    </span>
                                  </div>
                                  <p className={styles.evCardMeta}>{avgLabel} · {scoringLabel}</p>
                                  {usedByNames.length > 0 && (
                                    <p className={styles.evCardUsedBy}>Used by: {usedByNames.join(', ')}</p>
                                  )}
                                </div>
                                <div className={styles.cardActions}>
                                  <button type="button" className={styles.iconButton} onClick={(e) => { e.stopPropagation(); setSelectedDivisionId(div.id); }} aria-label="Edit division"><PencilLine size={14} /></button>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenCardMenu((prev) => prev?.kind === 'division' && prev.id === div.id ? null : { kind: 'division', id: div.id });
                                    }}
                                    aria-label="More actions"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {openCardMenu?.kind === 'division' && openCardMenu.id === div.id ? (
                                    <div className={styles.cardMenu} onClick={(e) => e.stopPropagation()}>
                                      <button type="button" className={styles.cardMenuButton} onClick={() => handleDuplicateDivision(div.id)}>Duplicate</button>
                                      <button type="button" className={`${styles.cardMenuButton} ${styles.cardMenuButtonDanger}`} onClick={() => handleDeleteDivision(div.id)}>Delete</button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
          )}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Event editor modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {selectedEventId && events.find((e) => e.id === selectedEventId) && (
            <div className={styles.editorModal} role="dialog" aria-modal="true">
              <div className={styles.editorModalBox}>
                <div className={styles.editorModalHead}>
                  <div className={styles.divisionEditorHeadBlock}>
                    <span className={styles.divisionEditorHeadBadge}><Trophy size={14} /></span>
                    <div className={styles.divisionEditorHeadText}>
                      <span className={styles.editorModalTitle}>Event Details</span>
                      <small className={styles.divisionEditorHeadSubtitle}>{events.find((e) => e.id === selectedEventId)!.name || 'New Event'}</small>
                    </div>
                  </div>
                  <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={() => setSelectedEventId(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className={styles.editorModalBody}>
                  <InlineEventEditor
                    key={selectedEventId}
                    event={events.find((e) => e.id === selectedEventId)!}
                    divisions={divisions}
                    squads={squads}
                    onSave={(updated) => {
                      handleSaveEvent(updated);
                      setSelectedEventId(null);
                    }}
                    onCancel={() => setSelectedEventId(null)}
                    onDelete={() => handleDeleteEvent(selectedEventId)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Division editor modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {selectedDivisionId && divisions.find((d) => d.id === selectedDivisionId) && (
            <div className={styles.editorModal} role="dialog" aria-modal="true">
              <div className={styles.editorModalBox}>
                <div className={styles.editorModalHead}>
                  <div className={styles.divisionEditorHeadBlock}>
                    <span className={styles.divisionEditorHeadBadge}><Layers size={14} /></span>
                    <div className={styles.divisionEditorHeadText}>
                      <span className={styles.editorModalTitle}>Division Details</span>
                      <small className={styles.divisionEditorHeadSubtitle}>{divisions.find((d) => d.id === selectedDivisionId)!.name || 'New Division'}</small>
                    </div>
                  </div>
                  <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={() => setSelectedDivisionId(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className={styles.editorModalBody}>
                  <InlineDivisionEditor
                    key={selectedDivisionId}
                    division={divisions.find((d) => d.id === selectedDivisionId)!}
                    usedByEventNames={events.filter((event) => event.connectedDivisionIds.includes(selectedDivisionId)).map((event) => event.name || 'Untitled Event')}
                    onSave={(updated) => {
                      handleSaveDivision(updated);
                      setSelectedDivisionId(null);
                    }}
                    onCancel={() => setSelectedDivisionId(null)}
                    onDelete={() => handleDeleteDivision(selectedDivisionId)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'squads-availability' && (
            <div className={styles.squadDashLayout}>
              <section className={styles.sectionCard}>
                <div className={`${styles.sectionHeader} ${styles.squadSectionHeader}`}>
                  <div>
                    <h2>Squads & Availability</h2>
                    <p className={styles.squadDashSubtitle}>
                      Manage optional bowling times, locations, capacity, and registration availability.
                    </p>
                  </div>
                  <div className={styles.squadHeaderActions}>
                    <SetupStatusBadge status={statusBySection['squads-availability']} />
                    <span className={styles.evDivCountPill}>{squads.length} squads</span>
                    <div className={styles.squadDashActions}>
                    <button type="button" className={styles.secondaryAction} onClick={() => setActiveSection('registration-setup')}>
                      <Eye size={14} /> Preview Registration
                    </button>
                    <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'squad' })}>
                      <Plus size={14} /> Add Squad
                    </button>
                    </div>
                  </div>
                </div>

                {squads.length === 0 ? (
                  <div className={styles.squadEmptyState}>
                    <span className={styles.squadEmptyIcon}><CalendarDays size={22} /></span>
                    <h3>No squads are needed yet</h3>
                    <p>Squads are optional. Add them when your tournament offers specific bowling times or needs capacity limits.</p>
                    <button type="button" className={styles.primaryAction} onClick={() => setDrawerState({ kind: 'squad' })}>
                      <Plus size={14} /> Add First Squad
                    </button>
                  </div>
                ) : (
                  <>
                <div className={styles.squadMetricGrid}>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><Users size={14} /></span>
                    <div>
                      <small>Total Squads</small>
                      <strong>{squads.length}</strong>
                    </div>
                  </article>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><CalendarDays size={14} /></span>
                    <div>
                      <small>Dates</small>
                      <strong>{groupsByDate.length}</strong>
                    </div>
                  </article>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><Users size={14} /></span>
                    <div>
                      <small>Total Capacity</small>
                      <strong>{totalSquadCapacity}</strong>
                    </div>
                  </article>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><CircleCheck size={14} /></span>
                    <div>
                      <small>Spots Filled</small>
                      <strong>{totalRegisteredSpots}</strong>
                      <div className={styles.squadMetricFoot}>
                        <em>{fillPercent}% full</em>
                        <span className={styles.squadMetricGauge} style={fillGaugeStyle}>
                          <span>{fillPercent}%</span>
                        </span>
                      </div>
                    </div>
                  </article>
                </div>

                <div className={styles.squadGroupStack}>
                  {squadGroups.map((group) => (
                    <section key={group.key} className={styles.squadGroupBlock}>
                      <header className={styles.squadGroupHead}>
                        <h3><CalendarDays size={14} /> {group.label}</h3>
                        <div className={styles.squadGroupHeadMeta}>
                          <span>{group.squads.length} squads - {group.squads.reduce((sum, squad) => sum + squad.capacity, 0)} capacity - {group.squads.reduce((sum, squad) => sum + squad.registeredCount, 0)} filled</span>
                          <button type="button" className={styles.squadChevronButton} aria-label="Collapse date group" disabled>
                            <ChevronUp size={13} />
                          </button>
                        </div>
                      </header>
                      <div className={styles.squadRowList}>
                        {group.squads.map((squad, rowIndex) => {
                          const fillRate = squad.capacity > 0 ? squad.registeredCount / squad.capacity : 0;
                          const fillToneClass = fillRate >= 0.75
                            ? styles.squadStatusHigh
                            : fillRate >= 0.35
                              ? styles.squadStatusMid
                              : styles.squadStatusLow;
                          const fillCountClass = fillRate >= 0.75
                            ? styles.squadCountHigh
                            : fillRate >= 0.35
                              ? styles.squadCountMid
                              : styles.squadCountLow;
                          const spotsRemaining = Math.max(squad.capacity - squad.registeredCount, 0);
                          const availabilityLabel = squad.registeredCount >= squad.capacity
                            ? (squad.waitlistEnabled ? 'Waitlist open' : 'Full')
                            : fillRate >= 0.75
                              ? 'Nearly full'
                              : 'Available';
                          return (
                            <article key={squad.id} className={styles.squadRowCard}>
                              <div className={styles.squadTimeRail}>
                                <span className={`${styles.squadStatusDot} ${fillToneClass}`} aria-hidden="true" />
                                {rowIndex < group.squads.length - 1 ? <span className={styles.squadStatusLine} aria-hidden="true" /> : null}
                                <div className={styles.squadTimeBadge}>
                                  <strong>{formatSquadTimeLabel(squad.startTime)}</strong>
                                  <span>Start</span>
                                </div>
                              </div>

                              <div className={styles.squadRowMain}>
                                <strong>{squad.name}</strong>
                                <p className={styles.squadRowMeta}>
                                  <span><Clock3 size={12} /> Check-in {formatSquadTimeLabel(squad.checkInTime)}</span>
                                  <span><MapPin size={12} /> {details.bowlingCenter || 'Location TBD'}</span>
                                </p>
                                <div className={styles.metaChips}>
                                  <span className={styles.chip}>{availabilityLabel}</span>
                                  <span className={styles.chip}>{spotsRemaining} spot{spotsRemaining === 1 ? '' : 's'} remaining</span>
                                </div>
                              </div>

                              <div className={styles.squadNumericCol}>
                                <strong>{squad.capacity}</strong>
                                <span>Capacity</span>
                              </div>

                              <div className={styles.squadNumericCol}>
                                <strong className={fillCountClass}>{squad.registeredCount}/{squad.capacity}</strong>
                                <span>Registered</span>
                              </div>

                              <div className={styles.squadRowActions}>
                                <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'squad', id: squad.id })} aria-label={`Edit ${squad.name}`}>
                                  <PencilLine size={14} /> Edit
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <button type="button" className={styles.squadAddDateAction} onClick={() => setDrawerState({ kind: 'squad' })}>
                  <span className={styles.squadAddDateTitle}><Plus size={14} /> Add Squad to New Date</span>
                  <small>Create a new date and add squads</small>
                </button>
                  </>
                )}
              </section>

            </div>
          )}

          {activeSection === 'registration-setup' && (
            <div className={`${styles.sectionStack} ${styles.registrationSetupSection}`}>
              <div className={styles.registrationSetupLayout}>
                <div className={styles.registrationSetupMain}>
                <section className={`${styles.sectionCard} ${styles.registrationFieldsSection}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.registrationFieldsHeading}><span className={styles.registrationFieldsIcon}><ClipboardList size={16} /></span>Registration Fields</h2>
                      <p>Configure the built-in bowler information fields.</p>
                    </div>
                    <div className={styles.registrationHeaderActions}>
                      <span className={styles.evDivCountPill}>{askedFields.length} active</span>
                      <SetupStatusBadge status={statusBySection['registration-setup']} />
                      <button type="button" className={styles.secondaryAction} onClick={() => setShowRegistrationPreview(true)}><Eye size={14} /> Preview Registration</button>
                    </div>
                  </div>

                  <div className={styles.registrationFieldGroupCard}>
                    <div className={styles.registrationGroupHeader}>
                      <strong>Asked During Registration</strong>
                      <span>{askedFields.length} field{askedFields.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className={`${styles.listStack} ${styles.registrationFieldList} ${styles.registrationFieldGroupBody}`}>
                      {askedFields.map((field) => (
                        <article
                          key={field.id}
                          className={`${styles.configCard} ${styles.registrationFieldCard} ${styles.draggableCard} ${field.mode === 'dont-ask' ? styles.registrationFieldCardDisabled : ''} ${draggingFieldId === field.id ? styles.draggingCard : ''} ${dragOverFieldId === field.id && draggingFieldId && draggingFieldId !== field.id ? styles.dragTargetCard : ''}`}
                          draggable
                          onDragStart={(event) => handleFieldDragStart(field.id, event)}
                          onDragOver={(event) => handleFieldDragOver(field.id, event)}
                          onDrop={() => handleFieldDrop(field.id)}
                          onDragEnd={handleFieldDragEnd}
                        >
                          <div className={styles.dragHandle} aria-hidden="true">
                            <GripVertical size={14} />
                          </div>
                          <div className={styles.cardMain}>
                            <div className={styles.registrationFieldTitleRow}>
                              <div className={styles.registrationFieldNameWrap}>
                                <strong>{field.customLabel || field.label}</strong>
                              </div>
                            </div>
                            <p className={styles.registrationFieldHelpText}>{field.helpText || registrationFieldFallbackHelp(field)}</p>
                          </div>
                          <div className={styles.registrationFieldActions}>
                              <div className={styles.registrationModeControl}>
                                <select
                                  className={`${styles.registrationModeSelect} ${field.mode === 'required' ? styles.registrationModeSelectRequired : styles.registrationModeSelectOptional}`}
                                  value={field.mode}
                                  onChange={(event) => handleSetFieldMode(field.id, event.target.value as RegistrationFieldConfig['mode'])}
                                  aria-label={`Requirement setting for ${field.customLabel || field.label}`}
                                >
                                  <option value="required">Required</option>
                                  <option value="optional">Optional</option>
                                  {!['first_name', 'last_name'].includes(field.key) ? <option value="dont-ask">Don&apos;t Ask</option> : null}
                                </select>
                              </div>
                            <div className={styles.registrationFieldUtilityActions}>
                              <button
                                type="button"
                                className={styles.inlineAction}
                                onClick={() => setDrawerState({ kind: 'field', id: field.id })}
                                aria-label={`Edit ${field.label}`}
                              >
                                Edit
                              </button>
                              {!['first_name', 'last_name'].includes(field.key) && builtInRegistrationFieldKeys.has(field.key) ? (
                                <button
                                  type="button"
                                  className={`${styles.iconButton} ${styles.registrationFieldDelete}`}
                                  onClick={() => handleSetFieldMode(field.id, 'dont-ask')}
                                  aria-label={`Hide ${field.customLabel || field.label}`}
                                  title="Hide field"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : !builtInRegistrationFieldKeys.has(field.key) ? (
                                <button
                                  type="button"
                                  className={`${styles.iconButton} ${styles.registrationFieldDelete}`}
                                  onClick={() => handleDeleteField(field.id)}
                                  aria-label={`Delete ${field.customLabel || field.label}`}
                                  title="Delete field"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  {hiddenFields.length > 0 ? (
                    <div className={`${styles.registrationFieldGroupCard} ${styles.registrationFieldGroupCardMuted}`}>
                      <div className={styles.registrationGroupHeader}>
                        <strong>Don&apos;t Ask Right Now</strong>
                        <button type="button" className={styles.inlineAction} onClick={() => setShowHiddenRegistrationFields((current) => !current)}>{hiddenFields.length} hidden field{hiddenFields.length === 1 ? '' : 's'} · {showHiddenRegistrationFields ? 'Collapse' : 'Expand'}</button>
                      </div>
                      {showHiddenRegistrationFields ? <div className={`${styles.listStack} ${styles.registrationFieldList} ${styles.registrationFieldGroupBody}`}>
                        {hiddenFields.map((field) => (
                          <article
                            key={field.id}
                            className={`${styles.configCard} ${styles.registrationFieldCard} ${styles.registrationFieldCardMuted}`}
                          >
                            <div className={styles.dragHandle} aria-hidden="true">
                              <GripVertical size={14} />
                            </div>
                            <div className={styles.cardMain}>
                              <div className={styles.registrationFieldTitleRow}>
                                <div className={styles.registrationFieldNameWrap}>
                                  <strong>{field.customLabel || field.label}</strong>
                                </div>
                              </div>
                              <p className={styles.registrationFieldHelpText}>This field is currently hidden from bowlers.</p>
                              <div className={styles.metaChips}>
                                <span className={`${styles.chip} ${styles.registrationFieldModeChip} ${styles.registrationFieldModeDontAsk}`}>Don&apos;t Ask</span>
                              </div>
                            </div>
                            <div className={styles.registrationFieldActions}>
                              <div className={styles.registrationFieldUtilityActions}>
                                <button
                                  type="button"
                                  className={styles.inlineAction}
                                  onClick={() => handleSetFieldMode(field.id, 'optional')}
                                  aria-label={`Ask ${field.customLabel || field.label}`}
                                >
                                  Ask Field
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.inlineAction} ${styles.requiredToggleButton}`}
                                  onClick={() => handleSetFieldMode(field.id, 'required')}
                                  aria-label={`Ask ${field.customLabel || field.label} as required`}
                                >
                                  Ask as Required
                                </button>
                                <button
                                  type="button"
                                  className={styles.inlineAction}
                                  onClick={() => setDrawerState({ kind: 'field', id: field.id })}
                                  aria-label={`Edit ${field.label}`}
                                >
                                  <PencilLine size={15} /> Edit
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div> : null}
                    </div>
                  ) : null}

                  <div className={styles.registrationFieldFooterActions}>
                    <button type="button" className={styles.registrationFieldFooterPrimary} onClick={() => setDrawerState({ kind: 'field' })}>
                      <Plus size={14} /> Add Field
                    </button>
                  </div>
                </section>
                </div>

                <aside className={styles.registrationSetupPreviewRail}>
                  <section className={styles.previewRegistrationShell}>
                    <TournamentRegistrationForm
                      tournamentName={details.name || 'Tournament Name'}
                      squads={enabledSquads}
                      events={eventsForSelectedPreviewSquad}
                      divisions={enabledDivisions}
                      fields={askedFields}
                      questions={enabledQuestions}
                      requiredBowlerCount={requiredPreviewBowlerCount}
                      formState={signupPreviewForm}
                      setFormState={setSignupPreviewForm}
                      submitMessage={signupPreviewSubmitMessage}
                      isSubmitting={isSubmittingSignupPreview}
                      onSubmit={() => {
                        void handleSignupPreviewSubmit();
                      }}
                      footerHint="Live preview updates as you configure fields and questions."
                    />
                  </section>
                </aside>
              </div>

                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Custom Questions</h2>
                      <p>Collect only what this tournament needs.</p>
                    </div>
                    <div className={styles.registrationQuestionHeaderActions}>
                      <span className={styles.evDivCountPill}>{enabledQuestions.length} active</span>
                      <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'question' })}>
                        <Plus size={14} /> Add Question
                      </button>
                    </div>
                  </div>
                  <div className={styles.registrationGroupHeader}>
                    <strong>Asked During Registration</strong>
                    <span>{enabledQuestions.length} question{enabledQuestions.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className={styles.listStack}>
                    {enabledQuestions.length === 0 ? (
                      <div className={styles.registrationEmptyState}>
                        <strong>No custom questions</strong>
                        <p>The standard registration fields may be all you need.</p>
                        <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'question' })}><Plus size={14} /> Add Custom Question</button>
                      </div>
                    ) : null}
                    {enabledQuestions.map((question) => (
                      <article
                        key={question.id}
                        className={`${styles.configCard} ${styles.registrationQuestionCard} ${styles.draggableCard} ${draggingQuestionId === question.id ? styles.draggingCard : ''} ${dragOverQuestionId === question.id && draggingQuestionId && draggingQuestionId !== question.id ? styles.dragTargetCard : ''}`}
                        draggable
                        onDragStart={(event) => handleQuestionDragStart(question.id, event)}
                        onDragOver={(event) => handleQuestionDragOver(question.id, event)}
                        onDrop={() => handleQuestionDrop(question.id)}
                        onDragEnd={handleQuestionDragEnd}
                      >
                        <div className={styles.dragHandle} aria-hidden="true">
                          <GripVertical size={14} />
                        </div>
                        <div className={styles.cardMain}>
                          <strong>{question.label || 'Untitled question'}</strong>
                          <div className={styles.metaChips}>
                            <span className={styles.chip}>{question.type}</span>
                            <span className={styles.chip}>{question.required ? 'Required' : 'Optional'}</span>
                            <span className={styles.chip}>{question.scope.all ? 'All registrations' : 'Scoped'}</span>
                            <span className={`${styles.chip} ${question.enabled ? styles.chipEnabled : styles.chipMuted}`}>{question.enabled ? 'Enabled' : 'Disabled'}</span>
                          </div>
                        </div>
                        <div className={styles.questionCardActions}>
                          <select className={styles.registrationModeSelect} value={question.required ? 'required' : 'optional'} onChange={(event) => event.target.value === 'dont-ask' ? handleSetQuestionEnabled(question.id, false) : handleSetQuestionRequired(question.id, event.target.value === 'required')} aria-label={`Requirement setting for ${question.label || 'Untitled question'}`}><option value="required">Required</option><option value="optional">Optional</option><option value="dont-ask">Don&apos;t Ask</option></select>
                          <button type="button" className={styles.iconButton} onClick={() => setDrawerState({ kind: 'question', id: question.id })} aria-label="Edit question">
                            <PencilLine size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {disabledQuestions.length > 0 ? (
                    <>
                      <div className={styles.registrationGroupHeader}>
                        <strong>Don&apos;t Ask Right Now</strong>
                        <span>{disabledQuestions.length} hidden question{disabledQuestions.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className={styles.listStack}>
                        {disabledQuestions.map((question) => (
                          <article key={question.id} className={`${styles.configCard} ${styles.registrationQuestionCard} ${styles.questionCardDisabled}`}>
                            <div className={styles.dragHandle} aria-hidden="true">
                              <GripVertical size={14} />
                            </div>
                            <div className={styles.cardMain}>
                              <strong>{question.label || 'Untitled question'}</strong>
                              <div className={styles.metaChips}>
                                <span className={styles.chip}>{question.type}</span>
                                <span className={styles.chip}>{question.required ? 'Required' : 'Optional'}</span>
                                <span className={`${styles.chip} ${styles.chipMuted}`}>Don&apos;t Ask</span>
                              </div>
                            </div>
                            <div className={styles.questionCardActions}>
                              <button type="button" className={styles.inlineAction} onClick={() => handleSetQuestionEnabled(question.id, true)}>
                                Ask Question
                              </button>
                              <button type="button" className={styles.iconButton} onClick={() => setDrawerState({ kind: 'question', id: question.id })} aria-label="Edit question">
                                <PencilLine size={15} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : null}
                </section>
            </div>
          )}

          {activeSection === 'fees-payments-documents' && (
            <div className={`${styles.sectionStack} ${styles.feesDocumentsSection}`}>
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Add-ons & Fee Adjustments</h2>
                    <p>Base entry fees are managed in Events & Divisions. Use this section for optional extras.</p>
                  </div>
                  <div className={styles.feesHeaderActions}>
                    <span className={styles.evDivCountPill}>{addOnFees.length} active</span>
                    <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'fee' })}>
                      <Plus size={14} /> Add Add-on
                    </button>
                  </div>
                </div>
                <div className={styles.addOnList}>
                  {addOnFees.map((fee) => (
                    <article key={fee.id} className={styles.addOnRow}>
                      <div><strong>{fee.name || 'Untitled Add-on'}</strong><span>Optional during registration</span></div>
                      <strong>{formatMoney(fee.amountCents)}</strong>
                      <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'fee', id: fee.id })}><PencilLine size={14} /> Edit</button>
                    </article>
                  ))}
                  {addOnFees.length === 0 ? <div className={styles.simpleOptionalEmpty}><strong>No add-ons configured</strong><p>Add-ons are optional and can be used for brackets, donations, merchandise, or other extras.</p><button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'fee' })}><Plus size={14} /> Add First Add-on</button></div> : null}
                </div>
              </section>

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Payment Collection</h2>
                    <p>Bowlers register without paying online. Tournament staff collect entry fees at the venue.</p>
                  </div>
                  <div className={styles.feesHeaderActions}>
                    <span className={styles.evDivCountPill}>Cash only</span>
                    <SetupStatusBadge status={statusBySection['fees-payments-documents']} />
                  </div>
                </div>
                <div className={styles.paymentFacts}>
                  <span><CircleCheck size={15} /> No payment processor required</span>
                  <span><CircleCheck size={15} /> No online transaction fees</span>
                  <span><CircleCheck size={15} /> Payment is collected at check-in</span>
                </div>
              </section>

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Rules & Documents</h2>
                    <p>Optionally share tournament rules with bowlers during registration.</p>
                  </div>
                  <div className={styles.feesHeaderActions}>
                    <span className={`${styles.chip} ${hasRulesDocument ? styles.chipEnabled : styles.chipMuted}`}>
                      {hasRulesDocument ? 'Uploaded' : 'Optional'}
                    </span>
                  </div>
                </div>
                <div className={styles.configSurface}>
                  <article className={styles.documentFileCard}>
                    <div className={styles.documentFileMain}>
                      <strong>{hasRulesDocument ? 'Tournament Rules.pdf' : 'No file uploaded yet'}</strong>
                      <p>
                        {hasRulesDocument
                          ? 'Latest version is attached and shown to bowlers during signup.'
                          : 'Add a PDF if bowlers should review tournament rules before registering.'}
                      </p>
                    </div>
                    <div className={styles.documentActions}>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        disabled={!hasRulesDocument}
                      >
                        Preview
                      </button>
                      <button type="button" className={styles.inlineAction} onClick={() => setHasRulesDocument((prev) => !prev)}>
                        {hasRulesDocument ? 'Replace Document' : 'Upload Document'}
                      </button>
                    </div>
                  </article>

                </div>
              </section>
            </div>
          )}

          {showRegistrationPreview ? (
            <div className={styles.editorModal} role="dialog" aria-modal="true" aria-label="Registration preview" onClick={() => setShowRegistrationPreview(false)}>
              <div className={`${styles.editorModalBox} ${styles.registrationPreviewModal}`} onClick={(event) => event.stopPropagation()}>
                <div className={styles.editorModalHead}>
                  <div><span className={styles.editorModalTitle}>Registration Preview</span><small className={styles.divisionEditorHeadSubtitle}>Preview only · Changes update automatically</small></div>
                  <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={() => setShowRegistrationPreview(false)} aria-label="Close preview"><X size={16} /></button>
                </div>
                <div className={styles.editorModalBody}>
                  <TournamentRegistrationForm tournamentName={details.name || 'Tournament Name'} squads={enabledSquads} events={eventsForSelectedPreviewSquad} divisions={enabledDivisions} fields={askedFields} questions={enabledQuestions} requiredBowlerCount={requiredPreviewBowlerCount} formState={signupPreviewForm} setFormState={setSignupPreviewForm} submitMessage={signupPreviewSubmitMessage} isSubmitting={isSubmittingSignupPreview} onSubmit={() => { void handleSignupPreviewSubmit(); }} footerHint="Preview only. No registration will be submitted." />
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'review-publish' && (
            <section className={`${styles.sectionCard} ${styles.reviewPublishSection}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Review & Publish</h2>
                  <p>Run a final preflight check and resolve anything that could prevent registration.</p>
                </div>
                <div className={styles.reviewHeaderActions}><SetupStatusBadge status={statusBySection['review-publish']} /><button type="button" className={styles.secondaryAction} onClick={() => setLastPreflightRunAt(new Date().toISOString())}><RotateCcw size={14} /> Run Checks Again</button></div>
              </div>
              <div className={styles.preflightIntro}><strong>{validationIssues.some((issue) => issue.severity === 'error') ? 'Publishing is blocked' : 'Tournament is ready to publish'}</strong><span>{lastPreflightRunAt ? `Last checked ${new Date(lastPreflightRunAt).toLocaleTimeString()}` : 'Checks update automatically as setup changes.'}</span></div>
              <PublishValidationSummary
                issues={validationIssues}
                sections={setupSections}
                onNavigate={(section) => setActiveSection(section)}
              />
              <div className={styles.reviewStatusRecommendation}>
                <div><strong>Visibility</strong><p>{visibilitySummary}</p></div>
                <div className={styles.visibilityGroup}>
                  <button type="button" className={`${styles.visibilityOpt} ${details.visibility === 'public' ? styles.visibilityOptActive : ''}`} onClick={() => setDetails((prev) => ({ ...prev, visibility: 'public' }))}><Globe size={15} /><span>Public</span></button>
                  <button type="button" className={`${styles.visibilityOpt} ${details.visibility === 'unlisted' ? styles.visibilityOptActive : ''}`} onClick={() => setDetails((prev) => ({ ...prev, visibility: 'unlisted' }))}><Link2 size={15} /><span>Unlisted</span></button>
                  <button type="button" className={`${styles.visibilityOpt} ${details.visibility === 'private' ? styles.visibilityOptActive : ''}`} onClick={() => setDetails((prev) => ({ ...prev, visibility: 'private' }))}><Lock size={15} /><span>Private</span></button>
                </div>
              </div>
              <section className={styles.launchSummaryCard}>
                <div className={styles.preflightGroupHead}><strong>Public Launch Summary</strong><span>{recommendedTournamentStatus.value}</span></div>
                <dl className={styles.launchSummaryGrid}>
                  <div><dt>Visibility</dt><dd>{details.visibility}</dd></div>
                  <div><dt>Tournament Dates</dt><dd>{formatDateShort(details.startDateIso)} – {formatDateShort(details.endDateIso)}</dd></div>
                  <div><dt>Registration Closes</dt><dd>{formatDateShort(details.registrationCloseIso)}</dd></div>
                  <div><dt>Events</dt><dd>{enabledEvents.length}</dd></div>
                  <div><dt>Squads</dt><dd>{squads.length || 'Not Used'}</dd></div>
                  <div><dt>Divisions</dt><dd>{enabledDivisions.length || 'Not Used'}</dd></div>
                  <div><dt>Payment</dt><dd>Cash at venue</dd></div>
                </dl>
                <p>{recommendedTournamentStatus.reason}</p>
              </section>
              <div className={`${styles.publishDecisionCard} ${validationIssues.some((issue) => issue.severity === 'error') ? styles.publishDecisionBlocked : styles.publishDecisionReady}`}>
                <div><strong>{validationIssues.some((issue) => issue.severity === 'error') ? 'Publishing Blocked' : 'Ready to Publish'}</strong><p>{validationIssues.some((issue) => issue.severity === 'error') ? `Resolve ${validationIssues.filter((issue) => issue.severity === 'error').length} required issue${validationIssues.filter((issue) => issue.severity === 'error').length === 1 ? '' : 's'} before publishing.` : 'Publishing will make this tournament available according to the selected visibility.'}</p></div>
                <div className={styles.publishActionsRow}>
                  <button type="button" className={styles.secondaryAction} onClick={() => { void handleSaveDraft(); }} disabled={isSavingDraft || isPublishing}>{isSavingDraft ? 'Saving...' : 'Save'}</button>
                  <button type="button" className={styles.primaryAction} onClick={() => { void handlePublish(); }} disabled={validationIssues.some((issue) => issue.severity === 'error') || isSavingDraft || isPublishing}><CircleCheck size={15} /> {isPublishing ? 'Publishing...' : 'Publish Tournament'}</button>
                </div>
              </div>
            </section>
          )}
          <nav className={styles.setupStepFooter} aria-label="Setup step navigation">
            {setupSections.findIndex((section) => section.key === activeSection) > 0 ? <button type="button" className={styles.secondaryAction} onClick={() => setActiveSection(setupSections[setupSections.findIndex((section) => section.key === activeSection) - 1].key)}>← {setupSections[setupSections.findIndex((section) => section.key === activeSection) - 1].label}</button> : <span />}
            {setupSections.findIndex((section) => section.key === activeSection) < setupSections.length - 1 ? <button type="button" className={styles.primaryAction} onClick={() => setActiveSection(setupSections[setupSections.findIndex((section) => section.key === activeSection) + 1].key)}>{setupSections[setupSections.findIndex((section) => section.key === activeSection) + 1].label} →</button> : null}
          </nav>
        </main>
      </div>

      {isTournamentModalOpen && (
        <div className={styles.tournamentLibraryBackdrop} onClick={() => setIsTournamentModalOpen(false)}>
          <section
            className={styles.tournamentLibraryModal}
            role="dialog"
            aria-modal="true"
            aria-label="All Tournaments"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.tournamentLibraryHeader}>
              <div>
                <h3>All Tournaments</h3>
                <p>{userTournaments.length} available tournament{userTournaments.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                className={`${styles.tournamentLibraryClose} ${styles.modalCloseButton}`}
                aria-label="Close tournament list"
                onClick={() => setIsTournamentModalOpen(false)}
              >
                <X size={16} />
              </button>
            </header>

            <div className={styles.tournamentLibraryBody}>
              {isLoadingTournamentLibrary ? (
                <p className={styles.tournamentLibraryHint}>Loading tournaments...</p>
              ) : userTournaments.length === 0 ? (
                <p className={styles.tournamentLibraryHint}>No tournaments found for this user.</p>
              ) : (
                <ul className={styles.tournamentLibraryList}>
                  {userTournaments.map((tournament) => {
                    const setupState = setupStateByTournamentId[tournament.id];
                    const squadCount = countTournamentSquads(tournament.squad_times);
                    const tournamentStatusLabel = setupState?.is_published || tournament.is_public ? 'ACTIVE' : 'DRAFT';

                    return (
                      <li key={tournament.id} className={styles.tournamentLibraryItem}>
                        <article className={styles.tournamentCard}>
                          <div className={styles.tournamentCardMain}>
                            <span className={styles.tournamentIconWrap}>
                              <Trophy size={16} />
                            </span>
                            <div className={styles.tournamentCardText}>
                              <div className={styles.tournamentCardTitleRow}>
                                <strong>{tournament.name}</strong>
                                <span className={styles.tournamentStatusBadge}>{tournamentStatusLabel}</span>
                              </div>
                              <p>{tournament.location || 'Location not set'}</p>
                              <p>{formatTournamentCardDate(tournament.start_date, tournament.end_date)}</p>
                              <div className={styles.tournamentChipRow}>
                                <span>{squadCount} Squad{squadCount === 1 ? '' : 's'}</span>
                                <span>{tournament.entry_count ?? 0} Entries</span>
                                <span>{tournament.brackets_configured ? 'Brackets Configured' : 'Brackets Pending'}</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.tournamentCardActions}>
                            <button
                              type="button"
                              className={styles.secondaryAction}
                              onClick={() => { void handleLoadExistingTournament(tournament.id); }}
                              disabled={loadingTournamentId === tournament.id || deletingTournamentId === tournament.id}
                            >
                              <RotateCcw size={14} /> {loadingTournamentId === tournament.id ? 'Loading...' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              className={styles.dangerAction}
                              onClick={() => { void handleDeleteTournament(tournament.id); }}
                              disabled={loadingTournamentId === tournament.id || deletingTournamentId === tournament.id}
                            >
                              <Trash2 size={14} /> {deletingTournamentId === tournament.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      <ConfigDrawer
        open={Boolean(drawerState)}
        title={drawerState
          ? `${drawerState.id ? 'Edit' : 'Add'} ${drawerState.kind === 'fee' ? 'Add-on' : `${drawerState.kind.charAt(0).toUpperCase()}${drawerState.kind.slice(1)}`}`
          : ''}
        subtitle={drawerState?.kind === 'squad' && activeSquad
          ? `${activeSquad.dateIso || 'Date not set'} · ${activeSquad.startTime || 'Time not set'}`
          : drawerState ? ({ location: 'Squads & Availability', field: 'Registration Setup', question: 'Registration Setup', fee: 'Add-ons, Payments & Docs' } as Record<string, string>)[drawerState.kind] ?? '' : ''}
        onClose={() => setDrawerState(null)}
      >
        {drawerState?.kind === 'squad' && activeSquad && (
          <SquadEditor
            squad={activeSquad}
            locationName={details.bowlingCenter}
            onSave={handleSaveSquad}
            onCancel={() => setDrawerState(null)}
            onDelete={drawerState.id && squads.some((entry) => entry.id === drawerState.id) ? () => handleDeleteSquad(drawerState.id!) : undefined}
          />
        )}
        {drawerState?.kind === 'question' && activeQuestion && (
          <QuestionEditor question={activeQuestion} events={events} divisions={divisions} squads={squads} onSave={handleSaveQuestion} />
        )}
        {drawerState?.kind === 'field' && activeField && (
          <FieldEditor field={activeField} onSave={handleSaveField} />
        )}
        {drawerState?.kind === 'fee' && activeFee && (
          <FeeEditor fee={activeFee} events={events} divisions={divisions} squads={squads} onSave={handleSaveFee} />
        )}
        {drawerState?.kind === 'location' && activeLocation && (
          <LocationEditor location={activeLocation} onSave={handleSaveLocation} />
        )}
      </ConfigDrawer>
    </div>
  );
}
