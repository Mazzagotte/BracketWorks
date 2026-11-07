'use client';

import { ArrowLeft, ArrowRight, CalendarDays, CircleCheck, CircleDollarSign, Copy, EyeOff, Download, Eye, FileJson, GripVertical, Layers, MoreHorizontal, PencilLine, Plus, RotateCcw, Save, Trash2, Trophy, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';

import ConfigDrawer from './ConfigDrawer';
import { useConfirmation } from './useConfirmation';
import { registrationDateErrors } from '@/lib/registrationDates';
import { formatTournamentDateRange } from '@/lib/tournamentDates';
import { TOURNAMENT_SUMMARY_PRINT_CSS } from '@/lib/printTheme';
import PublishValidationSummary from './PublishValidationSummary';
import { getTournament, listMyOrganizerSetupStates, listMyTournaments, resolveTcVenue } from './organizerApi';
import { organizerRoutes } from './organizerRoutes';
import TournamentRegistrationForm from '../public/TournamentRegistrationForm';
import TournamentDetailsSection from './setup/TournamentDetailsSection';
import RulesDocumentsSection from './setup/RulesDocumentsSection';
import { setupSections } from './setupConfig';
import {
  countTournamentSquads,
  formatDateLabel,
  formatDateShort,
  formatFileSize,
  formatMoney,
  formatSquadTimeLabel,
  formatTournamentCardDate,
  inferLogoFileLabel,
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
} from './setupFactories';
import {
  getRequiredBowlerCountFromEvent,
  isRegistrationQuestionAnswered,
  normalizeRegistrationFieldKey,
  registrationFieldFallbackHelp,
} from './setupValidation';
import {
  buildDefaultDraft,
  buildOrganizerSetupPayload,
  buildTournamentPayload,
  builtInRegistrationFieldKeys,
  normalizeEventConfig,
  normalizeOrganizerDraft,
  normalizeSquadConfig,
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
  OrganizerSetupStateSummary,
  PaymentMode,
  TournamentDetails,
  TournamentTemplate,
  UserTournamentSummary,
} from './setupTypes';
import layout from './setup/setupLayout.module.css';
import StepHeader from './setup/StepHeader';
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  Notice,
  Page,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  SelectField,
  SideNav,
  StatGroup,
  capitalizeFirstLetter,
} from '@bracketworks/ui';

type DrawerState =
  | { kind: 'event'; id?: string }
  | { kind: 'division'; id?: string }
  | { kind: 'squad'; id?: string }
  | { kind: 'field'; id?: string }
  | { kind: 'question'; id?: string }
  | { kind: 'fee'; id?: string }
  | { kind: 'location'; id?: string }
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

const MAX_TOURNAMENT_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TOURNAMENT_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg']);

function validateTournamentLogoBlob(blob: Blob): void {
  if (!ALLOWED_TOURNAMENT_LOGO_TYPES.has(blob.type.toLowerCase())) {
    throw new Error('Tournament templates support PNG and JPG logos only.');
  }

  if (blob.size > MAX_TOURNAMENT_LOGO_BYTES) {
    throw new Error('Tournament logo is too large. Max size is 5MB.');
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to encode the tournament logo.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the tournament logo.'));
    reader.readAsDataURL(blob);
  });
}

async function createTournamentLogoFile(dataUrl: string, fileName: string): Promise<File> {
  if (!/^data:image\/(?:png|jpeg|jpg);base64,/i.test(dataUrl)) {
    throw new Error('The tournament template contains an invalid logo.');
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  validateTournamentLogoBlob(blob);
  const safeFileName = fileName.replace(/[\\/]/g, '_').trim() || 'tournament-logo';
  return new File([blob], safeFileName, { type: blob.type });
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

const QUESTION_TYPE_LABELS: Record<string, string> = {
  'short-text': 'Short text',
  'long-text': 'Long text',
  number: 'Number',
  'yes-no': 'Yes or no',
  dropdown: 'Dropdown',
  'multiple-choice': 'Multiple choice',
  checkbox: 'Checkboxes',
  date: 'Date',
};

function questionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS[type] ?? type;
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
  const { confirm, confirmationDialog } = useConfirmation();
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
  const currentSetupPayload = useCallback((detailsForSave: TournamentDetails) => buildOrganizerSetupPayload({
    details: detailsForSave, events, divisions, squads, fees, locations, questions, fields,
    hasRulesDocument, paymentMode, paymentProcessorConnected, paymentPayoutConfigured,
  }), [events, divisions, squads, fees, locations, questions, fields, hasRulesDocument, paymentMode, paymentProcessorConnected, paymentPayoutConfigured]);

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

      const draft = routeTournamentId === null
        ? buildDefaultDraft()
        : buildDefaultDraft();
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
        if (routeTournamentId === null) {
          await refreshTournamentLibrary(token);
          return;
        }

        const preferredTournamentId = getInitialTournamentId(routeTournamentId);
        if (!preferredTournamentId) {
          return;
        }

        const [selectedTournament, state] = await Promise.all([
          getTournament(token, preferredTournamentId),
          loadOrganizerSetupState(token, preferredTournamentId),
        ]);
        if (cancelled) {
          return;
        }

        setUserTournaments((previous) => [
          selectedTournament,
          ...previous.filter((entry) => entry.id !== selectedTournament.id),
        ]);
        void refreshTournamentLibrary(token).catch(() => undefined);

        const hydratedDraft = state
          ? normalizeOrganizerDraft({
            tournamentId: state.tournament_id,
            payload: state.payload,
          })
          : toDraftFromTournament(selectedTournament);
        applyDraft(hydratedDraft);
        setIsSetupPublished(Boolean(state?.is_published));

        if (selectedTournament?.logo_file_name) {
          setDetails((prev) => ({ ...prev, logoFileName: selectedTournament.logo_file_name || '' }));
        }

        if (selectedTournament?.has_logo) {
          const previewUrl = await fetchTournamentLogoBlobUrl(token, preferredTournamentId);
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
            setupPayload: currentSetupPayload(detailsForSave),
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
    currentSetupPayload,
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

    const shouldDelete = await confirm({
      title: 'Delete tournament?',
      message: 'Delete this tournament? This action cannot be undone.',
      confirmLabel: 'Delete tournament',
      tone: 'danger',
    });
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

  const handleExportTemplate = async () => {
    setSaveError(null);

    try {
      let logoBlob: Blob | null = pendingLogoFile;
      if (!logoBlob && logoPreviewUrl) {
        const response = await fetch(logoPreviewUrl);
        if (!response.ok) {
          throw new Error('Unable to load the tournament logo for export.');
        }
        logoBlob = await response.blob();
      }

      if (!logoBlob && persistedTournamentId && details.logoFileName) {
        const token = sessionStorage.getItem('access_token');
        if (!token) {
          throw new Error('Your session expired. Please sign in again.');
        }

        const response = await fetch(`/api/v1/tc/organizer-setup/${persistedTournamentId}/logo`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Unable to load the tournament logo (${response.status}).`);
        }
        logoBlob = await response.blob();
      }

      if (logoBlob) {
        validateTournamentLogoBlob(logoBlob);
      }

      const logoDataUrl = logoBlob ? await blobToDataUrl(logoBlob) : null;
      const template: TournamentTemplate = {
        format: 'tc-tournament-template',
        version: 1,
        exported_at: new Date().toISOString(),
        ...(logoDataUrl ? {
          logo: {
            file_name: details.logoFileName || 'tournament-logo',
            data_url: logoDataUrl,
          },
        } : {}),
        payload: buildOrganizerSetupPayload({
          details: { ...details, venueId: null, logoFileName: logoDataUrl ? details.logoFileName : '' },
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
          paymentPayoutConfigured,
        }),
      };
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(details.name.trim() || 'tournament').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tournament'}-template.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to export the tournament template.');
    }
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
<style>${TOURNAMENT_SUMMARY_PRINT_CSS}</style></head>
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

      if (parsed.logo && (typeof parsed.logo.data_url !== 'string' || typeof parsed.logo.file_name !== 'string')) {
        throw new Error('The tournament template contains an invalid logo.');
      }
      const importedLogoFile = parsed.logo
        ? await createTournamentLogoFile(parsed.logo.data_url, parsed.logo.file_name)
        : null;

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
          logoFileName: importedLogoFile?.name || '',
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
        paymentPayoutConfigured: imported.paymentPayoutConfigured,
      };

      applyDraft(remappedDraft);
      if (importedLogoFile) {
        setPendingLogoFile(importedLogoFile);
        setPreviewUrl(URL.createObjectURL(importedLogoFile));
      } else {
        setPreviewUrl(null);
      }
      setIsSetupPublished(false);
      setAutosaveEnabled(false);
      setAutosaveSavedAt(null);
      setDraftSavedAt(null);
      setPublishedAt(null);
      setSaveError(null);
      setAutosaveError(null);
      setActiveSection('tournament-details');

      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
      if (!token) {
        throw new Error('Your session expired. Please sign in again.');
      }

      setIsSavingDraft(true);
      try {
        const detailsForSave = await resolveVenueForPersistence(token, remappedDraft.details);
        const saved = await saveTournamentRecord({
          token,
          payload: buildTournamentPayload(detailsForSave, remappedDraft.squads, false),
          tournamentId: null,
        });
        let detailsWithLogo = detailsForSave;
        if (importedLogoFile) {
          const logoResult = await uploadTournamentLogo({
            token,
            tournamentId: saved.id,
            file: importedLogoFile,
          });
          detailsWithLogo = {
            ...detailsForSave,
            logoFileName: logoResult.logo_file_name || importedLogoFile.name,
          };
          setPendingLogoFile(null);
        }
        await saveOrganizerSetupState({
          token,
          tournamentId: saved.id,
          payload: buildOrganizerSetupPayload({
            details: detailsWithLogo,
            events: remappedDraft.events,
            divisions: remappedDraft.divisions,
            squads: remappedDraft.squads,
            fees: remappedDraft.fees,
            locations: remappedDraft.locations,
            questions: remappedDraft.questions,
            fields: remappedDraft.fields,
            hasRulesDocument: false,
            paymentMode: remappedDraft.paymentMode,
            paymentProcessorConnected: false,
            paymentPayoutConfigured: remappedDraft.paymentPayoutConfigured,
          }),
          isPublished: false,
        });

        applyDraft({ ...remappedDraft, details: detailsWithLogo, tournamentId: saved.id });
        setAutosaveEnabled(true);
        setDraftSavedAt(new Date().toISOString());
        setAutosaveSavedAt(new Date().toISOString());
        autosaveFingerprintRef.current = null;
        await refreshTournamentLibrary(token);
      } finally {
        setIsSavingDraft(false);
      }
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
    }
    for (const [field, message] of Object.entries(registrationDateErrors(details))) {
      issues.push({ id: `details-date-${field}`, section: 'tournament-details', severity: 'error', message });
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

  async function resolveVenueForPersistence(token: string, sourceDetails: TournamentDetails = details): Promise<TournamentDetails> {
    if (sourceDetails.venueId || !sourceDetails.bowlingCenter.trim()) {
      return sourceDetails;
    }

    const shouldResolve = Boolean(
      sourceDetails.venueAddressLine1.trim()
      || sourceDetails.city.trim()
      || sourceDetails.state.trim()
      || sourceDetails.venueExternalPlaceId.trim(),
    );
    if (!shouldResolve) {
      return sourceDetails;
    }

    const resolvedVenue = await resolveTcVenue(token, {
      name: sourceDetails.bowlingCenter,
      address_line_1: sourceDetails.venueAddressLine1 || undefined,
      address_line_2: sourceDetails.venueAddressLine2 || undefined,
      city: sourceDetails.city || undefined,
      state: sourceDetails.state || undefined,
      zip: sourceDetails.venueZip || undefined,
      country: sourceDetails.venueCountry || undefined,
      latitude: sourceDetails.venueLatitude,
      longitude: sourceDetails.venueLongitude,
      external_provider: sourceDetails.venueExternalProvider || undefined,
      external_place_id: sourceDetails.venueExternalPlaceId || undefined,
    });

    const nextDetails: TournamentDetails = {
      ...sourceDetails,
      venueId: typeof resolvedVenue.id === 'number' ? resolvedVenue.id : null,
      bowlingCenter: resolvedVenue.name || sourceDetails.bowlingCenter,
      venueAddressLine1: resolvedVenue.address_line_1 || sourceDetails.venueAddressLine1,
      venueAddressLine2: resolvedVenue.address_line_2 || sourceDetails.venueAddressLine2,
      city: resolvedVenue.city || sourceDetails.city,
      state: resolvedVenue.state || sourceDetails.state,
      venueZip: resolvedVenue.zip || sourceDetails.venueZip,
      venueCountry: resolvedVenue.country || sourceDetails.venueCountry,
      venueLatitude: resolvedVenue.latitude ?? sourceDetails.venueLatitude,
      venueLongitude: resolvedVenue.longitude ?? sourceDetails.venueLongitude,
      venueExternalProvider: resolvedVenue.external_provider || sourceDetails.venueExternalProvider,
      venueExternalPlaceId: resolvedVenue.external_place_id || sourceDetails.venueExternalPlaceId,
    };

    if (sourceDetails === details) {
      setDetails(nextDetails);
    }
    return nextDetails;
  }

  const handleSaveDraft = async () => {
    const dateErrors = registrationDateErrors(details);
    if (Object.keys(dateErrors).length) {
      setSaveError(Object.values(dateErrors).join(' '));
      setActiveSection('tournament-details');
      return;
    }
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
        setupPayload: currentSetupPayload(detailsForSave),
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

      if (!persistedTournamentId) {
        await saveOrganizerSetupState({
          token,
          tournamentId: saved.id,
          payload: currentSetupPayload(detailsForSave),
          isPublished: false,
        });
      }

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
        setupPayload: currentSetupPayload(detailsForSave),
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
  const registrationAfterEndInvalid = hasRegistrationWindow
    && Boolean(details.endDateIso)
    && details.registrationCloseIso > details.endDateIso;

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

  const selectedPreviewEvent = useMemo(
    () => enabledEvents.find((event) => event.id === signupPreviewForm.eventId) ?? eventsForSelectedPreviewSquad[0] ?? null,
    [enabledEvents, eventsForSelectedPreviewSquad, signupPreviewForm.eventId],
  );

  const requiredPreviewBowlerCount = useMemo(
    () => getRequiredBowlerCountFromEvent(selectedPreviewEvent),
    [selectedPreviewEvent],
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

      const selectedEvent = enabledEvents.find((event) => event.id === next.eventId) ?? null;
      const requiredCount = getRequiredBowlerCountFromEvent(selectedEvent);

      if (next.bowlers.length !== requiredCount) {
        const nextBowlers = Array.from({ length: requiredCount }, (_, index) => next.bowlers[index] ?? {});
        const nextAnswers = Array.from({ length: requiredCount }, (_, index) => next.bowlerQuestionAnswers[index] ?? {});
        next.bowlers = nextBowlers;
        next.bowlerQuestionAnswers = nextAnswers;
      }

      return next;
    });
  }, [enabledDivisions, enabledEvents, enabledSquads, signupPreviewForm.eventId]);

  const handleSignupPreviewSubmit = async () => {
    if (!signupPreviewForm.squadId) {
      setSignupPreviewSubmitMessage('Please select a squad first.');
      return;
    }

    if (signupPreviewForm.bowlers.length !== requiredPreviewBowlerCount) {
      setSignupPreviewSubmitMessage(`This event requires ${requiredPreviewBowlerCount} bowler form${requiredPreviewBowlerCount === 1 ? '' : 's'}.`);
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
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
    });
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!await confirm({
      title: 'Delete event?', message: 'Delete this event? Its division, squad, fee, and question references will also be removed.',
      confirmLabel: 'Delete event', tone: 'danger',
    })) {
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
    void persistOrganizerChanges({
      divisions: nextDivisions,
    });
  };

  const handleDeleteDivision = async (divisionId: string) => {
    if (!await confirm({
      title: 'Delete division?', message: 'Delete this division? Its event, fee, and question references will also be removed.',
      confirmLabel: 'Delete division', tone: 'danger',
    })) {
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

  const handleDeleteSquad = async (squadId: string) => {
    if (!await confirm({
      title: 'Delete squad?', message: 'Delete this squad? Existing event, fee, and question references will also be removed.',
      confirmLabel: 'Delete squad', tone: 'danger',
    })) return;
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

  const handleDeleteField = async (fieldId: string) => {
    const targetField = fields.find((entry) => entry.id === fieldId);
    if (!targetField) {
      return;
    }

    if (!await confirm({
      title: 'Remove registration field?',
      message: `Remove "${targetField.customLabel || targetField.label}" from the registration form? Built-in fields can be enabled again later.`,
      confirmLabel: 'Remove field', tone: 'danger',
    })) {
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

  const selectedEvent = selectedEventId ? events.find((entry) => entry.id === selectedEventId) ?? null : null;
  const selectedDivision = selectedDivisionId ? divisions.find((entry) => entry.id === selectedDivisionId) ?? null : null;
  const activeIndex = setupSections.findIndex((section) => section.key === activeSection);
  const activeLabel = setupSections[activeIndex]?.label ?? '';
  const previousSection = activeIndex > 0 ? setupSections[activeIndex - 1] : null;
  const nextSection = activeIndex < setupSections.length - 1 ? setupSections[activeIndex + 1] : null;
  const blockingIssueCount = validationIssues.filter((issue) => issue.severity === 'error').length;
  const isLive = Boolean(publishedAt) || isSetupPublished;
  const builderState = isLive
    ? { label: 'Published', tone: 'success' as const }
    : completion === 100
      ? { label: 'Ready to publish', tone: 'info' as const }
      : blockingIssueCount > 0
        ? { label: 'Needs attention', tone: 'warning' as const }
        : { label: 'Draft', tone: 'neutral' as const };

  const navMeta = (key: SetupSectionKey): string | undefined => {
    if (key === 'review-publish') return blockingIssueCount > 0 ? `${blockingIssueCount} blocking` : 'Ready';
    const issueCount = validationIssues.filter((issue) => issue.section === key).length;
    if (issueCount > 0) return `${issueCount} issue${issueCount === 1 ? '' : 's'}`;
    if (statusBySection[key] === 'not-used') return 'Not used';
    if (statusBySection[key] === 'complete') return 'Ready';
    return key === 'squads-availability' || key === 'fees-payments-documents' ? 'Optional' : undefined;
  };

  return (
    <Page>
      <PageHeader
        overline="Tournament setup"
        title={details.name.trim() || 'Untitled tournament'}
        badge={<Badge tone={builderState.tone}>{builderState.label}</Badge>}
        description={`Step ${activeIndex + 1} of ${setupSections.length}: ${activeLabel} · ${autosaveStatusLabel}`}
        actions={(
          <>
            <input
              ref={templateInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => { void handleImportTemplate(event); }}
            />
            <Menu triggerLabel="More setup actions" trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
              <MenuItem icon={<RotateCcw size={ICON_SIZE.md} />} onSelect={() => { void handleOpenTournamentModal(); }} disabled={isLoadingTournamentLibrary}>
                {isLoadingTournamentLibrary ? 'Loading...' : 'Load tournament'}
              </MenuItem>
              <MenuItem icon={<Upload size={ICON_SIZE.md} />} onSelect={() => templateInputRef.current?.click()}>Import template</MenuItem>
              <MenuItem icon={<FileJson size={ICON_SIZE.md} />} onSelect={handleExportTemplate}>Export template</MenuItem>
              <MenuItem icon={<Download size={ICON_SIZE.md} />} onSelect={handleExportReport}>Download summary</MenuItem>
            </Menu>
            <Button variant="secondary" icon={<Save size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => { void handleSaveDraft(); }} disabled={isSavingDraft || isPublishing}>
              {isSavingDraft ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="primary" onClick={() => setActiveSection('review-publish')}>
              {isLive ? 'Publish changes' : 'Review and publish'}
            </Button>
          </>
        )}
      />

      {saveError ? <Notice tone="danger" role="alert">{saveError}</Notice> : null}
      {autosaveError ? <Notice tone="warning" role="status">{autosaveError}</Notice> : null}
      {publishedAt ? <Notice tone="success" role="status">Tournament published {new Date(publishedAt).toLocaleString()}.</Notice> : null}
      {draftSavedAt && !publishedAt ? <Notice tone="info" role="status">Draft saved {new Date(draftSavedAt).toLocaleString()}.</Notice> : null}

      <div className={layout.layout}>
        <aside className={layout.nav}>
          <ProgressBar
            value={completedSectionCount}
            max={setupSections.length}
            label="Tournament setup progress"
            valueText={`${completedSectionCount} of ${setupSections.length} sections ready`}
          />
          <SelectField
            label="Setup step"
            className={layout.stepPicker}
            value={activeSection}
            onChange={(event) => setActiveSection(event.target.value as SetupSectionKey)}
          >
            {setupSections.map((section, index) => (
              <option key={section.key} value={section.key}>{`${index + 1}. ${section.label}`}</option>
            ))}
          </SelectField>
          <SideNav
            label="Setup steps"
            className={layout.stepList}
            activeId={activeSection}
            onSelect={(id) => setActiveSection(id as SetupSectionKey)}
            sections={[
              {
                heading: 'Setup',
                items: setupSections.filter((section) => section.key !== 'review-publish').map((section) => ({ id: section.key, label: section.label, meta: navMeta(section.key) })),
              },
              {
                heading: 'Review',
                items: setupSections.filter((section) => section.key === 'review-publish').map((section) => ({ id: section.key, label: section.label, meta: navMeta(section.key) })),
              },
            ]}
          />
        </aside>

        <div className={layout.content}>
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
              registrationAfterEndInvalid={registrationAfterEndInvalid}
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
            <>
              <StepHeader
                title="Events and divisions"
                description="Define registration offerings and optional eligibility groups."
                status={statusBySection['events-divisions']}
              />
              <div className={layout.cardGrid}>
                <Card aria-label="Events">
                  <CardHeader
                    title="Events"
                    description={`${events.length} event${events.length === 1 ? '' : 's'}. Define what bowlers can enter.`}
                    headingLevel="h3"
                    actions={(
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />}
                        onClick={() => {
                          const next = emptyEvent(events.length + 1);
                          const nextEvents = [...events, next];
                          setEvents(nextEvents);
                          setSelectedEventId(next.id);
                          void persistOrganizerChanges({ events: nextEvents });
                        }}
                      >
                        Add event
                      </Button>
                    )}
                  />
                  {events.length === 0 ? (
                    <EmptyState
                      icon={<Trophy size={ICON_SIZE['2xl']} aria-hidden="true" />}
                      title="No events yet"
                      description="Add an event to define what bowlers can register for."
                    />
                  ) : (
                    <ul className={layout.rows}>
                      {events.map((ev) => {
                        const squadCount = ev.connectedSquadIds.length;
                        const eventStatus = !ev.name.trim()
                          ? { label: 'Needs name', tone: 'warning' as const }
                          : ev.requireSquad && squadCount === 0
                            ? { label: 'Needs squads', tone: 'warning' as const }
                            : ev.requireDivision && ev.connectedDivisionIds.length === 0
                              ? { label: 'Needs divisions', tone: 'warning' as const }
                              : ev.enabled ? { label: 'Ready', tone: 'success' as const } : { label: 'Draft', tone: 'neutral' as const };
                        const name = ev.name || 'Untitled event';
                        return (
                          <li key={ev.id} className={layout.row}>
                            <div className={layout.rowText}>
                              <span className={layout.rowTitle}>{name}<Badge tone={eventStatus.tone}>{eventStatus.label}</Badge></span>
                              <span className={layout.rowMeta}>
                                {[
                                  ev.minPlayers === ev.maxPlayers ? `${ev.minPlayers} bowler${ev.minPlayers !== 1 ? 's' : ''}` : `${ev.minPlayers}-${ev.maxPlayers} bowlers`,
                                  ev.scoring.charAt(0).toUpperCase() + ev.scoring.slice(1),
                                  ev.requireDivision ? 'Division required' : 'Division optional',
                                  `${squadCount} squad${squadCount !== 1 ? 's' : ''}`,
                                  `${formatMoney(ev.entryFeeCents)} entry fee`,
                                ].join(' · ')}
                              </span>
                            </div>
                            <div className={layout.rowActions}>
                              <Button size="sm" variant="secondary" onClick={() => setSelectedEventId(ev.id)} aria-label={`Edit ${name}`}>Edit</Button>
                              <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                                <MenuItem icon={<Copy size={ICON_SIZE.md} />} onSelect={() => handleDuplicateEvent(ev.id)}>Duplicate</MenuItem>
                                <MenuDivider />
                                <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => handleDeleteEvent(ev.id)}>Delete event</MenuItem>
                              </Menu>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                <Card aria-label="Divisions">
                  <CardHeader
                    title="Divisions"
                    description={`${divisions.length} division${divisions.length === 1 ? '' : 's'}. Optional eligibility groups used by events.`}
                    headingLevel="h3"
                    actions={(
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />}
                        onClick={() => {
                          const next: DivisionConfig = emptyDivision();
                          const nextDivisions = [...divisions, next];
                          setDivisions(nextDivisions);
                          setSelectedDivisionId(next.id);
                          void persistOrganizerChanges({ divisions: nextDivisions });
                        }}
                      >
                        Add division
                      </Button>
                    )}
                  />
                  {divisions.length === 0 ? (
                    <EmptyState
                      icon={<Layers size={ICON_SIZE['2xl']} aria-hidden="true" />}
                      title="No divisions needed"
                      description="Divisions are optional. Add one when eligibility or scoring groups differ."
                    />
                  ) : (
                    <ul className={layout.rows}>
                      {divisions.map((div) => {
                        const avgLabel = div.minAverage !== null && div.maxAverage !== null
                          ? `Average ${div.minAverage}-${div.maxAverage}`
                          : div.minAverage !== null
                            ? `Average ${div.minAverage} and up`
                            : div.maxAverage !== null
                              ? `Average ${div.maxAverage} and below`
                              : 'No average limit';
                        const usedByNames = events.filter((ev) => ev.connectedDivisionIds.includes(div.id)).map((ev) => ev.name).filter(Boolean);
                        const divisionStatus = !div.name.trim()
                          ? { label: 'Needs name', tone: 'warning' as const }
                          : usedByNames.length > 0 ? { label: 'In use', tone: 'success' as const } : { label: 'Not used', tone: 'neutral' as const };
                        const name = div.name || 'Untitled division';
                        return (
                          <li key={div.id} className={layout.row}>
                            <div className={layout.rowText}>
                              <span className={layout.rowTitle}>{name}<Badge tone={divisionStatus.tone}>{divisionStatus.label}</Badge></span>
                              <span className={layout.rowMeta}>{avgLabel} · {div.mode.charAt(0).toUpperCase() + div.mode.slice(1)}</span>
                              {usedByNames.length > 0 ? <span className={layout.rowMeta}>Used by {usedByNames.join(', ')}</span> : null}
                            </div>
                            <div className={layout.rowActions}>
                              <Button size="sm" variant="secondary" onClick={() => setSelectedDivisionId(div.id)} aria-label={`Edit ${name}`}>Edit</Button>
                              <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                                <MenuItem icon={<Copy size={ICON_SIZE.md} />} onSelect={() => handleDuplicateDivision(div.id)}>Duplicate</MenuItem>
                                <MenuDivider />
                                <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => handleDeleteDivision(div.id)}>Delete division</MenuItem>
                              </Menu>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}

          <Modal
            open={Boolean(selectedEvent)}
            onClose={() => setSelectedEventId(null)}
            title="Event details"
            description={selectedEvent?.name || 'New event'}
            size="lg"
            closeLabel="Close event editor"
          >
            {selectedEvent ? (
              <InlineEventEditor
                key={selectedEvent.id}
                event={selectedEvent}
                divisions={divisions}
                squads={squads}
                onSave={(updated) => {
                  handleSaveEvent(updated);
                  setSelectedEventId(null);
                }}
                onCancel={() => setSelectedEventId(null)}
                onDelete={() => handleDeleteEvent(selectedEvent.id)}
              />
            ) : null}
          </Modal>

          <Modal
            open={Boolean(selectedDivision)}
            onClose={() => setSelectedDivisionId(null)}
            title="Division details"
            description={selectedDivision?.name || 'New division'}
            size="lg"
            closeLabel="Close division editor"
          >
            {selectedDivision ? (
              <InlineDivisionEditor
                key={selectedDivision.id}
                division={selectedDivision}
                usedByEventNames={events.filter((event) => event.connectedDivisionIds.includes(selectedDivision.id)).map((event) => event.name || 'Untitled event')}
                onSave={(updated) => {
                  handleSaveDivision(updated);
                  setSelectedDivisionId(null);
                }}
                onCancel={() => setSelectedDivisionId(null)}
                onDelete={() => handleDeleteDivision(selectedDivision.id)}
              />
            ) : null}
          </Modal>

          {activeSection === 'squads-availability' && (
            <>
              <StepHeader
                title="Squads and availability"
                description="Optional bowling times, capacity, and registration availability."
                status={statusBySection['squads-availability']}
                actions={(
                  <>
                    <Button variant="secondary" icon={<Eye size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setActiveSection('registration-setup')}>
                      Preview registration
                    </Button>
                    <Button variant="secondary" icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setDrawerState({ kind: 'squad' })}>
                      Add squad
                    </Button>
                  </>
                )}
              />

              {squads.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<CalendarDays size={ICON_SIZE['2xl']} aria-hidden="true" />}
                    title="No squads yet"
                    description="Squads are optional. Add them when your tournament offers specific bowling times or needs capacity limits."
                    action={(
                      <Button variant="primary" icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setDrawerState({ kind: 'squad' })}>
                        Add first squad
                      </Button>
                    )}
                  />
                </Card>
              ) : (
                <>
                  <StatGroup
                    label="Squad totals"
                    items={[
                      { label: 'Squads', value: String(squads.length) },
                      { label: 'Dates', value: String(groupsByDate.length) },
                      { label: 'Capacity', value: String(totalSquadCapacity), detail: 'Bowler spots' },
                      { label: 'Filled', value: String(totalRegisteredSpots), detail: `${fillPercent}% full` },
                    ]}
                  />

                  {squadGroups.map((group) => {
                    const groupCapacity = group.squads.reduce((sum, squad) => sum + squad.capacity, 0);
                    const groupFilled = group.squads.reduce((sum, squad) => sum + squad.registeredCount, 0);
                    return (
                      <Card key={group.key} padding="flush" aria-label={group.label}>
                        <CardHeader
                          title={group.label}
                          description={`${group.squads.length} squad${group.squads.length === 1 ? '' : 's'} · ${groupCapacity} capacity · ${groupFilled} filled · ${details.bowlingCenter || 'Location to be decided'}`}
                          headingLevel="h3"
                        />
                        <DataTable caption={`Squads on ${group.label}`} className={layout.nowrapTable}>
                          <thead>
                            <tr>
                              <th scope="col">Squad</th>
                              <th scope="col">Start</th>
                              <th scope="col">Check-in</th>
                              <th scope="col" data-align="right">Capacity</th>
                              <th scope="col" data-align="right">Registered</th>
                              <th scope="col" data-align="right">Spots left</th>
                              <th scope="col">Status</th>
                              <th scope="col"><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.squads.map((squad) => {
                              const fillRate = squad.capacity > 0 ? squad.registeredCount / squad.capacity : 0;
                              const availability = squad.registeredCount >= squad.capacity
                                ? (squad.waitlistEnabled ? { label: 'Waitlist open', tone: 'warning' as const } : { label: 'Full', tone: 'danger' as const })
                                : fillRate >= 0.75
                                  ? { label: 'Nearly full', tone: 'warning' as const }
                                  : { label: 'Available', tone: 'success' as const };
                              return (
                                <tr key={squad.id}>
                                  <td className={layout.strongCell}>{squad.name}</td>
                                  <td>{formatSquadTimeLabel(squad.startTime)}</td>
                                  <td data-tone="secondary">{formatSquadTimeLabel(squad.checkInTime)}</td>
                                  <td data-align="right">{squad.capacity}</td>
                                  <td data-align="right">{squad.registeredCount}</td>
                                  <td data-align="right">{Math.max(squad.capacity - squad.registeredCount, 0)}</td>
                                  <td><Badge tone={availability.tone}>{availability.label}</Badge></td>
                                  <td data-align="right">
                                    <Button size="sm" variant="secondary" onClick={() => setDrawerState({ kind: 'squad', id: squad.id })} aria-label={`Edit ${squad.name}`}>
                                      Edit
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </DataTable>
                      </Card>
                    );
                  })}
                </>
              )}
            </>
          )}

          {activeSection === 'registration-setup' && (
            <>
              <StepHeader
                title="Registration setup"
                description="Choose what bowlers are asked when they register. Drag rows to change the order."
                status={statusBySection['registration-setup']}
                actions={(
                  <Button variant="secondary" icon={<Eye size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setShowRegistrationPreview(true)}>
                    Preview registration
                  </Button>
                )}
              />
              <div className={layout.split}>
                <div className={layout.content}>
                  <Card aria-label="Registration fields">
                    <CardHeader
                      title="Registration fields"
                      description={`${askedFields.length} field${askedFields.length === 1 ? '' : 's'} asked during registration.`}
                      headingLevel="h3"
                      actions={(
                        <Button size="sm" variant="secondary" icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setDrawerState({ kind: 'field' })}>
                          Add field
                        </Button>
                      )}
                    />
                    <ul className={layout.rows}>
                      {askedFields.map((field) => {
                        const name = field.customLabel || field.label;
                        const canHide = !['first_name', 'last_name'].includes(field.key) && builtInRegistrationFieldKeys.has(field.key);
                        const canDelete = !builtInRegistrationFieldKeys.has(field.key);
                        return (
                          <li
                            key={field.id}
                            className={`${layout.row} ${layout.draggable} ${draggingFieldId === field.id ? layout.dragging : ''} ${dragOverFieldId === field.id && draggingFieldId && draggingFieldId !== field.id ? layout.dragTarget : ''}`}
                            draggable
                            onDragStart={(event) => handleFieldDragStart(field.id, event)}
                            onDragOver={(event) => handleFieldDragOver(field.id, event)}
                            onDrop={() => handleFieldDrop(field.id)}
                            onDragEnd={handleFieldDragEnd}
                          >
                            <GripVertical className={layout.grip} size={ICON_SIZE.md} aria-hidden="true" />
                            <div className={layout.rowText}>
                              <span className={layout.rowTitle}>{name}</span>
                              <span className={layout.rowMeta}>{field.helpText || registrationFieldFallbackHelp(field)}</span>
                            </div>
                            <div className={layout.rowActions}>
                              <SelectField
                                label={`Requirement setting for ${name}`}
                                hideLabel
                                className={layout.compactSelect}
                                value={field.mode}
                                onChange={(event) => handleSetFieldMode(field.id, event.target.value as RegistrationFieldConfig['mode'])}
                              >
                                <option value="required">Required</option>
                                <option value="optional">Optional</option>
                                {!['first_name', 'last_name'].includes(field.key) ? <option value="dont-ask">Don&apos;t ask</option> : null}
                              </SelectField>
                              <Button size="sm" variant="secondary" onClick={() => setDrawerState({ kind: 'field', id: field.id })} aria-label={`Edit ${field.label}`}>Edit</Button>
                              {canHide || canDelete ? (
                                <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                                  {canHide ? (
                                    <MenuItem icon={<EyeOff size={ICON_SIZE.md} />} onSelect={() => handleSetFieldMode(field.id, 'dont-ask')} aria-label={`Hide ${name}`}>
                                      Stop asking
                                    </MenuItem>
                                  ) : (
                                    <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => handleDeleteField(field.id)} aria-label={`Delete ${name}`}>
                                      Delete field
                                    </MenuItem>
                                  )}
                                </Menu>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {hiddenFields.length > 0 ? (
                      <>
                        <CardDivider />
                        <div className={layout.groupHeader}>
                          <h4 className={layout.subsectionTitle}>Not asked ({hiddenFields.length})</h4>
                          <Button size="sm" variant="ghost" onClick={() => setShowHiddenRegistrationFields((current) => !current)} aria-expanded={showHiddenRegistrationFields}>
                            {showHiddenRegistrationFields ? 'Hide list' : 'Show list'}
                          </Button>
                        </div>
                        {showHiddenRegistrationFields ? (
                          <ul className={layout.rows}>
                            {hiddenFields.map((field) => {
                              const name = field.customLabel || field.label;
                              return (
                                <li key={field.id} className={layout.row}>
                                  <div className={layout.rowText}>
                                    <span className={layout.rowTitle}>{name}</span>
                                    <span className={layout.rowMeta}>Hidden from bowlers.</span>
                                  </div>
                                  <div className={layout.rowActions}>
                                    <Button size="sm" variant="secondary" onClick={() => handleSetFieldMode(field.id, 'optional')} aria-label={`Ask ${name}`}>Ask</Button>
                                    <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                                      <MenuItem onSelect={() => handleSetFieldMode(field.id, 'required')} aria-label={`Ask ${name} as required`}>Ask as required</MenuItem>
                                      <MenuItem icon={<PencilLine size={ICON_SIZE.md} />} onSelect={() => setDrawerState({ kind: 'field', id: field.id })} aria-label={`Edit ${field.label}`}>Edit</MenuItem>
                                    </Menu>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                  </Card>

                  <Card aria-label="Custom questions">
                    <CardHeader
                      title="Custom questions"
                      description={`${enabledQuestions.length} question${enabledQuestions.length === 1 ? '' : 's'} asked. Collect only what this tournament needs.`}
                      headingLevel="h3"
                      actions={(
                        <Button size="sm" variant="secondary" icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setDrawerState({ kind: 'question' })}>
                          Add question
                        </Button>
                      )}
                    />
                    {enabledQuestions.length === 0 ? (
                      <p className={layout.helper}>No custom questions. The standard registration fields may be all you need.</p>
                    ) : (
                      <ul className={layout.rows}>
                        {enabledQuestions.map((question) => {
                          const name = question.label || 'Untitled question';
                          return (
                            <li
                              key={question.id}
                              className={`${layout.row} ${layout.draggable} ${draggingQuestionId === question.id ? layout.dragging : ''} ${dragOverQuestionId === question.id && draggingQuestionId && draggingQuestionId !== question.id ? layout.dragTarget : ''}`}
                              draggable
                              onDragStart={(event) => handleQuestionDragStart(question.id, event)}
                              onDragOver={(event) => handleQuestionDragOver(question.id, event)}
                              onDrop={() => handleQuestionDrop(question.id)}
                              onDragEnd={handleQuestionDragEnd}
                            >
                              <GripVertical className={layout.grip} size={ICON_SIZE.md} aria-hidden="true" />
                              <div className={layout.rowText}>
                                <span className={layout.rowTitle}>{name}</span>
                                <span className={layout.rowMeta}>
                                  {[questionTypeLabel(question.type), question.scope.all ? 'All registrations' : 'Scoped'].join(' · ')}
                                </span>
                              </div>
                              <div className={layout.rowActions}>
                                <SelectField
                                  label={`Requirement setting for ${name}`}
                                  hideLabel
                                  className={layout.compactSelect}
                                  value={question.required ? 'required' : 'optional'}
                                  onChange={(event) => (event.target.value === 'dont-ask'
                                    ? handleSetQuestionEnabled(question.id, false)
                                    : handleSetQuestionRequired(question.id, event.target.value === 'required'))}
                                >
                                  <option value="required">Required</option>
                                  <option value="optional">Optional</option>
                                  <option value="dont-ask">Don&apos;t ask</option>
                                </SelectField>
                                <Button size="sm" variant="secondary" onClick={() => setDrawerState({ kind: 'question', id: question.id })} aria-label={`Edit ${name}`}>Edit</Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {disabledQuestions.length > 0 ? (
                      <>
                        <CardDivider />
                        <h4 className={layout.subsectionTitle}>Not asked ({disabledQuestions.length})</h4>
                        <ul className={layout.rows}>
                          {disabledQuestions.map((question) => {
                            const name = question.label || 'Untitled question';
                            return (
                              <li key={question.id} className={layout.row}>
                                <div className={layout.rowText}>
                                  <span className={layout.rowTitle}>{name}</span>
                                  <span className={layout.rowMeta}>{questionTypeLabel(question.type)} · {question.required ? 'Required when asked' : 'Optional when asked'}</span>
                                </div>
                                <div className={layout.rowActions}>
                                  <Button size="sm" variant="secondary" onClick={() => handleSetQuestionEnabled(question.id, true)}>Ask</Button>
                                  <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                                    <MenuItem icon={<PencilLine size={ICON_SIZE.md} />} onSelect={() => setDrawerState({ kind: 'question', id: question.id })}>Edit</MenuItem>
                                  </Menu>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : null}
                  </Card>
                </div>

                <Card aria-label="Live registration preview" className={layout.previewCard}>
                  <TournamentRegistrationForm
                    tournamentName={details.name || 'Tournament name'}
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
                    footerHint="Live preview. Changes appear as you edit."
                    presentation="inline"
                  />
                </Card>
              </div>
            </>
          )}

          {activeSection === 'fees-payments-documents' && (
            <>
              <StepHeader
                title="Add-ons, payments, and documents"
                description="Optional extras, how payment is collected, and the rules bowlers can read before registering."
                status={statusBySection['fees-payments-documents']}
              />
              <div className={layout.cardGrid}>
                <Card aria-label="Add-ons and fee adjustments">
                  <CardHeader
                    title="Add-ons and fee adjustments"
                    description="Base entry fees are set in Events and divisions. Use add-ons for optional extras."
                    headingLevel="h3"
                    actions={(
                      <Button size="sm" variant="secondary" icon={<Plus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setDrawerState({ kind: 'fee' })}>
                        Add add-on
                      </Button>
                    )}
                  />
                  {addOnFees.length === 0 ? (
                    <EmptyState
                      icon={<CircleDollarSign size={ICON_SIZE['2xl']} aria-hidden="true" />}
                      title="No add-ons"
                      description="Add-ons are optional, for example brackets, donations, or merchandise."
                    />
                  ) : (
                    <ul className={layout.rows}>
                      {addOnFees.map((fee) => {
                        const name = fee.name || 'Untitled add-on';
                        return (
                          <li key={fee.id} className={layout.row}>
                            <div className={layout.rowText}>
                              <span className={layout.rowTitle}>{name}</span>
                              <span className={layout.rowMeta}>Optional during registration</span>
                            </div>
                            <div className={layout.rowActions}>
                              <span className={layout.amount}>{formatMoney(fee.amountCents)}</span>
                              <Button size="sm" variant="secondary" onClick={() => setDrawerState({ kind: 'fee', id: fee.id })} aria-label={`Edit ${name}`}>Edit</Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                <Card aria-label="Payment collection">
                  <CardHeader
                    title="Payment collection"
                    description="Bowlers register without paying online. Tournament staff collect entry fees at check-in."
                    headingLevel="h3"
                    actions={<Badge tone="neutral">Cash at the venue</Badge>}
                  />
                  <p className={layout.bodyText}>No payment processor is needed and there are no online transaction fees.</p>
                </Card>
              </div>

              <RulesDocumentsSection
                key={persistedTournamentId ?? 'new'}
                tournamentId={persistedTournamentId}
                rulesText={details.rulesText}
                onRulesTextChange={(rulesText) => setDetails((current) => ({ ...current, rulesText }))}
                onHasRulesDocumentChange={setHasRulesDocument}
              />
            </>
          )}

          {showRegistrationPreview ? (
            <TournamentRegistrationForm
              rulesText={details.rulesText}
              tournamentName={details.name || 'Tournament name'}
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
              onSubmit={() => { void handleSignupPreviewSubmit(); }}
              onClose={() => setShowRegistrationPreview(false)}
              footerHint="Preview only. No registration will be submitted."
            />
          ) : null}

          {activeSection === 'review-publish' && (
            <>
              <StepHeader
                title="Review and publish"
                description="Run a final check and resolve anything that could prevent registration."
                status={statusBySection['review-publish']}
                actions={(
                  <Button variant="secondary" icon={<RotateCcw size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setLastPreflightRunAt(new Date().toISOString())}>
                    Run checks again
                  </Button>
                )}
              />
              <PublishValidationSummary
                issues={validationIssues}
                sections={setupSections}
                onNavigate={(section) => setActiveSection(section)}
                checkedAt={lastPreflightRunAt}
              />

              <div className={layout.cardGrid}>
                <Card aria-label="Visibility">
                  <CardHeader title="Visibility" description={visibilitySummary} headingLevel="h3" />
                  <SegmentedControl
                    label="Tournament visibility"
                    value={details.visibility}
                    onChange={(visibility) => setDetails((prev) => ({ ...prev, visibility }))}
                    options={[
                      { value: 'public', label: 'Public' },
                      { value: 'unlisted', label: 'Unlisted' },
                      { value: 'private', label: 'Private' },
                    ]}
                  />
                </Card>

                <Card aria-label="Launch summary">
                  <CardHeader
                    title="Launch summary"
                    description={recommendedTournamentStatus.reason}
                    headingLevel="h3"
                    actions={<Badge tone="neutral">{capitalizeFirstLetter(recommendedTournamentStatus.value.replace(/-/gu, ' '))}</Badge>}
                  />
                  <dl className={layout.summaryList}>
                    {[
                      ['Visibility', details.visibility.charAt(0).toUpperCase() + details.visibility.slice(1)],
                      ['Tournament dates', formatTournamentDateRange(details.startDateIso, details.endDateIso)],
                      ['Registration closes', formatDateShort(details.registrationCloseIso)],
                      ['Events', String(enabledEvents.length)],
                      ['Squads', squads.length ? String(squads.length) : 'Not used'],
                      ['Divisions', enabledDivisions.length ? String(enabledDivisions.length) : 'Not used'],
                      ['Payment', 'Cash at the venue'],
                    ].map(([term, value]) => (
                      <div key={term}><dt>{term}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                </Card>
              </div>

              <Card aria-label="Publish">
                <CardHeader
                  title={blockingIssueCount > 0 ? 'Publishing is blocked' : 'Ready to publish'}
                  description={blockingIssueCount > 0
                    ? `Resolve ${blockingIssueCount} required issue${blockingIssueCount === 1 ? '' : 's'} before publishing.`
                    : 'Publishing makes this tournament available according to the visibility you chose.'}
                  headingLevel="h3"
                  actions={(
                    <>
                      <Button variant="secondary" onClick={() => { void handleSaveDraft(); }} disabled={isSavingDraft || isPublishing}>
                        {isSavingDraft ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="primary"
                        icon={<CircleCheck size={ICON_SIZE.md} aria-hidden="true" />}
                        onClick={() => { void handlePublish(); }}
                        disabled={blockingIssueCount > 0 || isSavingDraft || isPublishing}
                      >
                        {isPublishing ? 'Publishing...' : 'Publish tournament'}
                      </Button>
                    </>
                  )}
                />
              </Card>
            </>
          )}
          <nav className={layout.stepFooter} aria-label="Setup step navigation">
            {previousSection ? (
              <Button variant="secondary" icon={<ArrowLeft size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => setActiveSection(previousSection.key)}>
                {previousSection.label}
              </Button>
            ) : <span />}
            {nextSection ? (
              <Button variant="primary" icon={<ArrowRight size={ICON_SIZE.md} aria-hidden="true" />} iconPosition="end" onClick={() => setActiveSection(nextSection.key)}>
                {nextSection.label}
              </Button>
            ) : null}
          </nav>
        </div>
      </div>

      <Modal
        open={isTournamentModalOpen}
        onClose={() => setIsTournamentModalOpen(false)}
        title="All tournaments"
        description={`${userTournaments.length} available tournament${userTournaments.length === 1 ? '' : 's'}`}
        size="lg"
        closeLabel="Close tournament list"
      >
        {isLoadingTournamentLibrary ? (
          <p className={layout.bodyText}>Loading tournaments...</p>
        ) : userTournaments.length === 0 ? (
          <p className={layout.bodyText}>No tournaments found for this user.</p>
        ) : (
          <ul className={layout.rows}>
            {userTournaments.map((tournament) => {
              const setupState = setupStateByTournamentId[tournament.id];
              const squadCount = countTournamentSquads(tournament.squad_times);
              const isActive = Boolean(setupState?.is_published || tournament.is_public);
              const isBusy = loadingTournamentId === tournament.id || deletingTournamentId === tournament.id;
              return (
                <li key={tournament.id} className={layout.row}>
                  <div className={layout.rowText}>
                    <span className={layout.rowTitle}>
                      {tournament.name}
                      <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Active' : 'Draft'}</Badge>
                    </span>
                    <span className={layout.rowMeta}>
                      {[
                        tournament.location || 'Location not set',
                        formatTournamentCardDate(tournament.start_date, tournament.end_date),
                        `${squadCount} squad${squadCount === 1 ? '' : 's'}`,
                        `${tournament.entry_count ?? 0} entries`,
                        tournament.brackets_configured ? 'Brackets configured' : 'Brackets pending',
                      ].join(' · ')}
                    </span>
                  </div>
                  <div className={layout.rowActions}>
                    <Button size="sm" variant="secondary" onClick={() => { void handleLoadExistingTournament(tournament.id); }} disabled={isBusy}>
                      {loadingTournamentId === tournament.id ? 'Loading...' : 'Edit'}
                    </Button>
                    <Menu triggerLabel={`More actions for ${tournament.name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                      <MenuItem
                        tone="danger"
                        icon={<Trash2 size={ICON_SIZE.md} />}
                        onSelect={() => { void handleDeleteTournament(tournament.id); }}
                        disabled={isBusy}
                        aria-label={`Delete ${tournament.name}`}
                      >
                        {deletingTournamentId === tournament.id ? 'Deleting...' : 'Delete tournament'}
                      </MenuItem>
                    </Menu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {confirmationDialog}
      <ConfigDrawer
        open={Boolean(drawerState)}
        title={drawerState
          ? `${drawerState.id ? 'Edit' : 'Add'} ${drawerState.kind === 'fee' ? 'add-on' : drawerState.kind}`
          : ''}
        subtitle={drawerState?.kind === 'squad' && activeSquad
          ? `${activeSquad.dateIso ? formatDateShort(activeSquad.dateIso) : 'Date not set'} · ${activeSquad.startTime ? formatSquadTimeLabel(activeSquad.startTime) : 'Time not set'}`
          : drawerState ? ({ location: 'Squads and availability', field: 'Registration setup', question: 'Registration setup', fee: 'Add-ons, payments, and documents' } as Record<string, string>)[drawerState.kind] ?? '' : ''}
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
    </Page>
  );
}
