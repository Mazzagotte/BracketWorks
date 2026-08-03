"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, History, Info, Plus } from "lucide-react";

import { usePageHeader } from "../lib/header-context";
import { apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { formatShortMonthDayYear } from "../lib/formatters";
import type { ChangelogEntry } from "../lib/types";
import { DataTableToolbar } from "../components/primitives";
import { useToastHelpers } from "../components/Toast";
import buttonStyles from "../styles/buttons.module.css";
import styles from "./admin.module.css";

type OverviewResponse = {
  metrics: {
    total_users: number;
    admin_users: number;
    total_tournaments: number;
    total_squads: number;
    total_entries: number;
    total_scores: number;
    total_snapshots: number;
    total_payouts: number;
    unverified_users?: number;
    users_never_signed_in?: number;
    open_user_reviews?: number;
    open_tournament_notes?: number;
    active_announcements?: number;
    failed_operations?: number;
  };
  top_operators: Array<{
    id: number;
    username: string;
    name: string;
    tournament_count: number;
  }>;
  recent_tournaments: Array<{
    id: number;
    name: string;
    location: string | null;
    start_date: string | null;
    owner_username: string;
    owner_name: string;
  }>;
  recent_signups: Array<{
    id: number;
    username: string;
    name: string;
    created_at: string | null;
  }>;
};

type UserRow = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  organization: string | null;
  is_admin: boolean;
  email_verified: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  tournament_count: number;
  profile_count: number;
  created_at: string | null;
  max_risk_score: number;
  active_session_count: number;
  failed_login_count: number;
  open_review_count: number;
  dev_notice_version_accepted: string | null;
  dev_notice_accepted_at: string | null;
};

type UserReviewDetail = {
  user: UserRow & { name: string };
  sessions: Array<{ id: number; issued_at: string | null; last_seen_at: string | null; expires_at: string | null; is_revoked: boolean; revoked_at: string | null; region_hint: string | null; device_nickname: string | null; risk_score: number }>;
  login_attempts: Array<{ id: number; failed_count: number; window_start: string | null; blocked_until: string | null; updated_at: string | null }>;
  reviews: Array<{ id: number; kind: "flag" | "note"; category: string; note: string; is_resolved: boolean; admin_username: string; created_at: string | null; resolved_at: string | null }>;
  acknowledgments: Array<{ id: number; content_type: string; content_id: string; version: string; acknowledged_at: string | null }>;
};

type UsersResponse = {
  users: UserRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type TournamentRow = {
  id: number;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  owner_username: string;
  owner_email: string;
  owner_name: string;
  entry_count: number;
  squad_count: number;
  score_count: number;
  payout_count: number;
  snapshot_count: number;
  status: "current" | "upcoming" | "completed" | "archived";
  open_note_count: number;
  last_activity_at: string | null;
  last_admin_change_at: string | null;
};

type TournamentNote = { id: number; category: string; note: string; is_resolved: boolean; admin_username: string; created_at: string | null; resolved_at: string | null };

type TournamentsResponse = {
  tournaments: TournamentRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type TableInfo = {
  name: string;
  row_count: number | null;
  row_count_kind: "skipped" | "estimated" | "exact";
  columns: string[];
};

type TablesResponse = {
  tables: TableInfo[];
  include_counts: boolean;
  total_tables: number;
};

type AuditLogRow = {
  id: number;
  admin_user_id: number;
  admin_username: string | null;
  admin_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
};

type AuditLogsResponse = {
  logs: AuditLogRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type DeletePreview = {
  impact: Record<string, number>;
  dependent_total_rows: number;
  requires_force?: boolean;
  score_count?: number;
};

type AdminTab = "overview" | "users" | "tournaments" | "operations" | "announcements" | "database" | "audit" | "changelog";

type AdminAnnouncement = { id: number; title: string; message: string; audience_type: "all" | "admins" | "user"; audience_user_id: number | null; status: "draft" | "active" | "archived"; requires_acknowledgment: boolean; starts_at: string | null; ends_at: string | null; acknowledgment_count: number };
type AdminOperation = { job_id: string; job_type: string; status: string; created_at: string; started_at: string | null; completed_at: string | null; error: string | null };

type ChangelogFormState = {
  version: string;
  date: string;
  changes: string;
};

type AdminChangelogEntry = ChangelogEntry & {
  id: number;
  created_at: string | null;
  updated_at: string | null;
};

const EMPTY_CHANGELOG_FORM: ChangelogFormState = {
  version: "",
  date: "",
  changes: "",
};

const TAB_LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  users: "Users",
  tournaments: "Tournaments",
  database: "Database",
  audit: "Audit",
  changelog: "Changelog",
  operations: "Operations",
  announcements: "Announcements",
};

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function formatAdminTimestamp(value: string | null, emptyLabel = "Never") {
  if (!value) return emptyLabel;

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, isUserAuthenticated, isAuthInitialized } = useAuth();
  const { success: showSuccess } = useToastHelpers();
  const isDevelopment = process.env.NODE_ENV !== "production";

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [usersResponse, setUsersResponse] = useState<UsersResponse>({ users: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersSort, setUsersSort] = useState("id_asc");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(25);
  const [usersVerification, setUsersVerification] = useState("all");
  const [usersActivity, setUsersActivity] = useState("all");
  const [usersReview, setUsersReview] = useState("all");
  const [reviewUser, setReviewUser] = useState<UserRow | null>(null);
  const [reviewDetail, setReviewDetail] = useState<UserReviewDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewKind, setReviewKind] = useState<"flag" | "note">("note");
  const [reviewCategory, setReviewCategory] = useState("general");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const [tournamentsResponse, setTournamentsResponse] = useState<TournamentsResponse>({ tournaments: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [tournamentActivityFilter, setTournamentActivityFilter] = useState<"all" | "has_entries" | "no_entries">("all");
  const [tournamentSort, setTournamentSort] = useState<"newest" | "entries_desc" | "owner_asc" | "oldest">("newest");
  const [tournamentPage, setTournamentPage] = useState(1);
  const [expandedTournamentIds, setExpandedTournamentIds] = useState<number[]>([]);
  const [noteTournament, setNoteTournament] = useState<TournamentRow | null>(null);
  const [tournamentNotes, setTournamentNotes] = useState<TournamentNote[]>([]);
  const [tournamentNotesLoading, setTournamentNotesLoading] = useState(false);
  const [tournamentNoteCategory, setTournamentNoteCategory] = useState("general");
  const [tournamentNoteText, setTournamentNoteText] = useState("");

  const [tablesResponse, setTablesResponse] = useState<TablesResponse>({ tables: [], include_counts: false, total_tables: 0 });
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesLoaded, setTablesLoaded] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [tableIncludeCounts, setTableIncludeCounts] = useState(false);

  const [auditResponse, setAuditResponse] = useState<AuditLogsResponse>({ logs: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditTargetType, setAuditTargetType] = useState("");
  const [auditAdminUserId, setAuditAdminUserId] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditPage, setAuditPage] = useState(1);

  const [changelogEntries, setChangelogEntries] = useState<AdminChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogLoaded, setChangelogLoaded] = useState(false);
  const [changelogError, setChangelogError] = useState<string | null>(null);
  const [changelogForm, setChangelogForm] = useState<ChangelogFormState>(EMPTY_CHANGELOG_FORM);
  const [changelogFormError, setChangelogFormError] = useState<string | null>(null);
  const [changelogFormSaving, setChangelogFormSaving] = useState(false);
  const [showChangelogHistory, setShowChangelogHistory] = useState(false);
  const [editingChangelogVersion, setEditingChangelogVersion] = useState<string | null>(null);
  const [deletingChangelogVersion, setDeletingChangelogVersion] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState<"all" | "admins" | "user">("all");
  const [announcementUserId, setAnnouncementUserId] = useState("");
  const [announcementStatus, setAnnouncementStatus] = useState<"draft" | "active" | "archived">("draft");
  const [announcementRequiresAck, setAnnouncementRequiresAck] = useState(false);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [operations, setOperations] = useState<AdminOperation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [operationsNote, setOperationsNote] = useState("");

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resetPasswordInputRef = useRef<HTMLInputElement>(null);

  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteUserReason, setDeleteUserReason] = useState("");
  const [deleteUserConfirmText, setDeleteUserConfirmText] = useState("");
  const [deleteUserPreview, setDeleteUserPreview] = useState<DeletePreview | null>(null);
  const [deleteUserSaving, setDeleteUserSaving] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [adminRoleSavingUserId, setAdminRoleSavingUserId] = useState<number | null>(null);

  const [editTournament, setEditTournament] = useState<TournamentRow | null>(null);
  const [editTournamentName, setEditTournamentName] = useState("");
  const [editTournamentLocation, setEditTournamentLocation] = useState("");
  const [editTournamentStartDate, setEditTournamentStartDate] = useState("");
  const [editTournamentEndDate, setEditTournamentEndDate] = useState("");
  const [editTournamentSaving, setEditTournamentSaving] = useState(false);
  const [editTournamentError, setEditTournamentError] = useState<string | null>(null);

  const [reassignTournament, setReassignTournament] = useState<TournamentRow | null>(null);
  const [reassignUserId, setReassignUserId] = useState("");
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const [archiveTournament, setArchiveTournament] = useState<TournamentRow | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [deleteTournament, setDeleteTournament] = useState<TournamentRow | null>(null);
  const [deleteTournamentReason, setDeleteTournamentReason] = useState("");
  const [deleteTournamentConfirmText, setDeleteTournamentConfirmText] = useState("");
  const [forceDeleteTournament, setForceDeleteTournament] = useState(false);
  const [deleteTournamentPreview, setDeleteTournamentPreview] = useState<DeletePreview | null>(null);
  const [deleteTournamentSaving, setDeleteTournamentSaving] = useState(false);
  const [deleteTournamentError, setDeleteTournamentError] = useState<string | null>(null);

  const loadOverview = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setOverviewLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<OverviewResponse>("/api/v1/admin/overview", false);
      setOverview(data);
      setOverviewLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setOverviewLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin]);

  const loadUsers = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setUsersLoading(true);
    setError(null);
    try {
      const query = buildQuery({ page: usersPage, page_size: usersPageSize, search: usersSearch, sort: usersSort, verification: usersVerification, activity: usersActivity, review: usersReview });
      const data = await apiClient.get<UsersResponse>(`/api/v1/admin/users${query}`, false);
      setUsersResponse(data);
      setUsersLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin, usersPage, usersPageSize, usersSearch, usersSort, usersVerification, usersActivity, usersReview]);

  const loadUserReview = useCallback(async (user: UserRow) => {
    setReviewUser(user);
    setReviewDetail(null);
    setReviewError(null);
    setReviewLoading(true);
    try {
      const detail = await apiClient.get<UserReviewDetail>(`/api/v1/admin/users/${user.id}/review`, false);
      setReviewDetail(detail);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to load account review");
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const saveUserReview = useCallback(async () => {
    if (!reviewUser || !reviewNote.trim()) return;
    setReviewSaving(true);
    setReviewError(null);
    try {
      await apiClient.post(`/api/v1/admin/users/${reviewUser.id}/reviews`, { kind: reviewKind, category: reviewCategory, note: reviewNote.trim() });
      setReviewNote("");
      await Promise.all([loadUserReview(reviewUser), loadUsers(false)]);
      showSuccess(`${reviewKind === "flag" ? "Review flag" : "Internal note"} added for ${reviewUser.username}.`);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to save account review");
    } finally {
      setReviewSaving(false);
    }
  }, [loadUserReview, loadUsers, reviewCategory, reviewKind, reviewNote, reviewUser, showSuccess]);

  const resolveUserReview = useCallback(async (reviewId: number, resolved: boolean) => {
    if (!reviewUser) return;
    setReviewError(null);
    try {
      await apiClient.patch(`/api/v1/admin/user-reviews/${reviewId}`, { resolved });
      await Promise.all([loadUserReview(reviewUser), loadUsers(false)]);
      showSuccess(`Review item ${resolved ? "resolved" : "reopened"}.`);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to update review item");
    }
  }, [loadUserReview, loadUsers, reviewUser, showSuccess]);

  const exportUsersCsv = useCallback(() => {
    const headers = ["ID", "Name", "Username", "Email", "Organization", "Verified", "Created", "Last login", "Tournaments", "Profiles", "Open reviews", "Failed logins"];
    const escape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = usersResponse.users.map((user) => [user.id, `${user.first_name} ${user.last_name}`.trim(), user.username, user.email, user.organization, user.email_verified ? "Yes" : "No", user.created_at, user.last_login_at, user.tournament_count, user.profile_count, user.open_review_count, user.failed_login_count]);
    const blob = new Blob([[headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bracketworks-admin-users-page-${usersResponse.page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [usersResponse]);

  const exportAuditCsv = useCallback(() => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = auditResponse.logs.map(log => [log.created_at, log.admin_name || log.admin_username, log.action, log.target_type, log.target_id, log.reason, JSON.stringify(log.details || {})]);
    const csv = [["When", "Administrator", "Action", "Target type", "Target ID", "Reason", "Details"], ...rows].map(row => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bracketworks-admin-audit-page-${auditResponse.page}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }, [auditResponse]);

  const exportTournamentsCsv = useCallback(() => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = tournamentsResponse.tournaments.map(item => [item.id, item.name, item.owner_name || item.owner_username, item.owner_email, item.location, item.start_date, item.end_date, item.status, item.squad_count, item.entry_count, item.score_count, item.payout_count, item.open_note_count, item.last_activity_at]);
    const csv = [["ID", "Tournament", "Owner", "Owner email", "Location", "Start", "End", "Status", "Squads", "Entries", "Scores", "Payouts", "Open notes", "Last activity"], ...rows].map(row => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bracketworks-admin-tournaments-page-${tournamentsResponse.page}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }, [tournamentsResponse]);

  const loadTournaments = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setTournamentsLoading(true);
    setError(null);
    try {
      const query = buildQuery({
        page: tournamentPage,
        page_size: 25,
        search: tournamentSearch,
        activity: tournamentActivityFilter,
        sort: tournamentSort,
      });
      const data = await apiClient.get<TournamentsResponse>(`/api/v1/admin/tournaments${query}`, false);
      setTournamentsResponse(data);
      setExpandedTournamentIds([]);
      setTournamentsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments");
    } finally {
      setTournamentsLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin, tournamentPage, tournamentSearch, tournamentActivityFilter, tournamentSort]);

  const loadTournamentNotes = useCallback(async (tournament: TournamentRow) => {
    setNoteTournament(tournament); setTournamentNotesLoading(true); setError(null);
    try { const data = await apiClient.get<{ notes: TournamentNote[] }>(`/api/v1/admin/tournaments/${tournament.id}/notes`, false); setTournamentNotes(data.notes); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load tournament notes"); }
    finally { setTournamentNotesLoading(false); }
  }, []);

  const saveTournamentNote = useCallback(async () => {
    if (!noteTournament || !tournamentNoteText.trim()) return;
    await apiClient.post(`/api/v1/admin/tournaments/${noteTournament.id}/notes`, { category: tournamentNoteCategory, note: tournamentNoteText.trim() });
    setTournamentNoteText(""); await Promise.all([loadTournamentNotes(noteTournament), loadTournaments(false)]); showSuccess("Tournament note added.");
  }, [loadTournamentNotes, loadTournaments, noteTournament, showSuccess, tournamentNoteCategory, tournamentNoteText]);

  const resolveTournamentNote = useCallback(async (noteId: number, resolved: boolean) => {
    if (!noteTournament) return;
    await apiClient.patch(`/api/v1/admin/tournament-notes/${noteId}`, { resolved });
    await Promise.all([loadTournamentNotes(noteTournament), loadTournaments(false)]); showSuccess(`Tournament note ${resolved ? "resolved" : "reopened"}.`);
  }, [loadTournamentNotes, loadTournaments, noteTournament, showSuccess]);

  const loadTables = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setTablesLoading(true);
    setError(null);
    try {
      const query = buildQuery({ include_counts: tableIncludeCounts, search: tableSearch, limit: 300 });
      const data = await apiClient.get<TablesResponse>(`/api/v1/admin/database/tables${query}`, false);
      setTablesResponse(data);
      setTablesLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database tables");
    } finally {
      setTablesLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin, tableIncludeCounts, tableSearch]);

  const loadAuditLogs = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setAuditLoading(true);
    setError(null);
    try {
      const query = buildQuery({
        page: auditPage,
        page_size: 25,
        search: auditSearch,
        action: auditAction,
        target_type: auditTargetType,
        admin_user_id: auditAdminUserId,
        date_from: auditDateFrom,
        date_to: auditDateTo,
      });
      const data = await apiClient.get<AuditLogsResponse>(`/api/v1/admin/audit-logs${query}`, false);
      setAuditResponse(data);
      setAuditLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setAuditLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin, auditPage, auditSearch, auditAction, auditTargetType, auditAdminUserId, auditDateFrom, auditDateTo]);

  const loadChangelog = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setChangelogLoading(true);
    setChangelogError(null);
    try {
      const data = await apiClient.get<{ entries: AdminChangelogEntry[] }>("/api/v1/admin/changelog", false);
      setChangelogEntries(data.entries);
      setChangelogLoaded(true);
    } catch (err) {
      setChangelogError(err instanceof Error ? err.message : "Failed to load changelog");
    } finally {
      setChangelogLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin]);

  const loadAnnouncements = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setAnnouncementsLoading(true); setError(null);
    try { const data = await apiClient.get<{ announcements: AdminAnnouncement[] }>("/api/v1/admin/announcements", false); setAnnouncements(data.announcements); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load announcements"); }
    finally { setAnnouncementsLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const loadOperations = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setOperationsLoading(true); setError(null);
    try { const data = await apiClient.get<{ operations: AdminOperation[]; note: string }>("/api/v1/admin/operations", false); setOperations(data.operations); setOperationsNote(data.note); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load operations"); }
    finally { setOperationsLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const saveAnnouncement = useCallback(async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;
    setAnnouncementSaving(true); setError(null);
    try {
      await apiClient.post("/api/v1/admin/announcements", { title: announcementTitle.trim(), message: announcementMessage.trim(), audience_type: announcementAudience, audience_user_id: announcementAudience === "user" ? Number(announcementUserId) : null, status: announcementStatus, requires_acknowledgment: announcementRequiresAck, starts_at: null, ends_at: null });
      setAnnouncementTitle(""); setAnnouncementMessage(""); setAnnouncementStatus("draft"); setAnnouncementRequiresAck(false);
      await loadAnnouncements(false); showSuccess("Announcement saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save announcement"); }
    finally { setAnnouncementSaving(false); }
  }, [announcementAudience, announcementMessage, announcementRequiresAck, announcementStatus, announcementTitle, announcementUserId, loadAnnouncements, showSuccess]);

  const updateAnnouncementStatus = useCallback(async (announcement: AdminAnnouncement, status: AdminAnnouncement["status"]) => {
    try {
      await apiClient.patch(`/api/v1/admin/announcements/${announcement.id}`, { ...announcement, status });
      await loadAnnouncements(false); showSuccess(`Announcement ${status}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update announcement"); }
  }, [loadAnnouncements, showSuccess]);

  const loadActiveTab = useCallback(async (manual = false) => {
    if (activeTab === "overview") {
      await loadOverview(manual);
      return;
    }
    if (activeTab === "users") {
      await loadUsers(manual);
      return;
    }
    if (activeTab === "tournaments") {
      await loadTournaments(manual);
      return;
    }
    if (activeTab === "database") {
      await loadTables(manual);
      return;
    }
    if (activeTab === "changelog") {
      await loadChangelog(manual);
      return;
    }
    if (activeTab === "announcements") { await loadAnnouncements(manual); return; }
    if (activeTab === "operations") { await loadOperations(manual); return; }
    await loadAuditLogs(manual);
  }, [activeTab, loadOverview, loadUsers, loadTournaments, loadTables, loadChangelog, loadAuditLogs, loadAnnouncements, loadOperations]);

  const refreshAfterMutation = useCallback(async ({
    overview = false,
    users = false,
    tournaments = false,
    tables = false,
    audit = false,
    changelog = false,
  }: {
    overview?: boolean;
    users?: boolean;
    tournaments?: boolean;
    tables?: boolean;
    audit?: boolean;
    changelog?: boolean;
  }) => {
    const refreshTasks: Promise<unknown>[] = [];
    if (overview) refreshTasks.push(loadOverview(false));
    if (users) refreshTasks.push(loadUsers(false));
    if (tournaments) refreshTasks.push(loadTournaments(false));
    if (tables) refreshTasks.push(loadTables(false));
    if (audit) refreshTasks.push(loadAuditLogs(false));
    if (changelog) refreshTasks.push(loadChangelog(false));
    await Promise.allSettled(refreshTasks);
  }, [loadOverview, loadUsers, loadTournaments, loadTables, loadAuditLogs, loadChangelog]);

  const handleToggleAdminRole = useCallback(async (user: UserRow) => {
    const nextIsAdmin = !user.is_admin;
    const promptText = nextIsAdmin
      ? `Grant admin privileges to ${user.username}?`
      : `Revoke admin privileges from ${user.username}?`;

    if (!window.confirm(promptText)) return;

    setAdminRoleSavingUserId(user.id);
    setError(null);
    try {
      await apiClient.post(`/api/v1/admin/users/${user.id}/set-admin`, { is_admin: nextIsAdmin });
      await refreshAfterMutation({ overview: true, users: true, audit: true });
      showSuccess(`${user.username} ${nextIsAdmin ? "is now an administrator" : "is no longer an administrator"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin privileges");
    } finally {
      setAdminRoleSavingUserId(null);
    }
  }, [refreshAfterMutation, showSuccess]);

  const handleChangelogCreateOrUpdate = useCallback(async () => {
    if (!changelogForm.version.trim() || !changelogForm.date.trim() || !changelogForm.changes.trim()) {
      setChangelogFormError("All fields are required");
      return;
    }

    const changes = changelogForm.changes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (changes.length === 0) {
      setChangelogFormError("Changes list cannot be empty");
      return;
    }

    setChangelogFormSaving(true);
    setChangelogFormError(null);
    try {
      if (editingChangelogVersion) {
        await apiClient.put(`/api/v1/admin/changelog/${editingChangelogVersion}`, {
          date: changelogForm.date.trim(),
          changes,
        });
      } else {
        await apiClient.post("/api/v1/admin/changelog", {
          version: changelogForm.version.trim(),
          date: changelogForm.date.trim(),
          changes,
        });
      }
      setChangelogForm(EMPTY_CHANGELOG_FORM);
      setEditingChangelogVersion(null);
      await refreshAfterMutation({ changelog: true });
      showSuccess(`Changelog entry ${editingChangelogVersion ? "updated" : "created"}.`);
    } catch (err) {
      setChangelogFormError(err instanceof Error ? err.message : "Failed to save changelog entry");
    } finally {
      setChangelogFormSaving(false);
    }
  }, [changelogForm, editingChangelogVersion, refreshAfterMutation, showSuccess]);

  const handleChangelogDelete = useCallback(async (version: string) => {
    if (!window.confirm(`Delete changelog entry for version ${version}?`)) return;

    setDeletingChangelogVersion(version);
    setChangelogError(null);
    try {
      await apiClient.delete(`/api/v1/admin/changelog/${version}`);
      await refreshAfterMutation({ changelog: true });
      showSuccess(`Changelog ${version} deleted.`);
    } catch (err) {
      setChangelogError(err instanceof Error ? err.message : "Failed to delete changelog entry");
    } finally {
      setDeletingChangelogVersion(null);
    }
  }, [refreshAfterMutation, showSuccess]);

  const handleChangelogEdit = useCallback((entry: AdminChangelogEntry) => {
    setEditingChangelogVersion(entry.version);
    setChangelogForm({
      version: entry.version,
      date: entry.date,
      changes: entry.changes.join("\n"),
    });
  }, []);

  const handleChangelogCancel = useCallback(() => {
    setEditingChangelogVersion(null);
    setChangelogForm(EMPTY_CHANGELOG_FORM);
    setChangelogFormError(null);
  }, []);

  const adminTabs = useMemo(() => (
    <nav className={styles.adminNav} aria-label="Admin sections">
      <div className={styles.tabRow}>
        {(["overview", "users", "tournaments", "announcements", "operations", "audit", "changelog", ...(isDevelopment ? ["database" as AdminTab] : [])] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </nav>
  ), [activeTab, isDevelopment]);

  const headerActions = useMemo(() => (
    <>
      <button
        type="button"
        className={styles.refreshButton}
        onClick={() => { void loadActiveTab(true); }}
        disabled={refreshing}
      >
        {refreshing ? "Refreshing..." : "Refresh"}
      </button>
    </>
  ), [refreshing, loadActiveTab]);

  usePageHeader({
    title: "Admin Console",
    subtitle: "Owner View",
    actions: headerActions,
  });

  useEffect(() => {
    if (!isAuthInitialized) return;
    if (!isUserAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!currentUser?.isAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, router]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "overview") {
      void loadOverview(false);
    }
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadOverview]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "users") {
      void loadUsers(false);
    }
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadUsers]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "tournaments") {
      void loadTournaments(false);
    }
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadTournaments]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "database") {
      void loadTables(false);
    }
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadTables]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "audit") {
      void loadAuditLogs(false);
    }
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadAuditLogs]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "changelog") {
      void loadChangelog(false);
    }
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadChangelog]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    if (activeTab === "announcements") void loadAnnouncements(false);
    if (activeTab === "operations") void loadOperations(false);
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadAnnouncements, loadOperations]);

  useEffect(() => {
    if (!deleteUser) return;
    let isMounted = true;
    setDeleteUserPreview(null);
    setDeleteUserError(null);
    void apiClient.get<DeletePreview>(`/api/v1/admin/users/${deleteUser.id}/delete-preview`, false)
      .then((preview) => {
        if (isMounted) setDeleteUserPreview(preview);
      })
      .catch((err) => {
        if (isMounted) setDeleteUserError(err instanceof Error ? err.message : "Failed to load delete impact");
      });

    return () => {
      isMounted = false;
    };
  }, [deleteUser]);

  useEffect(() => {
    if (!deleteTournament) return;
    let isMounted = true;
    setDeleteTournamentPreview(null);
    setDeleteTournamentError(null);
    void apiClient.get<DeletePreview>(`/api/v1/admin/tournaments/${deleteTournament.id}/delete-preview`, false)
      .then((preview) => {
        if (isMounted) setDeleteTournamentPreview(preview);
      })
      .catch((err) => {
        if (isMounted) setDeleteTournamentError(err instanceof Error ? err.message : "Failed to load delete impact");
      });

    return () => {
      isMounted = false;
    };
  }, [deleteTournament]);

  const metrics = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Users", value: overview.metrics.total_users.toLocaleString(), tone: "orange" },
      { label: "Tournaments", value: overview.metrics.total_tournaments.toLocaleString(), tone: "blue" },
      { label: "Entries", value: overview.metrics.total_entries.toLocaleString(), tone: "green" },
      { label: "Bracket Snapshots", value: overview.metrics.total_snapshots.toLocaleString(), tone: "slate" },
      { label: "Unverified Users", value: (overview.metrics.unverified_users ?? 0).toLocaleString(), tone: "gold" },
      { label: "Open Reviews", value: (overview.metrics.open_user_reviews ?? 0).toLocaleString(), tone: "red" },
      { label: "Tournament Notes", value: (overview.metrics.open_tournament_notes ?? 0).toLocaleString(), tone: "gold" },
      { label: "Failed Operations", value: (overview.metrics.failed_operations ?? 0).toLocaleString(), tone: "red" },
    ];
  }, [overview]);

  if (!isAuthInitialized || (overviewLoading && !overviewLoaded)) {
    return <div className={styles.stateCard}>Loading admin console...</div>;
  }

  if (!currentUser?.isAdmin) {
    return <div className={styles.stateCard}>Redirecting...</div>;
  }

  return (
    <div className={styles.page}>
      {error && <div className={styles.errorBanner} role="alert">{error}</div>}

      {adminTabs}

      {activeTab === "overview" && (
        <div className={styles.sectionStack}>
          <div className={styles.metricGrid}>
            {metrics.map((metric) => (
              <section key={metric.label} className={`${styles.metricCard} ${styles[`tone${metric.tone.charAt(0).toUpperCase()}${metric.tone.slice(1)}`]}`}>
                <div className={styles.metricLabel}>{metric.label}</div>
                <div className={styles.metricValue}>{metric.value}</div>
              </section>
            ))}
          </div>

          <div className={styles.twoColumnGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Top Operators</h3>
                <span className={styles.panelSubtle}>Most tournaments created</span>
              </div>
              <div className={styles.listStack}>
                {(overview?.top_operators || []).map((operator) => (
                  <div key={operator.id} className={styles.listRow}>
                    <div>
                      <div className={styles.primaryText}>{operator.name || operator.username}</div>
                      <div className={styles.secondaryText}>@{operator.username}</div>
                    </div>
                    <span className={styles.valuePill}>{operator.tournament_count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Recent Tournaments</h3>
                <span className={styles.panelSubtle}>Latest tournament records</span>
              </div>
              <div className={styles.listStack}>
                {(overview?.recent_tournaments || []).map((tournament) => (
                  <div key={tournament.id} className={styles.listRow}>
                    <div>
                      <div className={styles.primaryText}>{tournament.name}</div>
                      <div className={styles.secondaryText}>
                        {tournament.owner_name || tournament.owner_username}
                        {tournament.location ? ` - ${tournament.location}` : ""}
                      </div>
                    </div>
                    <span className={styles.valuePill}>#{tournament.id}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Recent Signups</h3>
              <span className={styles.panelSubtle}>Newest accounts</span>
            </div>
            <div className={styles.listStack}>
              {(overview?.recent_signups || []).map((user) => (
                <div key={user.id} className={styles.listRow}>
                  <div>
                    <div className={styles.primaryText}>{user.name || user.username}</div>
                    <div className={styles.secondaryText}>@{user.username}</div>
                  </div>
                  <div className={styles.secondaryText}>
                    {user.created_at
                      ? formatShortMonthDayYear(new Date(user.created_at))
                      : "-"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "users" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Users</h3>
            <span className={styles.panelSubtle}>{usersResponse.total} total</span>
          </div>
          <DataTableToolbar
            className={styles.toolbarRow}
            left={(
              <input
                type="text"
                className={styles.toolbarInput}
                aria-label="Search users"
                value={usersSearch}
                onChange={(event) => {
                  setUsersSearch(event.target.value);
                  setUsersPage(1);
                }}
                placeholder="Search name, username, email, organization"
              />
            )}
            right={(
              <>
                <select className={styles.toolbarSelect} aria-label="Filter users by verification" value={usersVerification} onChange={(event) => { setUsersVerification(event.target.value); setUsersPage(1); }}>
                  <option value="all">All verification</option><option value="verified">Verified</option><option value="unverified">Unverified</option>
                </select>
                <select className={styles.toolbarSelect} aria-label="Filter users by activity" value={usersActivity} onChange={(event) => { setUsersActivity(event.target.value); setUsersPage(1); }}>
                  <option value="all">All activity</option><option value="active">Active in 90 days</option><option value="inactive">Inactive 90+ days</option><option value="never">Never signed in</option>
                </select>
                <select className={styles.toolbarSelect} aria-label="Filter users by review status" value={usersReview} onChange={(event) => { setUsersReview(event.target.value); setUsersPage(1); }}>
                  <option value="all">All reviews</option><option value="flagged">Needs review</option><option value="clear">No open reviews</option>
                </select>
                <select className={styles.toolbarSelect} aria-label="Sort users" value={usersSort} onChange={(event) => { setUsersSort(event.target.value); setUsersPage(1); }}>
                  <option value="id_asc">Sort: Oldest</option><option value="id_desc">Sort: Newest ID</option><option value="created_desc">Sort: Newest signup</option><option value="last_login_desc">Sort: Recent login</option><option value="name_asc">Sort: Name A-Z</option><option value="name_desc">Sort: Name Z-A</option><option value="tournaments_desc">Sort: Most tournaments</option><option value="reviews_desc">Sort: Review items</option>
                </select>
                <select className={styles.toolbarSelect} aria-label="Users per page" value={usersPageSize} onChange={(event) => { setUsersPageSize(Number(event.target.value)); setUsersPage(1); }}>
                  <option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option><option value={100}>100 per page</option>
                </select>
                <button type="button" className={styles.actionBtn} onClick={exportUsersCsv} disabled={usersResponse.users.length === 0}>Export CSV</button>
              </>
            )}
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Organization</th>
                  <th>Role</th>
                  <th>Tournaments</th>
                  <th>Bowler Profiles</th>
                  <th>Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td className={styles.tableState} colSpan={10}><span role="status">Loading users…</span></td></tr>
                ) : usersResponse.users.length === 0 ? (
                  <tr><td className={styles.tableState} colSpan={10}><strong>No users found</strong><span>Try changing the search or filter options.</span></td></tr>
                ) : (
                  usersResponse.users.map((user) => (
                    <tr key={user.id}>
                      <td>{`${user.first_name} ${user.last_name}`.trim()}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <details className={styles.userStatusDetails}>
                          <summary className={styles.userStatusSummary}>
                            <span className={`${styles.statusPill} ${user.email_verified ? styles.statusActive : styles.statusDraft}`}>
                              {user.email_verified ? "Verified" : "Pending"}
                            </span>
                          </summary>
                          <div className={styles.userStatusPanel}>
                            <div className={styles.detailGrid}>
                              <div>
                                <strong>Email verified:</strong> {user.email_verified ? "Yes" : "No"}
                              </div>
                              <div>
                                <strong>Verified at:</strong> {formatAdminTimestamp(user.email_verified_at)}
                              </div>
                              <div>
                                <strong>Last login:</strong> {formatAdminTimestamp(user.last_login_at)}
                              </div>
                              <div><strong>Created:</strong> {formatAdminTimestamp(user.created_at, "Unknown")}</div>
                              <div><strong>Active sessions:</strong> {user.active_session_count}</div>
                              <div><strong>Failed logins:</strong> {user.failed_login_count}</div>
                              <div><strong>Development notice:</strong> {user.dev_notice_version_accepted || "Not acknowledged"}</div>
                            </div>
                          </div>
                        </details>
                      </td>
                      <td>{user.organization || "-"}</td>
                      <td>{user.is_admin ? "Administrator" : "User"}</td>
                      <td>{user.tournament_count}</td>
                      <td>{user.profile_count}</td>
                      <td><span className={`${styles.statusPill} ${user.open_review_count > 0 ? styles.statusDraft : styles.statusActive}`}>{user.open_review_count > 0 ? `${user.open_review_count} open` : "Clear"}</span></td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" className={styles.actionBtn} onClick={() => { void loadUserReview(user); }}>Review</button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => {
                              setEditUser(user);
                              setEditFirstName(user.first_name);
                              setEditLastName(user.last_name);
                              setEditEmail(user.email);
                              setEditOrg(user.organization || "");
                              setEditError(null);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => {
                              setResetUser(user);
                              setResetPassword("");
                              setResetError(null);
                              setTimeout(() => resetPasswordInputRef.current?.focus(), 50);
                            }}
                          >
                            Reset PW
                          </button>
                          {user.id !== Number(currentUser?.id) && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${user.is_admin ? styles.actionBtnDanger : ""}`}
                              disabled={adminRoleSavingUserId === user.id}
                              onClick={() => {
                                void handleToggleAdminRole(user);
                              }}
                            >
                              {adminRoleSavingUserId === user.id
                                ? "Saving..."
                                : user.is_admin
                                  ? "Change to User"
                                  : "Promote to Admin"}
                            </button>
                          )}
                          {user.id !== Number(currentUser?.id) && (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => {
                                setDeleteUser(user);
                                setDeleteUserReason("");
                                setDeleteUserConfirmText("");
                                setDeleteUserError(null);
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
              disabled={usersResponse.page <= 1 || usersLoading}
            >
              Prev
            </button>
            <span className={styles.secondaryText}>Page {usersResponse.page} of {usersResponse.total_pages}</span>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setUsersPage((prev) => Math.min(usersResponse.total_pages, prev + 1))}
              disabled={usersResponse.page >= usersResponse.total_pages || usersLoading}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {activeTab === "tournaments" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>All Tournaments</h3>
            <span className={styles.panelSubtle}>{tournamentsResponse.total} total</span>
          </div>

          <DataTableToolbar
            className={styles.toolbarRow}
            left={(
              <input
                type="text"
                className={styles.toolbarInput}
                aria-label="Search tournaments"
                value={tournamentSearch}
                onChange={(event) => {
                  setTournamentSearch(event.target.value);
                  setTournamentPage(1);
                }}
                placeholder="Search name, owner, location"
              />
            )}
            right={(
              <>
                <select
                  className={styles.toolbarSelect}
                  aria-label="Filter tournaments by activity"
                  value={tournamentActivityFilter}
                  onChange={(event) => {
                    setTournamentActivityFilter(event.target.value as "all" | "has_entries" | "no_entries");
                    setTournamentPage(1);
                  }}
                >
                  <option value="all">All activity</option>
                  <option value="has_entries">Has entries</option>
                  <option value="no_entries">No entries</option>
                </select>
                <select
                  className={styles.toolbarSelect}
                  aria-label="Sort tournaments"
                  value={tournamentSort}
                  onChange={(event) => {
                    setTournamentSort(event.target.value as "newest" | "entries_desc" | "owner_asc" | "oldest");
                    setTournamentPage(1);
                  }}
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                  <option value="entries_desc">Sort: Most entries</option>
                  <option value="owner_asc">Sort: Owner A-Z</option>
                </select>
                <button type="button" className={styles.actionBtn} onClick={exportTournamentsCsv} disabled={tournamentsResponse.tournaments.length === 0}>Export CSV</button>
              </>
            )}
          />

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Location</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Squads</th>
                  <th>Entries</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tournamentsLoading ? (
                  <tr><td className={styles.tableState} colSpan={11}><span role="status">Loading tournaments…</span></td></tr>
                ) : tournamentsResponse.tournaments.length === 0 ? (
                  <tr><td className={styles.tableState} colSpan={11}><strong>No tournaments found</strong><span>Try changing the search, activity, or sort options.</span></td></tr>
                ) : (
                  tournamentsResponse.tournaments.map((tournament) => {
                    const expanded = expandedTournamentIds.includes(tournament.id);
                    return (
                      <Fragment key={tournament.id}>
                        <tr>
                          <td>{tournament.id}</td>
                          <td>{tournament.name}</td>
                          <td title={tournament.owner_email}>{tournament.owner_name || tournament.owner_username}</td>
                          <td>{tournament.location || "-"}</td>
                          <td>{tournament.start_date || "-"}</td>
                          <td>{tournament.end_date || "-"}</td>
                          <td>{tournament.squad_count}</td>
                          <td>{tournament.entry_count}</td>
                          <td><span className={`${styles.statusPill} ${tournament.status === "current" ? styles.statusActive : styles.statusDraft}`}>{tournament.status}</span></td>
                          <td><span className={`${styles.statusPill} ${tournament.open_note_count > 0 ? styles.statusDraft : styles.statusActive}`}>{tournament.open_note_count > 0 ? `${tournament.open_note_count} open` : "Clear"}</span></td>
                          <td>
                            <div className={styles.rowActions}>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => { void loadTournamentNotes(tournament); }}
                              >
                                Notes
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  setEditTournament(tournament);
                                  setEditTournamentName(tournament.name || "");
                                  setEditTournamentLocation(tournament.location || "");
                                  setEditTournamentStartDate(tournament.start_date || "");
                                  setEditTournamentEndDate(tournament.end_date || "");
                                  setEditTournamentError(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  setReassignTournament(tournament);
                                  setReassignUserId("");
                                  setReassignError(null);
                                }}
                              >
                                Reassign
                              </button>
                              {tournament.archived_at ? (
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={async () => {
                                    try {
                                      await apiClient.post(`/api/v1/admin/tournaments/${tournament.id}/unarchive`, {});
                                      await refreshAfterMutation({ overview: true, tournaments: true, audit: true });
                                      showSuccess(`${tournament.name} was unarchived.`);
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : "Failed to unarchive tournament");
                                    }
                                  }}
                                >
                                  Unarchive
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.actionBtn}
                                  onClick={() => {
                                    setArchiveTournament(tournament);
                                    setArchiveReason("");
                                    setArchiveError(null);
                                  }}
                                >
                                  Archive
                                </button>
                              )}
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => {
                                  setDeleteTournament(tournament);
                                  setDeleteTournamentReason("");
                                  setDeleteTournamentConfirmText("");
                                  setForceDeleteTournament(false);
                                  setDeleteTournamentError(null);
                                }}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  setExpandedTournamentIds((prev) => (
                                    prev.includes(tournament.id)
                                      ? prev.filter((id) => id !== tournament.id)
                                      : [...prev, tournament.id]
                                  ));
                                }}
                              >
                                {expanded ? "Hide" : "Details"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={11}>
                              <div className={styles.detailCard}>
                                <div className={styles.detailGrid}>
                                  <div><strong>Scores:</strong> {tournament.score_count}</div>
                                  <div><strong>Payouts:</strong> {tournament.payout_count}</div>
                                  <div><strong>Snapshots:</strong> {tournament.snapshot_count}</div>
                                  <div><strong>Owner Email:</strong> {tournament.owner_email}</div>
                                  <div><strong>Last bracket activity:</strong> {formatAdminTimestamp(tournament.last_activity_at, "None")}</div>
                                  <div><strong>Last admin change:</strong> {formatAdminTimestamp(tournament.last_admin_change_at, "None")}</div>
                                </div>
                                {tournament.archive_reason && (
                                  <div className={styles.detailNote}>Archive reason: {tournament.archive_reason}</div>
                                )}
                                <div className={styles.detailLinks}>
                                  <a className={styles.linkBtn} href={`/view/${tournament.id}`} target="_blank" rel="noreferrer">Open Bowler View</a>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setTournamentPage((prev) => Math.max(1, prev - 1))}
              disabled={tournamentsResponse.page <= 1 || tournamentsLoading}
            >
              Prev
            </button>
            <span className={styles.secondaryText}>Page {tournamentsResponse.page} of {tournamentsResponse.total_pages}</span>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setTournamentPage((prev) => Math.min(tournamentsResponse.total_pages, prev + 1))}
              disabled={tournamentsResponse.page >= tournamentsResponse.total_pages || tournamentsLoading}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {activeTab === "database" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Database Tables</h3>
            <span className={styles.panelSubtle}>{tablesResponse.total_tables} shown</span>
          </div>
          <DataTableToolbar
            className={styles.toolbarRow}
            left={(
              <input
                type="text"
                className={styles.toolbarInput}
                aria-label="Search database tables"
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
                placeholder="Search table names"
              />
            )}
            right={(
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={tableIncludeCounts}
                  onChange={(event) => setTableIncludeCounts(event.target.checked)}
                />
                <span>Include row counts (uses estimates on Postgres)</span>
              </label>
            )}
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Rows</th>
                  <th>Count Type</th>
                  <th>Columns</th>
                </tr>
              </thead>
              <tbody>
                {tablesLoading ? (
                  <tr><td className={styles.tableState} colSpan={4}><span role="status">Loading database tables…</span></td></tr>
                ) : tablesResponse.tables.length === 0 ? (
                  <tr><td className={styles.tableState} colSpan={4}><strong>No database tables found</strong><span>Clear the table-name search and try again.</span></td></tr>
                ) : (
                  tablesResponse.tables.map((table) => (
                    <tr key={table.name}>
                      <td>{table.name}</td>
                      <td>{table.row_count ?? "-"}</td>
                      <td>{table.row_count_kind}</td>
                      <td>{table.columns.join(", ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "audit" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Audit Log</h3>
            <span className={styles.panelSubtle}>{auditResponse.total} entries</span>
          </div>
          <DataTableToolbar
            className={styles.toolbarRow}
            left={(
              <input
                type="text"
                className={styles.toolbarInput}
                aria-label="Search audit log"
                value={auditSearch}
                onChange={(event) => {
                  setAuditSearch(event.target.value);
                  setAuditPage(1);
                }}
                placeholder="Search action, reason, target"
              />
            )}
            right={(
              <>
                <input
                  type="text"
                  className={styles.toolbarInput}
                  aria-label="Filter audit log by action"
                  value={auditAction}
                  onChange={(event) => {
                    setAuditAction(event.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="Action (example: tournament.delete)"
                />
                <input
                  type="text"
                  className={styles.toolbarInput}
                  aria-label="Filter audit log by target type"
                  value={auditTargetType}
                  onChange={(event) => {
                    setAuditTargetType(event.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="Target type (user, tournament)"
                />
                <select className={styles.toolbarSelect} aria-label="Filter audit log by administrator" value={auditAdminUserId} onChange={event => { setAuditAdminUserId(event.target.value); setAuditPage(1); }}><option value="">All administrators</option>{usersResponse.users.filter(user => user.is_admin).map(user => <option value={user.id} key={user.id}>{user.first_name} {user.last_name} (@{user.username})</option>)}</select>
                <input type="date" className={styles.toolbarInput} aria-label="Audit start date" value={auditDateFrom} onChange={event => { setAuditDateFrom(event.target.value); setAuditPage(1); }} />
                <input type="date" className={styles.toolbarInput} aria-label="Audit end date" value={auditDateTo} onChange={event => { setAuditDateTo(event.target.value); setAuditPage(1); }} />
                <button type="button" className={styles.actionBtn} onClick={exportAuditCsv} disabled={auditResponse.logs.length === 0}>Export CSV</button>
              </>
            )}
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td className={styles.tableState} colSpan={6}><span role="status">Loading audit log…</span></td></tr>
                ) : auditResponse.logs.length === 0 ? (
                  <tr><td className={styles.tableState} colSpan={6}><strong>No audit entries found</strong><span>Try clearing or broadening the audit filters.</span></td></tr>
                ) : (
                  auditResponse.logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
                      <td>{log.admin_name || log.admin_username || `User ${log.admin_user_id}`}</td>
                      <td>{log.action}</td>
                      <td>{log.target_type || "-"}{log.target_id ? ` #${log.target_id}` : ""}</td>
                      <td>{log.reason || "-"}</td>
                      <td>{log.details ? <details className={styles.auditDetails}><summary>View</summary><pre>{JSON.stringify(log.details, null, 2)}</pre></details> : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
              disabled={auditResponse.page <= 1 || auditLoading}
            >
              Prev
            </button>
            <span className={styles.secondaryText}>Page {auditResponse.page} of {auditResponse.total_pages}</span>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setAuditPage((prev) => Math.min(auditResponse.total_pages, prev + 1))}
              disabled={auditResponse.page >= auditResponse.total_pages || auditLoading}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {activeTab === "changelog" && (
        <section className={`${styles.panel} ${styles.changelogPanel}`}>
          <div className={styles.changelogPanelHeader}>
            <span className={styles.changelogHeaderIcon}><ClipboardList aria-hidden="true" /></span>
            <div className={styles.changelogHeaderCopy}>
              <h3 className={styles.panelTitle}>{editingChangelogVersion ? "Edit Changelog Entry" : "Manage Changelog"}</h3>
              <p>Create or update changelog entries to keep users informed about new features and updates.</p>
            </div>
            <button
              type="button"
              className={styles.historyButton}
              onClick={() => setShowChangelogHistory((current) => !current)}
              aria-expanded={showChangelogHistory}
            >
              <History aria-hidden="true" />
              {showChangelogHistory ? "Hide History" : "View History"}
            </button>
          </div>

          {changelogError && <div className={styles.modalError} role="alert">{changelogError}</div>}

          <div className={styles.changelogFormSection}>
            <div className={styles.changelogFormRow}>
              <label className={styles.formLabel} htmlFor="changelog-version">Version <span aria-hidden="true">*</span></label>
              <input
                id="changelog-version"
                className={styles.formInput}
                type="text"
                value={changelogForm.version}
                onChange={(e) => setChangelogForm({ ...changelogForm, version: e.target.value })}
                disabled={!!editingChangelogVersion}
                placeholder="1.0"
              />
              <p className={styles.formHelper}>The version number for this changelog entry.</p>
            </div>
            <div className={styles.changelogFormRow}>
              <label className={styles.formLabel} htmlFor="changelog-date">Date (YYYY-MM-DD) <span aria-hidden="true">*</span></label>
              <input
                id="changelog-date"
                className={styles.formInput}
                type="date"
                value={changelogForm.date}
                onChange={(e) => setChangelogForm({ ...changelogForm, date: e.target.value })}
                placeholder="2026-07-23"
              />
              <p className={styles.formHelper}>The date this version is being released.</p>
            </div>
            <div className={styles.changelogFormRow}>
              <label className={styles.formLabel} htmlFor="changelog-changes">Changes (one per line) <span aria-hidden="true">*</span></label>
              <textarea
                id="changelog-changes"
                className={styles.formTextarea}
                value={changelogForm.changes}
                onChange={(e) => setChangelogForm({ ...changelogForm, changes: e.target.value })}
                placeholder="Feature A&#10;Bug fix B&#10;Improvement C"
                rows={5}
              />
              <p className={styles.formHelper}>List each change on a new line. These will be displayed to users.</p>
            </div>
            {changelogFormError && <div className={styles.modalError} role="alert">{changelogFormError}</div>}
            <div className={styles.changelogFormActions}>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.primary}`}
                disabled={changelogFormSaving}
                onClick={handleChangelogCreateOrUpdate}
              >
                {!changelogFormSaving && <Plus aria-hidden="true" />}
                {changelogFormSaving ? "Saving..." : editingChangelogVersion ? "Update Entry" : "Create Entry"}
              </button>
              {editingChangelogVersion && (
                <button
                  type="button"
                  className={`${buttonStyles.button} ${buttonStyles.secondary}`}
                  onClick={handleChangelogCancel}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {showChangelogHistory && <div className={styles.changelogHistory}>
            <div className={styles.changelogHistoryTitle}>Changelog History <span>{changelogEntries.length} versions</span></div>
            <div className={styles.changelogList}>
            {changelogLoading ? (
              <div className={styles.placeholder}>Loading changelog...</div>
            ) : changelogEntries.length === 0 ? (
              <div className={styles.placeholder}>No changelog entries yet</div>
            ) : (
              <>
                {changelogEntries.map((entry) => (
                  <div key={entry.id} className={styles.changelogEntry}>
                    <div className={styles.changelogHeader}>
                      <div>
                        <div className={styles.changelogVersion}>v{entry.version}</div>
                        <div className={styles.changelogDate}>{entry.date}</div>
                      </div>
                      <div className={styles.changelogActions}>
                        <button
                          type="button"
                          className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary}`}
                          onClick={() => handleChangelogEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.danger}`}
                          disabled={deletingChangelogVersion === entry.version}
                          onClick={() => handleChangelogDelete(entry.version)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <ul className={styles.changesList}>
                      {entry.changes.map((change: string, idx: number) => (
                        <li key={idx}>{change}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
            </div>
          </div>
          }

          <footer className={styles.changelogTip}>
            <Info aria-hidden="true" />
            <p><strong>Tip:</strong> Keep changelogs clear and concise. Focus on important updates that impact your users.</p>
          </footer>
        </section>
      )}

      {activeTab === "announcements" && (
        <div className={styles.sectionStack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>Create Announcement</h3><span className={styles.panelSubtle}>Publish an in-app pop-up without changing user access.</span></div></div>
            <div className={styles.panelBody}>
              <div className={styles.formRow}><label className={styles.formLabel} htmlFor="announcement-title">Title</label><input id="announcement-title" className={styles.formInput} value={announcementTitle} onChange={event => setAnnouncementTitle(event.target.value)} maxLength={160} /></div>
              <div className={styles.formRow}><label className={styles.formLabel} htmlFor="announcement-message">Message</label><textarea id="announcement-message" className={styles.formTextarea} value={announcementMessage} onChange={event => setAnnouncementMessage(event.target.value)} /></div>
              <div className={styles.announcementOptions}>
                <div className={styles.formRow}><label className={styles.formLabel}>Audience</label><select className={styles.formInput} value={announcementAudience} onChange={event => setAnnouncementAudience(event.target.value as "all" | "admins" | "user")}><option value="all">All users</option><option value="admins">Administrators</option><option value="user">Specific user</option></select></div>
                {announcementAudience === "user" && <div className={styles.formRow}><label className={styles.formLabel}>User</label><select className={styles.formInput} value={announcementUserId} onChange={event => setAnnouncementUserId(event.target.value)}><option value="">Select user</option>{usersResponse.users.map(user => <option value={user.id} key={user.id}>{user.first_name} {user.last_name} (@{user.username})</option>)}</select></div>}
                <div className={styles.formRow}><label className={styles.formLabel}>Initial status</label><select className={styles.formInput} value={announcementStatus} onChange={event => setAnnouncementStatus(event.target.value as "draft" | "active" | "archived")}><option value="draft">Draft</option><option value="active">Active</option></select></div>
              </div>
              <label className={styles.checkboxRow}><input type="checkbox" checked={announcementRequiresAck} onChange={event => setAnnouncementRequiresAck(event.target.checked)} /><span>Require explicit acknowledgment</span></label>
              <div className={styles.changelogFormActions}><button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} disabled={announcementSaving || !announcementTitle.trim() || !announcementMessage.trim() || (announcementAudience === "user" && !announcementUserId)} onClick={() => { void saveAnnouncement(); }}>{announcementSaving ? "Saving…" : "Save Announcement"}</button></div>
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><h3 className={styles.panelTitle}>Announcement History</h3><span className={styles.panelSubtle}>{announcements.length} total</span></div>
            {announcementsLoading ? <div className={styles.placeholder} role="status">Loading announcements…</div> : announcements.length === 0 ? <div className={styles.placeholder}>No announcements have been created.</div> : <div className={styles.announcementList}>{announcements.map(item => <article className={styles.announcementCard} key={item.id}><div className={styles.announcementCardHeader}><div><span className={`${styles.statusPill} ${item.status === "active" ? styles.statusActive : styles.statusDraft}`}>{item.status}</span><strong>{item.title}</strong></div><span>{item.acknowledgment_count} acknowledged</span></div><p>{item.message}</p><div className={styles.announcementCardFooter}><span>Audience: {item.audience_type}{item.requires_acknowledgment ? " · acknowledgment required" : ""}</span><div className={styles.rowActions}>{item.status !== "active" && <button className={styles.actionBtn} type="button" onClick={() => { void updateAnnouncementStatus(item, "active"); }}>Publish</button>}{item.status !== "archived" && <button className={styles.actionBtn} type="button" onClick={() => { void updateAnnouncementStatus(item, "archived"); }}>Archive</button>}</div></div></article>)}</div>}
          </section>
        </div>
      )}

      {activeTab === "operations" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>System Operations</h3><span className={styles.panelSubtle}>Background bracket generation and payout jobs currently observable by the backend</span></div></div>
          {operationsNote && <div className={styles.operationNote}>{operationsNote}</div>}
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Created</th><th>Type</th><th>Status</th><th>Started</th><th>Completed</th><th>Error</th></tr></thead><tbody>{operationsLoading ? <tr><td className={styles.tableState} colSpan={6}><span role="status">Loading operations…</span></td></tr> : operations.length === 0 ? <tr><td className={styles.tableState} colSpan={6}><strong>No recorded operations</strong><span>No background jobs are retained by this backend process.</span></td></tr> : operations.map(operation => <tr key={operation.job_id}><td>{formatAdminTimestamp(operation.created_at, "-")}</td><td>{operation.job_type}</td><td><span className={`${styles.statusPill} ${operation.status === "failed" ? styles.statusDraft : operation.status === "succeeded" ? styles.statusActive : ""}`}>{operation.status}</span></td><td>{formatAdminTimestamp(operation.started_at, "-")}</td><td>{formatAdminTimestamp(operation.completed_at, "-")}</td><td>{operation.error || "-"}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {noteTournament && (
        <div className={styles.modalOverlay} onClick={() => setNoteTournament(null)}>
          <div className={`${styles.modal} ${styles.reviewModal}`} role="dialog" aria-modal="true" aria-label={`Administrative notes for ${noteTournament.name}`} onClick={event => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><h3 className={styles.modalTitle}>Tournament Notes: {noteTournament.name}</h3><div className={styles.secondaryText}>Internal administrator context only</div></div><button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} aria-label="Close tournament notes" onClick={() => setNoteTournament(null)}>×</button></div>
            <div className={styles.modalBody}>
              <section className={styles.reviewSection}><h4>Add note</h4><div className={styles.reviewFormGrid}><select className={styles.formInput} value={tournamentNoteCategory} onChange={event => setTournamentNoteCategory(event.target.value)}><option value="general">General</option><option value="data">Data issue</option><option value="ownership">Ownership question</option><option value="results">Results review</option><option value="support">Support follow-up</option></select></div><textarea className={styles.formTextarea} value={tournamentNoteText} onChange={event => setTournamentNoteText(event.target.value)} placeholder="Add factual context for other administrators…" maxLength={2000} /><div className={styles.reviewFormActions}><button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} disabled={!tournamentNoteText.trim()} onClick={() => { void saveTournamentNote(); }}>Add Note</button></div></section>
              <section className={styles.reviewSection}><h4>Note history</h4>{tournamentNotesLoading ? <div className={styles.reviewEmpty}>Loading notes…</div> : tournamentNotes.length === 0 ? <div className={styles.reviewEmpty}>No internal notes have been added.</div> : <div className={styles.reviewList}>{tournamentNotes.map(note => <article className={styles.reviewItem} key={note.id}><div className={styles.reviewItemHeader}><span className={`${styles.statusPill} ${note.is_resolved ? styles.statusActive : styles.statusDraft}`}>{note.is_resolved ? "Resolved" : "Open"}</span><strong>{note.category}</strong><span>{formatAdminTimestamp(note.created_at, "")}</span></div><p>{note.note}</p><div className={styles.reviewItemFooter}><span>Added by @{note.admin_username}</span><button type="button" className={styles.actionBtn} onClick={() => { void resolveTournamentNote(note.id, !note.is_resolved); }}>{note.is_resolved ? "Reopen" : "Resolve"}</button></div></article>)}</div>}</section>
            </div>
            <div className={styles.modalFooter}><button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setNoteTournament(null)}>Close</button></div>
          </div>
        </div>
      )}

      {reviewUser && (
        <div className={styles.modalOverlay} onClick={() => setReviewUser(null)}>
          <div className={`${styles.modal} ${styles.reviewModal}`} role="dialog" aria-modal="true" aria-label={`Review account ${reviewUser.username}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div><h3 className={styles.modalTitle}>Account Review: {reviewUser.username}</h3><div className={styles.secondaryText}>Observation and internal notes only—this does not change account access.</div></div>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} aria-label="Close account review" onClick={() => setReviewUser(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              {reviewError && <div className={styles.modalError} role="alert">{reviewError}</div>}
              {reviewLoading ? <div className={styles.placeholder} role="status">Loading account activity…</div> : reviewDetail ? (
                <div className={styles.reviewLayout}>
                  <section className={styles.reviewSection}>
                    <h4>Account details</h4>
                    <div className={styles.detailGrid}>
                      <div><strong>Name:</strong> {reviewDetail.user.name}</div><div><strong>Email:</strong> {reviewDetail.user.email}</div>
                      <div><strong>Created:</strong> {formatAdminTimestamp(reviewDetail.user.created_at, "Unknown")}</div><div><strong>Last login:</strong> {formatAdminTimestamp(reviewUser.last_login_at)}</div>
                      <div><strong>Verification:</strong> {reviewDetail.user.email_verified ? formatAdminTimestamp(reviewDetail.user.email_verified_at, "Verified") : "Unverified"}</div>
                      <div><strong>Development notice:</strong> {reviewDetail.user.dev_notice_version_accepted || "Not acknowledged"}</div>
                      <div><strong>Active sessions:</strong> {reviewUser.active_session_count}</div><div><strong>Failed logins:</strong> {reviewUser.failed_login_count}</div>
                    </div>
                  </section>
                  <section className={styles.reviewSection}>
                    <h4>Add internal review item</h4>
                    <div className={styles.reviewFormGrid}>
                      <select className={styles.formInput} aria-label="Review item type" value={reviewKind} onChange={(event) => setReviewKind(event.target.value as "flag" | "note")}><option value="note">Internal note</option><option value="flag">Flag for review</option></select>
                      <select className={styles.formInput} aria-label="Review category" value={reviewCategory} onChange={(event) => setReviewCategory(event.target.value)}><option value="general">General</option><option value="verification">Verification</option><option value="inactive">Inactive</option><option value="duplicate">Possible duplicate</option><option value="suspicious">Suspicious activity</option><option value="fake">Potentially fake</option></select>
                    </div>
                    <textarea className={styles.formTextarea} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Add factual context for other administrators…" maxLength={2000} />
                    <div className={styles.reviewFormActions}><span>{reviewNote.length}/2000</span><button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} disabled={reviewSaving || !reviewNote.trim()} onClick={() => { void saveUserReview(); }}>{reviewSaving ? "Saving…" : reviewKind === "flag" ? "Add Flag" : "Add Note"}</button></div>
                  </section>
                  <section className={styles.reviewSection}>
                    <h4>Review history</h4>
                    {reviewDetail.reviews.length === 0 ? <div className={styles.reviewEmpty}>No flags or internal notes have been added.</div> : <div className={styles.reviewList}>{reviewDetail.reviews.map(item => <article key={item.id} className={styles.reviewItem}><div className={styles.reviewItemHeader}><span className={`${styles.statusPill} ${item.is_resolved ? styles.statusActive : styles.statusDraft}`}>{item.is_resolved ? "Resolved" : item.kind === "flag" ? "Open flag" : "Open note"}</span><strong>{item.category.replace(/_/g, " ")}</strong><span>{formatAdminTimestamp(item.created_at, "")}</span></div><p>{item.note}</p><div className={styles.reviewItemFooter}><span>Added by @{item.admin_username}</span><button type="button" className={styles.actionBtn} onClick={() => { void resolveUserReview(item.id, !item.is_resolved); }}>{item.is_resolved ? "Reopen" : "Resolve"}</button></div></article>)}</div>}
                  </section>
                  <section className={styles.reviewSection}>
                    <h4>Recent login activity</h4>
                    {reviewDetail.sessions.length === 0 ? <div className={styles.reviewEmpty}>No authenticated sessions recorded.</div> : <div className={styles.activityList}>{reviewDetail.sessions.map(session => <div key={session.id} className={styles.activityRow}><div><strong>{session.device_nickname || "Browser session"}</strong><span>{session.region_hint || "Region unavailable"}</span></div><div><span>Last seen {formatAdminTimestamp(session.last_seen_at, "Unknown")}</span><span>Risk {session.risk_score.toFixed(2)} · {session.is_revoked ? "Revoked" : "Active"}</span></div></div>)}</div>}
                  </section>
                  <section className={styles.reviewSection}>
                    <h4>Acknowledgment history</h4>
                    {reviewDetail.acknowledgments.length === 0 ? <div className={styles.reviewEmpty}>No server-recorded acknowledgments.</div> : <div className={styles.activityList}>{reviewDetail.acknowledgments.map(item => <div key={item.id} className={styles.activityRow}><div><strong>{item.content_type.replace(/_/g, " ")}</strong><span>{item.content_id} · version {item.version}</span></div><div><span>{formatAdminTimestamp(item.acknowledged_at, "Unknown")}</span></div></div>)}</div>}
                  </section>
                </div>
              ) : null}
            </div>
            <div className={styles.modalFooter}><button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setReviewUser(null)}>Close</button></div>
          </div>
        </div>
      )}

      {editUser && (
        <div className={styles.modalOverlay} onClick={() => setEditUser(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Edit user ${editUser.username}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit {editUser.username}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setEditUser(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {editError && <div className={styles.modalError} role="alert">{editError}</div>}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>First name</label>
                <input className={styles.formInput} value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Last name</label>
                <input className={styles.formInput} value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Email</label>
                <input className={styles.formInput} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Organization</label>
                <input className={styles.formInput} value={editOrg} onChange={(e) => setEditOrg(e.target.value)} placeholder="None" />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setEditUser(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`}
                disabled={editSaving}
                onClick={async () => {
                  setEditSaving(true);
                  setEditError(null);
                  try {
                    await apiClient.patch(`/api/v1/admin/users/${editUser.id}`, {
                      first_name: editFirstName,
                      last_name: editLastName,
                      email: editEmail,
                      organization: editOrg,
                    });
                    setEditUser(null);
                    await loadUsers(true);
                    await loadAuditLogs(false);
                    showSuccess(`${editUser.username} was updated.`);
                  } catch (err) {
                    setEditError(err instanceof Error ? err.message : "Save failed");
                  } finally {
                    setEditSaving(false);
                  }
                }}
              >
                {editSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetUser && (
        <div className={styles.modalOverlay} onClick={() => setResetUser(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Reset password for ${resetUser.username}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reset password for {resetUser.username}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setResetUser(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {resetError && <div className={styles.modalError} role="alert">{resetError}</div>}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>New password</label>
                <input
                  ref={resetPasswordInputRef}
                  className={styles.formInput}
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setResetUser(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`}
                disabled={resetSaving || resetPassword.length < 8}
                onClick={async () => {
                  setResetSaving(true);
                  setResetError(null);
                  try {
                    await apiClient.post(`/api/v1/admin/users/${resetUser.id}/reset-password`, { new_password: resetPassword });
                    setResetUser(null);
                    await loadAuditLogs(false);
                    showSuccess(`Password reset for ${resetUser.username}.`);
                  } catch (err) {
                    setResetError(err instanceof Error ? err.message : "Reset failed");
                  } finally {
                    setResetSaving(false);
                  }
                }}
              >
                {resetSaving ? "Resetting..." : "Set password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className={styles.modalOverlay} onClick={() => setDeleteUser(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Delete user ${deleteUser.username}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete user {deleteUser.username}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setDeleteUser(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {deleteUserError && <div className={styles.modalError} role="alert">{deleteUserError}</div>}
              <div className={styles.detailCard}>
                <div className={styles.detailNote}>This action is permanent. Type DELETE to confirm.</div>
                {deleteUserPreview && (
                  <div className={styles.detailGrid}>
                    {Object.entries(deleteUserPreview.impact).map(([key, value]) => (
                      <div key={key}><strong>{key.replace(/_/g, " ")}:</strong> {value}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Reason</label>
                <input
                  className={styles.formInput}
                  value={deleteUserReason}
                  onChange={(event) => setDeleteUserReason(event.target.value)}
                  placeholder="Required for audit trail"
                />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Confirm text</label>
                <input
                  className={styles.formInput}
                  value={deleteUserConfirmText}
                  onChange={(event) => setDeleteUserConfirmText(event.target.value)}
                  placeholder="Type DELETE"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setDeleteUser(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.small}`}
                disabled={deleteUserSaving || !deleteUserReason.trim() || deleteUserConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={async () => {
                  if (!deleteUser) return;
                  setDeleteUserSaving(true);
                  setDeleteUserError(null);
                  try {
                    await apiClient.post(`/api/v1/admin/users/${deleteUser.id}/delete`, {
                      reason: deleteUserReason,
                      confirm_text: deleteUserConfirmText,
                    });
                    setDeleteUser(null);
                    await refreshAfterMutation({ overview: true, users: true, audit: true });
                    showSuccess(`${deleteUser.username} was deleted.`);
                  } catch (err) {
                    setDeleteUserError(err instanceof Error ? err.message : "Delete failed");
                  } finally {
                    setDeleteUserSaving(false);
                  }
                }}
              >
                {deleteUserSaving ? "Deleting..." : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTournament && (
        <div className={styles.modalOverlay} onClick={() => setEditTournament(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Edit tournament ${editTournament.name}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Tournament #{editTournament.id}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setEditTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {editTournamentError && <div className={styles.modalError} role="alert">{editTournamentError}</div>}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Name</label>
                <input className={styles.formInput} value={editTournamentName} onChange={(event) => setEditTournamentName(event.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Location</label>
                <input className={styles.formInput} value={editTournamentLocation} onChange={(event) => setEditTournamentLocation(event.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Start date</label>
                <input className={styles.formInput} value={editTournamentStartDate} onChange={(event) => setEditTournamentStartDate(event.target.value)} placeholder="YYYY-MM-DD or custom" />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>End date</label>
                <input className={styles.formInput} value={editTournamentEndDate} onChange={(event) => setEditTournamentEndDate(event.target.value)} placeholder="YYYY-MM-DD or custom" />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setEditTournament(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`}
                disabled={editTournamentSaving}
                onClick={async () => {
                  setEditTournamentSaving(true);
                  setEditTournamentError(null);
                  try {
                    await apiClient.patch(`/api/v1/admin/tournaments/${editTournament.id}`, {
                      name: editTournamentName,
                      location: editTournamentLocation,
                      start_date: editTournamentStartDate,
                      end_date: editTournamentEndDate,
                    });
                    setEditTournament(null);
                    await loadTournaments(true);
                    await loadAuditLogs(false);
                    showSuccess(`${editTournament.name} was updated.`);
                  } catch (err) {
                    setEditTournamentError(err instanceof Error ? err.message : "Failed to update tournament");
                  } finally {
                    setEditTournamentSaving(false);
                  }
                }}
              >
                {editTournamentSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignTournament && (
        <div className={styles.modalOverlay} onClick={() => setReassignTournament(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Reassign tournament ${reassignTournament.name}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reassign Tournament #{reassignTournament.id}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setReassignTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {reassignError && <div className={styles.modalError} role="alert">{reassignError}</div>}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>New owner</label>
                <select className={styles.formInput} value={reassignUserId} onChange={(event) => setReassignUserId(event.target.value)}>
                  <option value="">Select user</option>
                  {usersResponse.users.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.first_name} {user.last_name} (@{user.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setReassignTournament(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`}
                disabled={reassignSaving || !reassignUserId}
                onClick={async () => {
                  setReassignSaving(true);
                  setReassignError(null);
                  try {
                    await apiClient.post(`/api/v1/admin/tournaments/${reassignTournament.id}/reassign`, {
                      new_owner_user_id: Number(reassignUserId),
                    });
                    setReassignTournament(null);
                    await loadTournaments(true);
                    await loadAuditLogs(false);
                    showSuccess(`${reassignTournament.name} was reassigned.`);
                  } catch (err) {
                    setReassignError(err instanceof Error ? err.message : "Failed to reassign tournament");
                  } finally {
                    setReassignSaving(false);
                  }
                }}
              >
                {reassignSaving ? "Saving..." : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveTournament && (
        <div className={styles.modalOverlay} onClick={() => setArchiveTournament(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Archive tournament ${archiveTournament.name}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Archive Tournament #{archiveTournament.id}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setArchiveTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {archiveError && <div className={styles.modalError} role="alert">{archiveError}</div>}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Reason (optional)</label>
                <input className={styles.formInput} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Example: merged into Spring Open 2026" />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setArchiveTournament(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`}
                disabled={archiveSaving}
                onClick={async () => {
                  setArchiveSaving(true);
                  setArchiveError(null);
                  try {
                    await apiClient.post(`/api/v1/admin/tournaments/${archiveTournament.id}/archive`, { reason: archiveReason });
                    setArchiveTournament(null);
                    await refreshAfterMutation({ overview: true, tournaments: true, audit: true });
                    showSuccess(`${archiveTournament.name} was archived.`);
                  } catch (err) {
                    setArchiveError(err instanceof Error ? err.message : "Failed to archive tournament");
                  } finally {
                    setArchiveSaving(false);
                  }
                }}
              >
                {archiveSaving ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTournament && (
        <div className={styles.modalOverlay} onClick={() => setDeleteTournament(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Delete tournament ${deleteTournament.name}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Tournament #{deleteTournament.id}</h3>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setDeleteTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {deleteTournamentError && <div className={styles.modalError} role="alert">{deleteTournamentError}</div>}
              <div className={styles.detailCard}>
                <div className={styles.detailNote}>This action is permanent. Type DELETE to confirm.</div>
                {deleteTournamentPreview && (
                  <>
                    <div className={styles.detailGrid}>
                      {Object.entries(deleteTournamentPreview.impact).map(([key, value]) => (
                        <div key={key}><strong>{key.replace(/_/g, " ")}:</strong> {value}</div>
                      ))}
                    </div>
                    {deleteTournamentPreview.requires_force && (
                      <div className={styles.warnText}>This tournament has score data. Force delete must be enabled.</div>
                    )}
                  </>
                )}
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Reason</label>
                <input className={styles.formInput} value={deleteTournamentReason} onChange={(event) => setDeleteTournamentReason(event.target.value)} placeholder="Required for admin audit trail" />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Confirm text</label>
                <input className={styles.formInput} value={deleteTournamentConfirmText} onChange={(event) => setDeleteTournamentConfirmText(event.target.value)} placeholder="Type DELETE" />
              </div>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={forceDeleteTournament} onChange={(event) => setForceDeleteTournament(event.target.checked)} />
                <span>Force delete even if score data exists</span>
              </label>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setDeleteTournament(null)}>Cancel</button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.small}`}
                disabled={deleteTournamentSaving || !deleteTournamentReason.trim() || deleteTournamentConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={async () => {
                  if (!deleteTournament) return;
                  setDeleteTournamentSaving(true);
                  setDeleteTournamentError(null);
                  try {
                    await apiClient.post(`/api/v1/admin/tournaments/${deleteTournament.id}/delete`, {
                      reason: deleteTournamentReason,
                      force: forceDeleteTournament,
                      confirm_text: deleteTournamentConfirmText,
                    });
                    setDeleteTournament(null);
                    await refreshAfterMutation({ overview: true, tournaments: true, audit: true });
                    showSuccess(`${deleteTournament.name} was deleted.`);
                  } catch (err) {
                    setDeleteTournamentError(err instanceof Error ? err.message : "Failed to delete tournament");
                  } finally {
                    setDeleteTournamentSaving(false);
                  }
                }}
              >
                {deleteTournamentSaving ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
