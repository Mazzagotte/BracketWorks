"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { capitalizeFirstLetter } from "@bracketworks/ui";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardList, History, Info, Plus, Trash2 } from "lucide-react";

import { apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { DataTableToolbar } from "../components/primitives";
import { useToastHelpers } from "../components/Toast";
import { AdminOverviewSection } from "./components/AdminOverviewSection";
import { AdminAuditSection } from "./components/AdminAuditSection";
import { AdminTabNav } from "./components/AdminTabNav";
import { AdminTournamentsSection } from "./components/AdminTournamentsSection";
import { AdminUsersSection } from "./components/AdminUsersSection";
import { useAdminOverviewMetrics } from "./hooks/useAdminOverviewMetrics";
import { adminApi } from "./services/adminApi";
import {
  EMPTY_CHANGELOG_FORM,
  type AdminAnnouncement,
  type AdminFeedbackMessage,
  type AdminChangelogEntry,
  type AdminOperation,
  type AdminSystemHealth,
  type AdminTab,
  type AuditLogsResponse,
  type ChangelogFormState,
  type DeletePreview,
  type OverviewResponse,
  type TablesResponse,
  type TournamentActivityFilter,
  type TournamentNote,
  type TournamentRow,
  type TournamentSortOption,
  type TournamentsResponse,
  type UsersActivityFilter,
  type UsersPageSize,
  type UsersReviewFilter,
  type UsersSortOption,
  type UserReviewDetail,
  type UserRow,
  type UsersResponse,
  type UsersVerificationFilter,
} from "./types";
import { formatAdminTimestamp } from "./utils";
import buttonStyles from "../styles/buttons.module.css";
import styles from "./admin.module.css";

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
  const [usersSort, setUsersSort] = useState<UsersSortOption>("id_asc");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState<UsersPageSize>(25);
  const [usersVerification, setUsersVerification] = useState<UsersVerificationFilter>("all");
  const [usersActivity, setUsersActivity] = useState<UsersActivityFilter>("all");
  const [usersReview, setUsersReview] = useState<UsersReviewFilter>("all");
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
  const [tournamentActivityFilter, setTournamentActivityFilter] = useState<TournamentActivityFilter>("all");
  const [tournamentSort, setTournamentSort] = useState<TournamentSortOption>("newest");
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
  const [deleteConfirmation, setDeleteConfirmation] = useState<
    | { type: "announcement"; announcement: AdminAnnouncement }
    | { type: "changelog"; version: string }
    | null
  >(null);

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
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [feedbackMessages, setFeedbackMessages] = useState<AdminFeedbackMessage[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState<Record<number, string>>({});

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

  const metrics = useAdminOverviewMetrics(overview);
  const currentUserId = currentUser?.id != null ? Number(currentUser.id) : null;

  const loadOverview = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setOverviewLoading(true);
    setError(null);
    try {
      const data = await adminApi.getOverview();
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
      const data = await adminApi.getUsers({
        page: usersPage,
        page_size: usersPageSize,
        search: usersSearch,
        sort: usersSort,
        verification: usersVerification,
        activity: usersActivity,
        review: usersReview,
      });
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
      const detail = await adminApi.getUserReview(user.id);
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
      const data = await adminApi.getTournaments({
        page: tournamentPage,
        page_size: 25,
        search: tournamentSearch,
        activity: tournamentActivityFilter,
        sort: tournamentSort,
      });
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
    try { const data = await adminApi.getTournamentNotes(tournament.id); setTournamentNotes(data.notes); }
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
      const data = await adminApi.getTables({ include_counts: tableIncludeCounts, search: tableSearch, limit: 300 });
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
      const data = await adminApi.getAuditLogs({
        page: auditPage,
        page_size: 25,
        search: auditSearch,
        action: auditAction,
        target_type: auditTargetType,
        admin_user_id: auditAdminUserId,
        date_from: auditDateFrom,
        date_to: auditDateTo,
      });
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
      const data = await adminApi.getChangelog();
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
    try { const data = await adminApi.getAnnouncements(); setAnnouncements(data.announcements); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load announcements"); }
    finally { setAnnouncementsLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const loadOperations = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setOperationsLoading(true); setError(null);
    try { const data = await adminApi.getOperations(); setOperations(data.operations); setOperationsNote(data.note); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load operations"); }
    finally { setOperationsLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const loadSystemHealth = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setSystemHealthLoading(true); setError(null);
    try { setSystemHealth(await adminApi.getSystemHealth()); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load system health"); }
    finally { setSystemHealthLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const loadFeedback = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    setFeedbackLoading(true); setError(null);
    try {
      const data = await adminApi.getFeedback();
      setFeedbackMessages(data.messages);
      setFeedbackNotes(current => Object.fromEntries(data.messages.map(message => [message.id, current[message.id] ?? message.admin_note ?? ""])));
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load messages"); }
    finally { setFeedbackLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const updateFeedback = useCallback(async (message: AdminFeedbackMessage, status: AdminFeedbackMessage["status"]) => {
    try {
      const updated = await adminApi.updateFeedback(message.id, { status, admin_note: feedbackNotes[message.id] || null });
      setFeedbackMessages(current => current.map(item => item.id === updated.id ? updated : item));
      showSuccess("Message updated.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update message"); }
  }, [feedbackNotes, showSuccess]);

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

  const deleteAnnouncement = useCallback(async (announcement: AdminAnnouncement) => {
    setDeleteConfirmation({ type: "announcement", announcement });
  }, []);

  const confirmAnnouncementDelete = useCallback(async (announcement: AdminAnnouncement) => {
    try {
      await adminApi.deleteAnnouncement(announcement.id);
      await loadAnnouncements(false);
      showSuccess("Announcement deleted.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete announcement"); }
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
    if (activeTab === "messages") { await loadFeedback(manual); return; }
    if (activeTab === "operations") { await loadOperations(manual); return; }
    if (activeTab === "health") { await loadSystemHealth(manual); return; }
    await loadAuditLogs(manual);
  }, [activeTab, loadOverview, loadUsers, loadTournaments, loadTables, loadChangelog, loadAuditLogs, loadAnnouncements, loadFeedback, loadOperations, loadSystemHealth]);

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

  const handleToggleUserActive = useCallback(async (user: UserRow) => {
    if (!window.confirm(`${user.is_active ? "Deactivate" : "Reactivate"} ${user.username}?`)) return;
    try {
      await apiClient.post(`/api/v1/admin/users/${user.id}/set-active`, { is_active: !user.is_active });
      await refreshAfterMutation({ users: true, audit: true });
      showSuccess(`${user.username} was ${user.is_active ? "deactivated" : "reactivated"}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update account status"); }
  }, [refreshAfterMutation, showSuccess]);

  const handleChangelogCreateOrUpdate = useCallback(async () => {
    if (!changelogForm.version.trim() || !changelogForm.date.trim()) {
      setChangelogFormError("Version and date are required");
      return;
    }
    const changes = changelogForm.changes.split("\n").map((line) => line.trim()).filter(Boolean);
    const sections = changelogForm.sections.map((section) => ({
      heading: section.heading.trim(),
      items: section.items.map((item) => item.trim()),
    }));
    if (changelogForm.legacy ? changes.length === 0 : (!changelogForm.title.trim() || sections.length === 0 || sections.some((section) => !section.heading || section.items.length === 0 || section.items.some((item) => !item)))) {
      setChangelogFormError(changelogForm.legacy ? "Changes list cannot be empty" : "A title and complete sections with non-empty bullets are required");
      return;
    }
    const content = changelogForm.legacy
      ? { changes }
      : { changes: [], title: changelogForm.title.trim(), summary: changelogForm.summary.trim() || null, sections, tags: changelogForm.tags };

    setChangelogFormSaving(true);
    setChangelogFormError(null);
    try {
      if (editingChangelogVersion) {
        await apiClient.put(`/api/v1/admin/changelog/${editingChangelogVersion}`, {
          date: changelogForm.date.trim(),
          ...content,
        });
      } else {
        await apiClient.post("/api/v1/admin/changelog", {
          version: changelogForm.version.trim(),
          date: changelogForm.date.trim(),
          ...content,
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
    setDeleteConfirmation({ type: "changelog", version });
  }, []);

  const confirmChangelogDelete = useCallback(async (version: string) => {
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
      title: entry.title ?? "",
      summary: entry.summary ?? "",
      sections: entry.sections?.map((section) => ({ ...section, items: [...section.items] })) ?? [],
      tags: entry.tags ?? [],
      legacy: !entry.sections?.length,
    });
  }, []);

  const updateChangelogSection = (index: number, heading: string) => setChangelogForm((form) => ({ ...form, sections: form.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, heading } : section) }));
  const updateChangelogBullet = (sectionIndex: number, itemIndex: number, value: string) => setChangelogForm((form) => ({ ...form, sections: form.sections.map((section, currentSectionIndex) => currentSectionIndex === sectionIndex ? { ...section, items: section.items.map((item, currentItemIndex) => currentItemIndex === itemIndex ? value : item) } : section) }));
  const moveChangelogSection = (index: number, offset: number) => setChangelogForm((form) => { const sections = [...form.sections]; const target = index + offset; const current = sections[index]; const replacement = sections[target]; if (!current || !replacement) return form; sections[index] = replacement; sections[target] = current; return { ...form, sections }; });
  const moveChangelogBullet = (sectionIndex: number, itemIndex: number, offset: number) => setChangelogForm((form) => ({ ...form, sections: form.sections.map((section, index) => { if (index !== sectionIndex) return section; const items = [...section.items]; const target = itemIndex + offset; const current = items[itemIndex]; const replacement = items[target]; if (current === undefined || replacement === undefined) return section; items[itemIndex] = replacement; items[target] = current; return { ...section, items }; }) }));

  const handleChangelogCancel = useCallback(() => {
    setEditingChangelogVersion(null);
    setChangelogForm(EMPTY_CHANGELOG_FORM);
    setChangelogFormError(null);
  }, []);

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
    if (activeTab === "messages") void loadFeedback(false);
    if (activeTab === "operations") void loadOperations(false);
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadAnnouncements, loadFeedback, loadOperations]);

  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated || !currentUser?.isAdmin) return;
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadActiveTab(false);
    }, 30000);
    return () => window.clearInterval(heartbeat);
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadActiveTab]);

  useEffect(() => {
    if (!deleteUser) return;
    let isMounted = true;
    setDeleteUserPreview(null);
    setDeleteUserError(null);
    void adminApi.getUserDeletePreview(deleteUser.id)
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
    void adminApi.getTournamentDeletePreview(deleteTournament.id)
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

  if (!isAuthInitialized || (overviewLoading && !overviewLoaded)) {
    return <div className={styles.stateCard}>Loading admin console...</div>;
  }

  if (!currentUser?.isAdmin) {
    return <div className={styles.stateCard}>Redirecting...</div>;
  }
  return (
    <div className={styles.page}>
      {error && <div className={styles.errorBanner} role="alert">{error}</div>}

      <AdminTabNav
        activeTab={activeTab}
        isDevelopment={isDevelopment}
        onTabChange={setActiveTab}
      />

      {activeTab === "overview" && (
        <AdminOverviewSection overview={overview} metrics={metrics} />
      )}

      {activeTab === "users" && (
        <AdminUsersSection
          usersResponse={usersResponse}
          usersLoading={usersLoading}
          usersSearch={usersSearch}
          usersVerification={usersVerification}
          usersActivity={usersActivity}
          usersReview={usersReview}
          usersSort={usersSort}
          usersPageSize={usersPageSize}
          currentUserId={currentUserId}
          adminRoleSavingUserId={adminRoleSavingUserId}
          onUsersSearchChange={(value) => {
            setUsersSearch(value);
            setUsersPage(1);
          }}
          onUsersVerificationChange={(value) => {
            setUsersVerification(value);
            setUsersPage(1);
          }}
          onUsersActivityChange={(value) => {
            setUsersActivity(value);
            setUsersPage(1);
          }}
          onUsersReviewChange={(value) => {
            setUsersReview(value);
            setUsersPage(1);
          }}
          onUsersSortChange={(value) => {
            setUsersSort(value);
            setUsersPage(1);
          }}
          onUsersPageSizeChange={(value) => {
            setUsersPageSize(value);
            setUsersPage(1);
          }}
          onUsersPageChange={setUsersPage}
          onExportUsersCsv={exportUsersCsv}
          onLoadUserReview={(user) => void loadUserReview(user)}
          onStartEditUser={(user) => {
            setEditUser(user);
            setEditFirstName(user.first_name);
            setEditLastName(user.last_name);
            setEditEmail(user.email);
            setEditOrg(user.organization || "");
            setEditError(null);
          }}
          onStartResetUser={(user) => {
            setResetUser(user);
            setResetPassword("");
            setResetError(null);
            setTimeout(() => resetPasswordInputRef.current?.focus(), 50);
          }}
          onToggleAdminRole={(user) => void handleToggleAdminRole(user)}
          onToggleUserActive={(user) => void handleToggleUserActive(user)}
          onStartDeleteUser={(user) => {
            setDeleteUser(user);
            setDeleteUserReason("");
            setDeleteUserConfirmText("");
            setDeleteUserError(null);
          }}
        />
      )}

      {activeTab === "tournaments" && (
        <AdminTournamentsSection
          tournamentsResponse={tournamentsResponse}
          tournamentsLoading={tournamentsLoading}
          tournamentSearch={tournamentSearch}
          tournamentActivityFilter={tournamentActivityFilter}
          tournamentSort={tournamentSort}
          expandedTournamentIds={expandedTournamentIds}
          onTournamentSearchChange={(value) => {
            setTournamentSearch(value);
            setTournamentPage(1);
          }}
          onTournamentActivityFilterChange={(value) => {
            setTournamentActivityFilter(value);
            setTournamentPage(1);
          }}
          onTournamentSortChange={(value) => {
            setTournamentSort(value);
            setTournamentPage(1);
          }}
          onTournamentPageChange={setTournamentPage}
          onExportTournamentsCsv={exportTournamentsCsv}
          onLoadTournamentNotes={(tournament) => void loadTournamentNotes(tournament)}
          onStartEditTournament={(tournament) => {
            setEditTournament(tournament);
            setEditTournamentName(tournament.name || "");
            setEditTournamentLocation(tournament.location || "");
            setEditTournamentStartDate(tournament.start_date || "");
            setEditTournamentEndDate(tournament.end_date || "");
            setEditTournamentError(null);
          }}
          onStartReassignTournament={(tournament) => {
            setReassignTournament(tournament);
            setReassignUserId("");
            setReassignError(null);
          }}
          onUnarchiveTournament={(tournament) => {
            void (async () => {
              try {
                await apiClient.post(`/api/v1/admin/tournaments/${tournament.id}/unarchive`, {});
                await refreshAfterMutation({ overview: true, tournaments: true, audit: true });
                showSuccess(`${tournament.name} was unarchived.`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to unarchive tournament");
              }
            })();
          }}
          onStartArchiveTournament={(tournament) => {
            setArchiveTournament(tournament);
            setArchiveReason("");
            setArchiveError(null);
          }}
          onStartDeleteTournament={(tournament) => {
            setDeleteTournament(tournament);
            setDeleteTournamentReason("");
            setDeleteTournamentConfirmText("");
            setForceDeleteTournament(false);
            setDeleteTournamentError(null);
          }}
          onToggleTournamentExpanded={(id) => {
            setExpandedTournamentIds((prev) => (
              prev.includes(id)
                ? prev.filter((existingId) => existingId !== id)
                : [...prev, id]
            ));
          }}
        />
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
        <AdminAuditSection
          auditResponse={auditResponse}
          auditLoading={auditLoading}
          auditSearch={auditSearch}
          auditAction={auditAction}
          auditTargetType={auditTargetType}
          auditAdminUserId={auditAdminUserId}
          auditDateFrom={auditDateFrom}
          auditDateTo={auditDateTo}
          adminUsers={usersResponse.users}
          onAuditSearchChange={(value) => {
            setAuditSearch(value);
            setAuditPage(1);
          }}
          onAuditActionChange={(value) => {
            setAuditAction(value);
            setAuditPage(1);
          }}
          onAuditTargetTypeChange={(value) => {
            setAuditTargetType(value);
            setAuditPage(1);
          }}
          onAuditAdminUserIdChange={(value) => {
            setAuditAdminUserId(value);
            setAuditPage(1);
          }}
          onAuditDateFromChange={(value) => {
            setAuditDateFrom(value);
            setAuditPage(1);
          }}
          onAuditDateToChange={(value) => {
            setAuditDateTo(value);
            setAuditPage(1);
          }}
          onAuditPageChange={setAuditPage}
          onExportAuditCsv={exportAuditCsv}
        />
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
            {changelogForm.legacy ? (
              <div className={styles.changelogFormRow}>
                <label className={styles.formLabel} htmlFor="changelog-changes">Legacy changes (one per line) <span aria-hidden="true">*</span></label>
                <textarea id="changelog-changes" className={styles.formTextarea} value={changelogForm.changes} onChange={(e) => setChangelogForm({ ...changelogForm, changes: e.target.value })} rows={5} />
                <p className={styles.formHelper}>This existing entry remains in the legacy bullet-only format.</p>
              </div>
            ) : (
              <>
                <div className={styles.changelogFormRow}>
                  <label className={styles.formLabel} htmlFor="changelog-title-input">Title <span aria-hidden="true">*</span></label>
                  <input id="changelog-title-input" className={styles.formInput} maxLength={120} value={changelogForm.title} onChange={(e) => setChangelogForm({ ...changelogForm, title: e.target.value })} placeholder="Major Tournament Management Update" />
                </div>
                <div className={styles.changelogFormRow}>
                  <label className={styles.formLabel} htmlFor="changelog-summary">Summary</label>
                  <textarea id="changelog-summary" className={styles.formTextarea} maxLength={500} rows={2} value={changelogForm.summary} onChange={(e) => setChangelogForm({ ...changelogForm, summary: e.target.value })} placeholder="A short introduction to this release." />
                </div>
                <fieldset className={styles.changelogTags}>
                  <legend>Tags <span>(optional)</span></legend>
                  {(["New", "Improved", "Fixed", "Security", "Admin", "Reliability"] as const).map((tag) => <label key={tag}><input type="checkbox" checked={changelogForm.tags.includes(tag)} onChange={() => setChangelogForm((form) => ({ ...form, tags: form.tags.includes(tag) ? form.tags.filter((value) => value !== tag) : [...form.tags, tag] }))} />{tag}</label>)}
                </fieldset>
                <div className={styles.changelogSections}>
                  {changelogForm.sections.map((section, sectionIndex) => (
                    <div className={styles.changelogSectionEditor} key={sectionIndex}>
                      <div className={styles.changelogSectionHeader}>
                        <strong>Section {sectionIndex + 1}</strong>
                        <div>
                          <button type="button" aria-label="Move section up" disabled={sectionIndex === 0} onClick={() => moveChangelogSection(sectionIndex, -1)}><ArrowUp /></button>
                          <button type="button" aria-label="Move section down" disabled={sectionIndex === changelogForm.sections.length - 1} onClick={() => moveChangelogSection(sectionIndex, 1)}><ArrowDown /></button>
                          <button type="button" aria-label="Remove section" disabled={changelogForm.sections.length === 1} onClick={() => setChangelogForm((form) => ({ ...form, sections: form.sections.filter((_, index) => index !== sectionIndex) }))}><Trash2 /></button>
                        </div>
                      </div>
                      <input className={styles.formInput} maxLength={80} value={section.heading} onChange={(e) => updateChangelogSection(sectionIndex, e.target.value)} placeholder="Section heading" aria-label={`Section ${sectionIndex + 1} heading`} />
                      <div className={styles.changelogBulletEditors}>
                        {section.items.map((item, itemIndex) => <div key={itemIndex}>
                          <input className={styles.formInput} maxLength={300} value={item} onChange={(e) => updateChangelogBullet(sectionIndex, itemIndex, e.target.value)} placeholder="Bullet item" aria-label={`Section ${sectionIndex + 1} bullet ${itemIndex + 1}`} />
                          <button type="button" aria-label="Move bullet up" disabled={itemIndex === 0} onClick={() => moveChangelogBullet(sectionIndex, itemIndex, -1)}><ArrowUp /></button>
                          <button type="button" aria-label="Move bullet down" disabled={itemIndex === section.items.length - 1} onClick={() => moveChangelogBullet(sectionIndex, itemIndex, 1)}><ArrowDown /></button>
                          <button type="button" aria-label="Remove bullet" disabled={section.items.length === 1} onClick={() => setChangelogForm((form) => ({ ...form, sections: form.sections.map((value, index) => index === sectionIndex ? { ...value, items: value.items.filter((_, current) => current !== itemIndex) } : value) }))}><Trash2 /></button>
                        </div>)}
                      </div>
                      <button type="button" className={styles.changelogAddButton} onClick={() => setChangelogForm((form) => ({ ...form, sections: form.sections.map((value, index) => index === sectionIndex ? { ...value, items: [...value.items, ""] } : value) }))}><Plus /> Add Bullet</button>
                    </div>
                  ))}
                  <button type="button" className={styles.changelogAddButton} onClick={() => setChangelogForm((form) => ({ ...form, sections: [...form.sections, { heading: "", items: [""] }] }))}><Plus /> Add Section</button>
                </div>
              </>
            )}
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
                    {entry.sections?.length ? <div className={styles.historyStructured}><strong>{entry.title}</strong>{entry.sections.map((section, index) => <div key={index}><span>{section.heading}</span><ul className={styles.changesList}>{section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></div>)}</div> : <ul className={styles.changesList}>{entry.changes.map((change, idx) => <li key={idx}>{change}</li>)}</ul>}
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
            {announcementsLoading ? <div className={styles.placeholder} role="status">Loading announcements…</div> : announcements.length === 0 ? <div className={styles.placeholder}>No announcements have been created.</div> : <div className={styles.announcementList}>{announcements.map(item => <article className={styles.announcementCard} key={item.id}><div className={styles.announcementCardHeader}><div><span className={`${styles.statusPill} ${item.status === "active" ? styles.statusActive : styles.statusDraft}`}>{item.status}</span><strong>{item.title}</strong></div><span>{item.acknowledgment_count} acknowledged</span></div><p>{item.message}</p><div className={styles.announcementCardFooter}><span>Audience: {item.audience_type}{item.requires_acknowledgment ? " · acknowledgment required" : ""}</span><div className={styles.rowActions}>{item.status !== "active" && <button className={styles.actionBtn} type="button" onClick={() => { void updateAnnouncementStatus(item, "active"); }}>Publish</button>}{item.status !== "archived" && <button className={styles.actionBtn} type="button" onClick={() => { void updateAnnouncementStatus(item, "archived"); }}>Archive</button>}<button className={styles.actionBtn} type="button" onClick={() => { void deleteAnnouncement(item); }}>Delete</button></div></div></article>)}</div>}
          </section>
        </div>
      )}

      {activeTab === "messages" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>User Messages</h3><span className={styles.panelSubtle}>Problem reports and feature requests from users</span></div><span className={styles.panelSubtle}>{feedbackMessages.filter(message => message.status !== "resolved").length} open</span></div>
          {feedbackLoading ? <div className={styles.placeholder} role="status">Loading messages...</div> : feedbackMessages.length === 0 ? <div className={styles.placeholder}>No user messages have been submitted.</div> : <div className={styles.feedbackList}>{feedbackMessages.map(message => <article className={styles.feedbackCard} key={message.id}><div className={styles.feedbackHeader}><div><span className={`${styles.statusPill} ${message.status === "resolved" ? styles.statusActive : styles.statusDraft}`}>{message.status.replace("_", " ")}</span><span className={styles.feedbackCategory}>{message.category}</span><h4>{message.subject}</h4></div><time dateTime={message.created_at || undefined}>{formatAdminTimestamp(message.created_at, "Unknown")}</time></div><div className={styles.feedbackMeta}>{message.user_name} (@{message.username}) · {message.email}</div><p className={styles.feedbackMessage}>{message.message}</p><textarea className={styles.feedbackNoteInput} aria-label={`Internal note for ${message.subject}`} value={feedbackNotes[message.id] || ""} onChange={event => setFeedbackNotes(current => ({ ...current, [message.id]: event.target.value }))} placeholder="Internal note for administrators" maxLength={5000} /><div className={styles.feedbackFooter}><span>{message.admin_note ? "Internal note saved" : "No internal note"}</span><div className={styles.rowActions}><select className={styles.toolbarSelect} aria-label={`Status for ${message.subject}`} value={message.status} onChange={event => { void updateFeedback(message, event.target.value as AdminFeedbackMessage["status"]); }}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><button type="button" className={styles.actionBtn} onClick={() => { void updateFeedback(message, message.status); }}>Save note</button></div></div></article>)}</div>}
        </section>
      )}

      {activeTab === "operations" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>System Operations</h3><span className={styles.panelSubtle}>Background bracket generation and payout jobs currently observable by the backend</span></div></div>
          {operationsNote && <div className={styles.operationNote}>{operationsNote}</div>}
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Created</th><th>Type</th><th>Status</th><th>Started</th><th>Completed</th><th>Error</th></tr></thead><tbody>{operationsLoading ? <tr><td className={styles.tableState} colSpan={6}><span role="status">Loading operations…</span></td></tr> : operations.length === 0 ? <tr><td className={styles.tableState} colSpan={6}><strong>No recorded operations</strong><span>No background jobs are retained by this backend process.</span></td></tr> : operations.map(operation => <tr key={operation.job_id}><td>{formatAdminTimestamp(operation.created_at, "-")}</td><td>{operation.job_type}</td><td><span className={`${styles.statusPill} ${operation.status === "failed" ? styles.statusDraft : operation.status === "succeeded" ? styles.statusActive : ""}`}>{operation.status}</span></td><td>{formatAdminTimestamp(operation.started_at, "-")}</td><td>{formatAdminTimestamp(operation.completed_at, "-")}</td><td>{operation.error || "-"}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {activeTab === "health" && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>System Health</h3><span className={styles.panelSubtle}>Live operational checks for administrators</span></div><button type="button" className={styles.actionBtn} disabled={systemHealthLoading} onClick={() => void loadSystemHealth(true)}>{systemHealthLoading ? "Checking..." : "Run Checks"}</button></div>
          {systemHealthLoading && !systemHealth ? <div className={styles.placeholder} role="status">Checking services...</div> : systemHealth ? <>
            <div className={styles.healthGrid}>
              {[
                ["Frontend", process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0", "healthy"],
                ["Backend", systemHealth.backend_version, "healthy"],
                ["API", systemHealth.api.status, systemHealth.api.status],
                ["Database", systemHealth.database.status, systemHealth.database.status],
                ["Email", `${systemHealth.email.status} · ${systemHealth.email.provider}`, systemHealth.email.status === "configured" ? "healthy" : "warning"],
                ["Background Jobs", `${systemHealth.background_jobs.running} running · ${systemHealth.background_jobs.failed} failed`, systemHealth.background_jobs.failed ? "unhealthy" : "healthy"],
              ].map(([label, value, tone]) => <div className={styles.healthCard} key={label}><span>{label}</span><strong>{value}</strong><i data-tone={tone}>{tone === "healthy" ? "Operational" : tone === "warning" ? "Attention" : "Issue"}</i></div>)}
            </div>
            <div className={styles.healthMeta}><span>Environment: {systemHealth.environment}</span><span>Process started: {formatAdminTimestamp(systemHealth.process_started_at, "Unknown")}</span><span>Last deployment: {formatAdminTimestamp(systemHealth.last_deployment, "Not reported")}</span><span>Checked: {formatAdminTimestamp(systemHealth.checked_at, "Unknown")}</span></div>
            <div className={styles.panelHeader}><h4 className={styles.panelTitle}>Background Services</h4></div>
            <div className={styles.healthServiceList}>{Object.entries(systemHealth.background_jobs.runtime).map(([name, job]) => <div key={name}><strong>{name.replace(/_/g, " ")}</strong><span>{job.status} · Last run {formatAdminTimestamp(job.last_run_at, "Pending")}</span>{job.last_error && <span className={styles.healthError}>{job.last_error}</span>}</div>)}</div>
            <div className={styles.panelHeader}><h4 className={styles.panelTitle}>Recent Application Errors</h4><span className={styles.panelSubtle}>{systemHealth.recent_errors.length} retained in this process</span></div>
            {systemHealth.recent_errors.length === 0 ? <div className={styles.placeholder}>No recent application errors recorded.</div> : <div className={styles.healthErrorList}>{systemHealth.recent_errors.map((item, index) => <article key={`${item.timestamp}-${index}`}><div><strong>{item.level} · {item.logger}</strong><time>{formatAdminTimestamp(item.timestamp, "Unknown")}</time></div><p>{item.message}</p></article>)}</div>}
          </> : <div className={styles.placeholder}>Health information is unavailable.</div>}
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

      {deleteConfirmation && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmation(null)}>
          <div
            className={`${styles.modal} ${styles.compactModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 id="delete-confirmation-title" className={styles.modalTitle}>Confirm deletion</h3>
                <div className={styles.secondaryText}>This action cannot be undone.</div>
              </div>
              <button
                type="button"
                aria-label="Close delete confirmation"
                className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`}
                onClick={() => setDeleteConfirmation(null)}
              >
                X
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.confirmationMessage}>
                Delete {deleteConfirmation.type === "announcement" ? "announcement" : "changelog entry"}{" "}
                <strong>
                  {deleteConfirmation.type === "announcement"
                    ? deleteConfirmation.announcement.title
                    : `version ${deleteConfirmation.version}`}
                </strong>
                ?
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`}
                onClick={() => setDeleteConfirmation(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.small}`}
                onClick={() => {
                  const confirmation = deleteConfirmation;
                  setDeleteConfirmation(null);
                  if (confirmation.type === "announcement") {
                    void confirmAnnouncementDelete(confirmation.announcement);
                  } else {
                    void confirmChangelogDelete(confirmation.version);
                  }
                }}
              >
                Delete
              </button>
            </div>
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
                      <div><strong>Status:</strong> {reviewDetail.user.is_active ? "Active" : "Inactive"}</div><div><strong>Created:</strong> {formatAdminTimestamp(reviewDetail.user.created_at, "Unknown")}</div>
                      <div><strong>Last login:</strong> {formatAdminTimestamp(reviewDetail.user.last_login_at, "Never")}</div><div><strong>Last activity:</strong> {formatAdminTimestamp(reviewDetail.user.last_activity_at, "Never")}</div>
                      <div><strong>Verification:</strong> {reviewDetail.user.email_verified ? formatAdminTimestamp(reviewDetail.user.email_verified_at, "Verified") : "Unverified"}</div>
                      <div><strong>Development notice:</strong> {reviewDetail.user.dev_notice_version_accepted || "Not acknowledged"}</div>
                      <div><strong>Active sessions:</strong> {reviewUser.active_session_count}</div><div><strong>Failed logins:</strong> {reviewUser.failed_login_count}</div>
                    </div>
                  </section>
                  <section className={styles.reviewSection}>
                    <h4>Owned tournaments</h4>
                    {reviewDetail.owned_tournaments.length === 0 ? <div className={styles.reviewEmpty}>No owned tournaments.</div> : <div className={styles.activityList}>{reviewDetail.owned_tournaments.map(item => <div className={styles.activityRow} key={item.id}><div><strong>{item.name}</strong><span>Tournament #{item.id}</span></div><span>{item.lifecycle_status.replace(/_/g, " ")}</span></div>)}</div>}
                  </section>
                  <section className={styles.reviewSection}>
                    <h4>Staff memberships</h4>
                    {reviewDetail.staff_memberships.length === 0 ? <div className={styles.reviewEmpty}>No tournament staff memberships.</div> : <div className={styles.activityList}>{reviewDetail.staff_memberships.map(item => <div className={styles.activityRow} key={item.tournament_id}><div><strong>{item.tournament_name}</strong><span>Tournament #{item.tournament_id}</span></div><div><span>{item.role.replace(/_/g, " ")}</span><span>Since {formatAdminTimestamp(item.created_at, "Unknown")}</span></div></div>)}</div>}
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
              <button type="button" aria-label="Close edit user dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setEditUser(null)}>X</button>
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
              <button type="button" aria-label="Close password reset dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setResetUser(null)}>X</button>
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
              <button type="button" aria-label="Close delete user dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setDeleteUser(null)}>X</button>
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
              <button type="button" aria-label="Close edit tournament dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setEditTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {editTournamentError && <div className={styles.modalError} role="alert">{editTournamentError}</div>}
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Name</label>
                <input className={styles.formInput} value={editTournamentName} onChange={(event) => setEditTournamentName(capitalizeFirstLetter(event.target.value))} />
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Location</label>
                <input className={styles.formInput} value={editTournamentLocation} onChange={(event) => setEditTournamentLocation(capitalizeFirstLetter(event.target.value))} />
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
              <button type="button" aria-label="Close reassign tournament dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setReassignTournament(null)}>X</button>
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
              <button type="button" aria-label="Close archive tournament dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setArchiveTournament(null)}>X</button>
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
              <button type="button" aria-label="Close delete tournament dialog" className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary} ${styles.modalClose}`} onClick={() => setDeleteTournament(null)}>X</button>
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
