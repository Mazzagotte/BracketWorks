"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormGrid,
  ICON_SIZE,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  Notice,
  Page,
  PageHeader,
  PasswordField,
  SelectField,
  TextAreaField,
  TextField,
  capitalizeFirstLetter,
} from "@bracketworks/ui";
import type { StatusTone } from "@bracketworks/ui";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowUp, History, MoreHorizontal, Plus, Send, Trash2 } from "lucide-react";

import { apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToastHelpers } from "../components/Toast";
import { AdminOverviewSection } from "./components/AdminOverviewSection";
import { AdminAuditSection } from "./components/AdminAuditSection";
import { AdminBowlersSection } from "./components/AdminBowlersSection";
import { AdminDetail } from "./components/AdminDetail";
import { AdminTabNav } from "./components/AdminTabNav";
import { AdminTournamentsSection } from "./components/AdminTournamentsSection";
import { AdminUsersSection } from "./components/AdminUsersSection";
import { useAdminOverviewMetrics } from "./hooks/useAdminOverviewMetrics";
import { adminApi } from "./services/adminApi";
import { subscribeToDataChanges } from "../lib/api/dataChanges";
import {
  EMPTY_CHANGELOG_FORM,
  type AdminAnnouncement,
  type AdminAnnouncementAcknowledgment,
  type AdminFeedbackMessage,
  type AdminChangelogEntry,
  type AdminTab,
  type AuditLogsResponse,
  type ChangelogFormState,
  type DeletePreview,
  type OverviewResponse,
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
import styles from "./admin.module.css";

const CHANGELOG_TAGS = ["New", "Improved", "Fixed", "Security", "Admin", "Reliability"] as const;

const FEEDBACK_STATUS_TONE: Record<string, StatusTone> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
};

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, isUserAuthenticated, isAuthInitialized } = useAuth();
  const { success: showSuccess } = useToastHelpers();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [usersResponse, setUsersResponse] = useState<UsersResponse>({ users: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
  const [usersLoading, setUsersLoading] = useState(false);
  const usersLoadedRef = useRef(false);
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
  const tournamentsLoadedRef = useRef(false);
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

  const [auditResponse, setAuditResponse] = useState<AuditLogsResponse>({ logs: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
  const [auditLoading, setAuditLoading] = useState(false);
  const auditLoadedRef = useRef(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditTargetType, setAuditTargetType] = useState("");
  const [auditAdminUserId, setAuditAdminUserId] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditPage, setAuditPage] = useState(1);

  const [changelogEntries, setChangelogEntries] = useState<AdminChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const changelogLoadedRef = useRef(false);
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
  const announcementsLoadedRef = useRef(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState<"all" | "admins" | "user">("all");
  const [announcementUserId, setAnnouncementUserId] = useState("");
  const [announcementUsers, setAnnouncementUsers] = useState<UserRow[]>([]);
  const [announcementUsersLoading, setAnnouncementUsersLoading] = useState(false);
  const [announcementUsersError, setAnnouncementUsersError] = useState<string | null>(null);
  const announcementUsersLoadedRef = useRef(false);
  const announcementUsersRequestRef = useRef(false);
  const [announcementStatus, setAnnouncementStatus] = useState<"draft" | "active" | "archived">("draft");
  const [announcementRequiresAck, setAnnouncementRequiresAck] = useState(false);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [acknowledgedAnnouncement, setAcknowledgedAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [acknowledgmentUsers, setAcknowledgmentUsers] = useState<AdminAnnouncementAcknowledgment[]>([]);
  const [acknowledgmentsLoading, setAcknowledgmentsLoading] = useState(false);
  const [acknowledgmentsError, setAcknowledgmentsError] = useState<string | null>(null);
  const acknowledgmentRequestIdRef = useRef(0);
  const [feedbackMessages, setFeedbackMessages] = useState<AdminFeedbackMessage[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const feedbackLoadedRef = useRef(false);
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
  const [accountConfirm, setAccountConfirm] = useState<{ kind: "role" | "active"; user: UserRow } | null>(null);
  const [accountConfirmBusy, setAccountConfirmBusy] = useState(false);

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
    if (!usersLoadedRef.current) setUsersLoading(true);
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
      usersLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin, usersPage, usersPageSize, usersSearch, usersSort, usersVerification, usersActivity, usersReview]);

  const loadAnnouncementUsers = useCallback(async () => {
    if (!currentUser?.isAdmin || announcementUsersLoadedRef.current || announcementUsersRequestRef.current) return;
    announcementUsersRequestRef.current = true;
    setAnnouncementUsersLoading(true);
    setAnnouncementUsersError(null);
    try {
      const response = await adminApi.getUsers({
        page: 1,
        page_size: 200,
        search: "",
        sort: "name_asc",
        verification: "all",
        activity: "all",
        review: "all",
      });
      setAnnouncementUsers(response.users);
      announcementUsersLoadedRef.current = true;
    } catch (err) {
      setAnnouncementUsersError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      announcementUsersRequestRef.current = false;
      setAnnouncementUsersLoading(false);
    }
  }, [currentUser?.isAdmin]);

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
    if (!tournamentsLoadedRef.current) setTournamentsLoading(true);
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
      tournamentsLoadedRef.current = true;
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

  const loadAuditLogs = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    if (!auditLoadedRef.current) setAuditLoading(true);
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
      auditLoadedRef.current = true;
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
    if (!changelogLoadedRef.current) setChangelogLoading(true);
    setChangelogError(null);
    try {
      const data = await adminApi.getChangelog();
      setChangelogEntries(data.entries);
      changelogLoadedRef.current = true;
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
    if (!announcementsLoadedRef.current) setAnnouncementsLoading(true); setError(null);
    try { const data = await adminApi.getAnnouncements(); setAnnouncements(data.announcements); announcementsLoadedRef.current = true; }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load announcements"); }
    finally { setAnnouncementsLoading(false); if (manual) setRefreshing(false); }
  }, [currentUser?.isAdmin]);

  const loadFeedback = useCallback(async (manual = false) => {
    if (!currentUser?.isAdmin) return;
    if (manual) setRefreshing(true);
    if (!feedbackLoadedRef.current) setFeedbackLoading(true); setError(null);
    try {
      const data = await adminApi.getFeedback();
      setFeedbackMessages(data.messages);
      feedbackLoadedRef.current = true;
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

  const closeAcknowledgmentDialog = useCallback(() => {
    acknowledgmentRequestIdRef.current += 1;
    setAcknowledgedAnnouncement(null);
    setAcknowledgmentsLoading(false);
  }, []);

  const openAcknowledgmentDialog = useCallback(async (announcement: AdminAnnouncement) => {
    const requestId = ++acknowledgmentRequestIdRef.current;
    setAcknowledgedAnnouncement(announcement);
    setAcknowledgmentUsers([]);
    setAcknowledgmentsError(null);
    setAcknowledgmentsLoading(true);
    try {
      const data = await adminApi.getAnnouncementAcknowledgments(announcement.id);
      if (requestId === acknowledgmentRequestIdRef.current) setAcknowledgmentUsers(data.users);
    } catch (err) {
      if (requestId === acknowledgmentRequestIdRef.current) {
        setAcknowledgmentsError(err instanceof Error ? err.message : "Failed to load acknowledgments");
      }
    } finally {
      if (requestId === acknowledgmentRequestIdRef.current) setAcknowledgmentsLoading(false);
    }
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
    if (activeTab === "bowlers") return;
    if (activeTab === "changelog") {
      await loadChangelog(manual);
      return;
    }
    if (activeTab === "announcements") { await loadAnnouncements(manual); return; }
    if (activeTab === "messages") { await loadFeedback(manual); return; }
    await loadAuditLogs(manual);
  }, [activeTab, loadOverview, loadUsers, loadTournaments, loadChangelog, loadAuditLogs, loadAnnouncements, loadFeedback]);

  const refreshAfterMutation = useCallback(async ({
    overview = false,
    users = false,
    tournaments = false,
    audit = false,
    changelog = false,
  }: {
    overview?: boolean;
    users?: boolean;
    tournaments?: boolean;
    audit?: boolean;
    changelog?: boolean;
  }) => {
    const refreshTasks: Promise<unknown>[] = [];
    if (overview) refreshTasks.push(loadOverview(false));
    if (users) refreshTasks.push(loadUsers(false));
    if (tournaments) refreshTasks.push(loadTournaments(false));
    if (audit) refreshTasks.push(loadAuditLogs(false));
    if (changelog) refreshTasks.push(loadChangelog(false));
    await Promise.allSettled(refreshTasks);
  }, [loadOverview, loadUsers, loadTournaments, loadAuditLogs, loadChangelog]);

  const handleToggleAdminRole = useCallback(async (user: UserRow) => {
    const nextIsAdmin = !user.is_admin;
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
  }, [activeTab, isAuthInitialized, isUserAuthenticated, currentUser?.isAdmin, loadAnnouncements, loadFeedback]);

  useEffect(() => {
    if (activeTab === "announcements" && announcementAudience === "user") {
      void loadAnnouncementUsers();
    }
  }, [activeTab, announcementAudience, loadAnnouncementUsers]);

  useEffect(() => subscribeToDataChanges(['admin', 'tournaments', 'squads', 'settings', 'bowlers', 'scores', 'brackets', 'payouts'], () => {
    if (document.visibilityState === "visible") void loadActiveTab(false);
  }), [loadActiveTab]);

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

  const confirmAccountChange = async () => {
    if (!accountConfirm) return;
    setAccountConfirmBusy(true);
    try {
      if (accountConfirm.kind === "role") await handleToggleAdminRole(accountConfirm.user);
      else await handleToggleUserActive(accountConfirm.user);
    } finally {
      setAccountConfirmBusy(false);
      setAccountConfirm(null);
    }
  };

  const accountConfirmCopy = (() => {
    if (!accountConfirm) return null;
    const { kind, user } = accountConfirm;
    if (kind === "role") {
      return user.is_admin
        ? { title: `Revoke admin privileges from ${user.username}?`, description: "They will lose access to the admin console.", confirmLabel: "Revoke admin", tone: "danger" as const }
        : { title: `Grant admin privileges to ${user.username}?`, description: "Administrators can manage every account and tournament in the admin console.", confirmLabel: "Grant admin", tone: "default" as const };
    }
    return user.is_active
      ? { title: `Deactivate ${user.username}?`, description: "They will not be able to sign in until the account is reactivated.", confirmLabel: "Deactivate", tone: "danger" as const }
      : { title: `Reactivate ${user.username}?`, description: "They will be able to sign in again.", confirmLabel: "Reactivate", tone: "default" as const };
  })();

  if (!isAuthInitialized || (overviewLoading && !overviewLoaded)) {
    return <Page><p className={styles.stateText} role="status">Loading admin console...</p></Page>;
  }

  if (!currentUser?.isAdmin) {
    return <Page><p className={styles.stateText} role="status">Redirecting...</p></Page>;
  }

  const openFeedbackCount = feedbackMessages.filter(message => message.status !== "resolved").length;

  return (
    <Page>
      <PageHeader title="Admin" description="Manage accounts, tournaments, bowler profiles, and messages to users." />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}

      <AdminTabNav
        activeTab={activeTab}
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
          onToggleAdminRole={(user) => setAccountConfirm({ kind: "role", user })}
          onToggleUserActive={(user) => setAccountConfirm({ kind: "active", user })}
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

      {activeTab === "bowlers" && (
        <AdminBowlersSection onSuccess={showSuccess} />
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
        <Card aria-label="Changelog">
          <CardHeader
            title={editingChangelogVersion ? "Edit changelog entry" : "Manage changelog"}
            description="Create or update changelog entries so users hear about new features and fixes. Keep entries clear and focused on changes that affect users."
            actions={(
              <Button
                variant="secondary"
                icon={<History size={ICON_SIZE.md} aria-hidden="true" />}
                onClick={() => setShowChangelogHistory((current) => !current)}
                aria-expanded={showChangelogHistory}
              >
                {showChangelogHistory ? "Hide history" : "View history"}
              </Button>
            )}
          />

          {changelogError ? <Notice tone="danger" role="alert">{changelogError}</Notice> : null}

          <FormGrid>
            <TextField
              id="changelog-version"
              label="Version"
              value={changelogForm.version}
              onChange={(e) => setChangelogForm({ ...changelogForm, version: e.target.value })}
              disabled={!!editingChangelogVersion}
              placeholder="1.0"
              helper="The version number for this changelog entry."
            />
            <TextField
              id="changelog-date"
              label="Date"
              type="date"
              value={changelogForm.date}
              onChange={(e) => setChangelogForm({ ...changelogForm, date: e.target.value })}
              helper="The date this version is released."
            />
            {changelogForm.legacy ? (
              <TextAreaField
                id="changelog-changes"
                label="Legacy changes (one per line)"
                fullRow
                rows={5}
                value={changelogForm.changes}
                onChange={(e) => setChangelogForm({ ...changelogForm, changes: e.target.value })}
                helper="This existing entry stays in the legacy bullet-only format."
              />
            ) : (
              <>
                <TextField
                  id="changelog-title-input"
                  label="Title"
                  fullRow
                  maxLength={120}
                  value={changelogForm.title}
                  onChange={(e) => setChangelogForm({ ...changelogForm, title: e.target.value })}
                  placeholder="Major tournament management update"
                />
                <TextAreaField
                  id="changelog-summary"
                  label="Summary"
                  optional
                  fullRow
                  maxLength={500}
                  rows={2}
                  value={changelogForm.summary}
                  onChange={(e) => setChangelogForm({ ...changelogForm, summary: e.target.value })}
                  placeholder="A short introduction to this release."
                />
              </>
            )}
          </FormGrid>

          {!changelogForm.legacy ? (
            <>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Tags <span className={styles.optional}>(optional)</span></legend>
                {CHANGELOG_TAGS.map((tag) => (
                  <CheckboxField
                    key={tag}
                    label={tag}
                    checked={changelogForm.tags.includes(tag)}
                    onChange={() => setChangelogForm((form) => ({ ...form, tags: form.tags.includes(tag) ? form.tags.filter((value) => value !== tag) : [...form.tags, tag] }))}
                  />
                ))}
              </fieldset>

              {changelogForm.sections.map((section, sectionIndex) => (
                <Fragment key={sectionIndex}>
                  <CardDivider />
                  <div className={styles.group}>
                    <div className={styles.groupHeader}>
                      <h3 className={styles.subsectionTitle}>Section {sectionIndex + 1}</h3>
                      <div className={styles.iconButtons}>
                        <Button variant="ghost" size="sm" iconOnly aria-label={`Move section ${sectionIndex + 1} up`} disabled={sectionIndex === 0} onClick={() => moveChangelogSection(sectionIndex, -1)} icon={<ArrowUp size={ICON_SIZE.md} />} />
                        <Button variant="ghost" size="sm" iconOnly aria-label={`Move section ${sectionIndex + 1} down`} disabled={sectionIndex === changelogForm.sections.length - 1} onClick={() => moveChangelogSection(sectionIndex, 1)} icon={<ArrowDown size={ICON_SIZE.md} />} />
                        <Button variant="ghost-danger" size="sm" iconOnly aria-label={`Remove section ${sectionIndex + 1}`} disabled={changelogForm.sections.length === 1} onClick={() => setChangelogForm((form) => ({ ...form, sections: form.sections.filter((_, index) => index !== sectionIndex) }))} icon={<Trash2 size={ICON_SIZE.md} />} />
                      </div>
                    </div>
                    <TextField
                      label="Section heading"
                      maxLength={80}
                      value={section.heading}
                      onChange={(e) => updateChangelogSection(sectionIndex, e.target.value)}
                      placeholder="Section heading"
                    />
                    {section.items.map((item, itemIndex) => (
                      <div className={styles.bulletRow} key={itemIndex}>
                        <TextField
                          label={`Bullet ${itemIndex + 1}`}
                          maxLength={300}
                          value={item}
                          onChange={(e) => updateChangelogBullet(sectionIndex, itemIndex, e.target.value)}
                          placeholder="Bullet item"
                          aria-label={`Section ${sectionIndex + 1} bullet ${itemIndex + 1}`}
                        />
                        <div className={styles.iconButtons}>
                          <Button variant="ghost" iconOnly aria-label="Move bullet up" disabled={itemIndex === 0} onClick={() => moveChangelogBullet(sectionIndex, itemIndex, -1)} icon={<ArrowUp size={ICON_SIZE.md} />} />
                          <Button variant="ghost" iconOnly aria-label="Move bullet down" disabled={itemIndex === section.items.length - 1} onClick={() => moveChangelogBullet(sectionIndex, itemIndex, 1)} icon={<ArrowDown size={ICON_SIZE.md} />} />
                          <Button variant="ghost-danger" iconOnly aria-label="Remove bullet" disabled={section.items.length === 1} onClick={() => setChangelogForm((form) => ({ ...form, sections: form.sections.map((value, index) => index === sectionIndex ? { ...value, items: value.items.filter((_, current) => current !== itemIndex) } : value) }))} icon={<Trash2 size={ICON_SIZE.md} />} />
                        </div>
                      </div>
                    ))}
                    <div>
                      <Button variant="secondary" size="sm" icon={<Plus size={ICON_SIZE.md} />} onClick={() => setChangelogForm((form) => ({ ...form, sections: form.sections.map((value, index) => index === sectionIndex ? { ...value, items: [...value.items, ""] } : value) }))}>
                        Add bullet
                      </Button>
                    </div>
                  </div>
                </Fragment>
              ))}
              <CardDivider />
              <div>
                <Button variant="secondary" size="sm" icon={<Plus size={ICON_SIZE.md} />} onClick={() => setChangelogForm((form) => ({ ...form, sections: [...form.sections, { heading: "", items: [""] }] }))}>
                  Add section
                </Button>
              </div>
            </>
          ) : null}

          {changelogFormError ? <Notice tone="danger" role="alert">{changelogFormError}</Notice> : null}
          <div className={styles.formActions}>
            {editingChangelogVersion ? (
              <Button variant="secondary" onClick={handleChangelogCancel}>Cancel</Button>
            ) : null}
            <Button
              variant="primary"
              disabled={changelogFormSaving}
              icon={changelogFormSaving || editingChangelogVersion ? undefined : <Plus size={ICON_SIZE.md} />}
              onClick={handleChangelogCreateOrUpdate}
            >
              {changelogFormSaving ? "Saving..." : editingChangelogVersion ? "Update entry" : "Create entry"}
            </Button>
          </div>

          {showChangelogHistory ? (
            <>
              <CardDivider />
              <div className={styles.group}>
                <div className={styles.groupHeader}>
                  <h3 className={styles.subsectionTitle}>Changelog history</h3>
                  <span className={styles.helper}>{changelogEntries.length} versions</span>
                </div>
                {changelogLoading ? (
                  <p className={styles.helper} role="status">Loading changelog...</p>
                ) : changelogEntries.length === 0 ? (
                  <p className={styles.helper}>No changelog entries yet.</p>
                ) : (
                  <ul className={styles.rows}>
                    {changelogEntries.map((entry) => (
                      <li key={entry.id} className={styles.rowStack}>
                        <div className={styles.row}>
                          <div className={styles.rowText}>
                            <span className={styles.rowTitle}>Version {entry.version}{entry.title ? ` · ${entry.title}` : ""}</span>
                            <span className={styles.rowMeta}>{entry.date}</span>
                          </div>
                          <div className={styles.rowActions}>
                            <Button variant="secondary" size="sm" onClick={() => handleChangelogEdit(entry)} aria-label={`Edit version ${entry.version}`}>
                              Edit
                            </Button>
                            <Menu triggerLabel={`More actions for version ${entry.version}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                              <MenuItem
                                tone="danger"
                                icon={<Trash2 size={ICON_SIZE.md} />}
                                disabled={deletingChangelogVersion === entry.version}
                                onSelect={() => handleChangelogDelete(entry.version)}
                              >
                                Delete entry
                              </MenuItem>
                            </Menu>
                          </div>
                        </div>
                        {entry.sections?.length ? (
                          entry.sections.map((section, index) => (
                            <div key={index} className={styles.group}>
                              <span className={styles.subsectionTitle}>{section.heading}</span>
                              <ul className={styles.list}>{section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
                            </div>
                          ))
                        ) : (
                          <ul className={styles.list}>{entry.changes.map((change, idx) => <li key={idx}>{change}</li>)}</ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </Card>
      )}

      {activeTab === "announcements" && (
        <>
          <Card aria-label="Create announcement">
            <CardHeader title="Create announcement" description="Publish an in-app pop-up without changing user access." />
            <FormGrid>
              <TextField id="announcement-title" label="Title" fullRow value={announcementTitle} onChange={event => setAnnouncementTitle(event.target.value)} maxLength={160} />
              <TextAreaField id="announcement-message" label="Message" fullRow value={announcementMessage} onChange={event => setAnnouncementMessage(event.target.value)} />
              <SelectField
                id="announcement-audience"
                label="Audience"
                value={announcementAudience}
                onChange={event => { setAnnouncementAudience(event.target.value as "all" | "admins" | "user"); setAnnouncementUserId(""); }}
              >
                <option value="all">All users</option>
                <option value="admins">Administrators</option>
                <option value="user">Specific user</option>
              </SelectField>
              <SelectField id="announcement-status" label="Initial status" value={announcementStatus} onChange={event => setAnnouncementStatus(event.target.value as "draft" | "active" | "archived")}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </SelectField>
              {announcementAudience === "user" ? (
                <SelectField
                  id="announcement-user"
                  label="User"
                  fullRow
                  value={announcementUserId}
                  onChange={event => setAnnouncementUserId(event.target.value)}
                  disabled={announcementUsersLoading || announcementUsers.length === 0}
                >
                  <option value="">{announcementUsersLoading ? "Loading users..." : announcementUsersError ? "Unable to load users" : announcementUsers.length === 0 ? "No users available" : "Select user"}</option>
                  {announcementUsers.map(user => <option value={user.id} key={user.id}>{user.first_name} {user.last_name} (@{user.username})</option>)}
                </SelectField>
              ) : null}
            </FormGrid>
            {announcementAudience === "user" && announcementUsersError ? (
              <Notice tone="danger" role="alert" action={<Button variant="ghost" size="sm" onClick={() => void loadAnnouncementUsers()}>Retry</Button>}>
                {announcementUsersError}
              </Notice>
            ) : null}
            <CheckboxField label="Require explicit acknowledgment" checked={announcementRequiresAck} onChange={event => setAnnouncementRequiresAck(event.target.checked)} />
            <div className={styles.formActions}>
              <Button
                variant="primary"
                disabled={announcementSaving || !announcementTitle.trim() || !announcementMessage.trim() || (announcementAudience === "user" && !announcementUserId)}
                onClick={() => { void saveAnnouncement(); }}
              >
                {announcementSaving ? "Saving..." : "Save announcement"}
              </Button>
            </div>
          </Card>

          <Card aria-label="Announcement history">
            <CardHeader title="Announcement history" description={`${announcements.length} total`} />
            {announcementsLoading ? (
              <p className={styles.helper} role="status">Loading announcements...</p>
            ) : announcements.length === 0 ? (
              <EmptyState title="No announcements yet" description="Announcements you create appear here." />
            ) : (
              <ul className={styles.rows}>
                {announcements.map(item => (
                  <li className={styles.rowStack} key={item.id}>
                    <div className={styles.row}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>
                          {item.title}
                          <Badge tone={item.status === "active" ? "success" : "neutral"}>{capitalizeFirstLetter(item.status)}</Badge>
                        </span>
                        <span className={styles.rowMeta}>
                          Audience: {item.audience_type}{item.requires_acknowledgment ? " · acknowledgment required" : ""}
                        </span>
                      </div>
                      <div className={styles.rowActions}>
                        <Button variant="secondary" size="sm" onClick={() => { void openAcknowledgmentDialog(item); }}>
                          View acknowledged ({item.acknowledgment_count})
                        </Button>
                        <Menu triggerLabel={`More actions for ${item.title}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                          {item.status !== "active" ? (
                            <MenuItem icon={<Send size={ICON_SIZE.md} />} onSelect={() => { void updateAnnouncementStatus(item, "active"); }}>Publish</MenuItem>
                          ) : null}
                          {item.status !== "archived" ? (
                            <MenuItem icon={<Archive size={ICON_SIZE.md} />} onSelect={() => { void updateAnnouncementStatus(item, "archived"); }}>Archive</MenuItem>
                          ) : null}
                          <MenuDivider />
                          <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => { void deleteAnnouncement(item); }}>Delete announcement</MenuItem>
                        </Menu>
                      </div>
                    </div>
                    <p className={styles.rowBody}>{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {activeTab === "messages" && (
        <Card aria-label="User messages">
          <CardHeader title="User messages" description={`Problem reports and feature requests from users · ${openFeedbackCount} open`} />
          {feedbackLoading ? (
            <p className={styles.helper} role="status">Loading messages...</p>
          ) : feedbackMessages.length === 0 ? (
            <EmptyState title="No messages yet" description="No user messages have been submitted." />
          ) : (
            <ul className={styles.rows}>
              {feedbackMessages.map(message => (
                <li className={styles.rowStack} key={message.id}>
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={styles.rowTitle}>
                        {message.subject}
                        <Badge tone={FEEDBACK_STATUS_TONE[message.status] ?? "neutral"}>{capitalizeFirstLetter(message.status.replace("_", " "))}</Badge>
                      </span>
                      <span className={styles.rowMeta}>
                        {capitalizeFirstLetter(message.category.replace(/_/g, " "))} · {message.user_name} (@{message.username}) · {message.email}
                      </span>
                    </div>
                    <time className={styles.rowMeta} dateTime={message.created_at || undefined}>{formatAdminTimestamp(message.created_at, "Unknown")}</time>
                  </div>
                  <p className={styles.rowBody}>{message.message}</p>
                  <TextAreaField
                    label="Internal note"
                    optional
                    value={feedbackNotes[message.id] || ""}
                    onChange={event => setFeedbackNotes(current => ({ ...current, [message.id]: event.target.value }))}
                    placeholder="Internal note for administrators"
                    maxLength={5000}
                    helper={message.admin_note ? "Internal note saved" : "No internal note"}
                    aria-label={`Internal note for ${message.subject}`}
                  />
                  <div className={styles.formActions}>
                    <SelectField
                      label={`Status for ${message.subject}`}
                      hideLabel
                      value={message.status}
                      onChange={event => { void updateFeedback(message, event.target.value as AdminFeedbackMessage["status"]); }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </SelectField>
                    <Button variant="secondary" onClick={() => { void updateFeedback(message, message.status); }}>Save note</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={Boolean(noteTournament)}
        onClose={() => setNoteTournament(null)}
        title={`Tournament notes: ${noteTournament?.name ?? ""}`}
        description="Internal administrator context only"
        size="lg"
        closeLabel="Close tournament notes"
        footer={<Button variant="secondary" onClick={() => setNoteTournament(null)}>Close</Button>}
      >
        {noteTournament ? (
          <div className={styles.stack}>
            <section className={styles.group}>
              <h3 className={styles.subsectionTitle}>Add note</h3>
              <FormGrid>
                <SelectField label="Category" value={tournamentNoteCategory} onChange={event => setTournamentNoteCategory(event.target.value)}>
                  <option value="general">General</option>
                  <option value="data">Data issue</option>
                  <option value="ownership">Ownership question</option>
                  <option value="results">Results review</option>
                  <option value="support">Support follow-up</option>
                </SelectField>
                <TextAreaField
                  label="Note"
                  fullRow
                  value={tournamentNoteText}
                  onChange={event => setTournamentNoteText(event.target.value)}
                  placeholder="Add factual context for other administrators..."
                  maxLength={2000}
                />
              </FormGrid>
              <div className={styles.formActions}>
                <Button variant="primary" disabled={!tournamentNoteText.trim()} onClick={() => { void saveTournamentNote(); }}>Add note</Button>
              </div>
            </section>
            <CardDivider />
            <section className={styles.group}>
              <h3 className={styles.subsectionTitle}>Note history</h3>
              {tournamentNotesLoading ? (
                <p className={styles.helper} role="status">Loading notes...</p>
              ) : tournamentNotes.length === 0 ? (
                <p className={styles.helper}>No internal notes have been added.</p>
              ) : (
                <ul className={styles.rows}>
                  {tournamentNotes.map(note => (
                    <li className={styles.rowStack} key={note.id}>
                      <div className={styles.row}>
                        <span className={styles.rowTitle}>
                          {capitalizeFirstLetter(note.category.replace(/_/g, " "))}
                          <Badge tone={note.is_resolved ? "success" : "warning"}>{note.is_resolved ? "Resolved" : "Open"}</Badge>
                        </span>
                        <span className={styles.rowMeta}>{formatAdminTimestamp(note.created_at, "")}</span>
                      </div>
                      <p className={styles.rowBody}>{note.note}</p>
                      <div className={styles.row}>
                        <span className={styles.rowMeta}>Added by @{note.admin_username}</span>
                        <Button variant="ghost" size="sm" onClick={() => { void resolveTournamentNote(note.id, !note.is_resolved); }}>
                          {note.is_resolved ? "Reopen" : "Resolve"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteConfirmation)}
        title={deleteConfirmation?.type === "changelog" ? "Delete changelog entry?" : "Delete announcement?"}
        description={deleteConfirmation
          ? `${deleteConfirmation.type === "announcement" ? `"${deleteConfirmation.announcement.title}"` : `Version ${deleteConfirmation.version}`} will be deleted. This cannot be undone.`
          : ""}
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleteConfirmation(null)}
        onConfirm={() => {
          const confirmation = deleteConfirmation;
          setDeleteConfirmation(null);
          if (!confirmation) return;
          if (confirmation.type === "announcement") {
            void confirmAnnouncementDelete(confirmation.announcement);
          } else {
            void confirmChangelogDelete(confirmation.version);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(accountConfirm)}
        title={accountConfirmCopy?.title ?? ""}
        description={accountConfirmCopy?.description ?? ""}
        confirmLabel={accountConfirmCopy?.confirmLabel ?? "Confirm"}
        busyLabel="Saving..."
        tone={accountConfirmCopy?.tone ?? "default"}
        busy={accountConfirmBusy}
        onCancel={() => setAccountConfirm(null)}
        onConfirm={() => { void confirmAccountChange(); }}
      />

      <Modal
        open={Boolean(acknowledgedAnnouncement)}
        onClose={closeAcknowledgmentDialog}
        title={`Acknowledged: ${acknowledgedAnnouncement?.title ?? ""}`}
        description={`${acknowledgedAnnouncement?.acknowledgment_count ?? 0} users acknowledged`}
        size="lg"
        closeLabel="Close acknowledgments"
        footer={<Button variant="secondary" onClick={closeAcknowledgmentDialog}>Close</Button>}
      >
        {acknowledgmentsLoading ? (
          <p className={styles.helper} role="status">Loading acknowledged users...</p>
        ) : acknowledgmentsError ? (
          <Notice tone="danger" role="alert">{acknowledgmentsError}</Notice>
        ) : acknowledgmentUsers.length === 0 ? (
          <p className={styles.helper}>No users have acknowledged this announcement.</p>
        ) : (
          <DataTable caption="Users who acknowledged this announcement">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Email</th>
                <th scope="col">Account</th>
                <th scope="col">Acknowledged</th>
                <th scope="col">Version</th>
              </tr>
            </thead>
            <tbody>
              {acknowledgmentUsers.map(user => (
                <tr key={`${user.id}-${user.version}`}>
                  <td>
                    <span className={styles.cellStack}>
                      <span className={styles.cellTitle}>{user.first_name} {user.last_name}</span>
                      <span className={styles.cellMeta}>@{user.username}</span>
                    </span>
                  </td>
                  <td data-tone="secondary">{user.email}</td>
                  <td><Badge tone={user.is_active ? "success" : "neutral"}>{user.is_active ? "Active" : "Inactive"}</Badge></td>
                  <td data-tone="secondary">{formatAdminTimestamp(user.acknowledged_at, "Unknown")}</td>
                  <td>{user.version}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Modal>

      <Modal
        open={Boolean(reviewUser)}
        onClose={() => setReviewUser(null)}
        title={`Account review: ${reviewUser?.username ?? ""}`}
        description="Observation and internal notes only. This does not change account access."
        size="lg"
        closeLabel="Close account review"
        footer={<Button variant="secondary" onClick={() => setReviewUser(null)}>Close</Button>}
      >
        {reviewUser ? (
          <div className={styles.stack}>
            {reviewError ? <Notice tone="danger" role="alert">{reviewError}</Notice> : null}
            {reviewLoading ? <p className={styles.helper} role="status">Loading account activity...</p> : reviewDetail ? (
              <>
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Account details</h3>
                  <dl className={styles.details}>
                    <AdminDetail label="Name">{reviewDetail.user.name}</AdminDetail>
                    <AdminDetail label="Email">{reviewDetail.user.email}</AdminDetail>
                    <AdminDetail label="Status">{reviewDetail.user.is_active ? "Active" : "Inactive"}</AdminDetail>
                    <AdminDetail label="Created">{formatAdminTimestamp(reviewDetail.user.created_at, "Unknown")}</AdminDetail>
                    <AdminDetail label="Last login">{formatAdminTimestamp(reviewDetail.user.last_login_at, "Never")}</AdminDetail>
                    <AdminDetail label="Last activity">{formatAdminTimestamp(reviewDetail.user.last_activity_at, "Never")}</AdminDetail>
                    <AdminDetail label="Verification">{reviewDetail.user.email_verified ? formatAdminTimestamp(reviewDetail.user.email_verified_at, "Verified") : "Unverified"}</AdminDetail>
                    <AdminDetail label="Development notice">{reviewDetail.user.dev_notice_version_accepted || "Not acknowledged"}</AdminDetail>
                    <AdminDetail label="Active sessions">{reviewUser.active_session_count}</AdminDetail>
                    <AdminDetail label="Failed logins">{reviewUser.failed_login_count}</AdminDetail>
                  </dl>
                </section>
                <CardDivider />
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Owned tournaments</h3>
                  {reviewDetail.owned_tournaments.length === 0 ? <p className={styles.helper}>No owned tournaments.</p> : (
                    <ul className={styles.rows}>
                      {reviewDetail.owned_tournaments.map(item => (
                        <li className={styles.row} key={item.id}>
                          <div className={styles.rowText}>
                            <span className={styles.rowTitle}>{item.name}</span>
                            <span className={styles.rowMeta}>Tournament #{item.id}</span>
                          </div>
                          <span className={styles.rowMeta}>{capitalizeFirstLetter(item.lifecycle_status.replace(/_/g, " "))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <CardDivider />
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Staff memberships</h3>
                  {reviewDetail.staff_memberships.length === 0 ? <p className={styles.helper}>No tournament staff memberships.</p> : (
                    <ul className={styles.rows}>
                      {reviewDetail.staff_memberships.map(item => (
                        <li className={styles.row} key={item.tournament_id}>
                          <div className={styles.rowText}>
                            <span className={styles.rowTitle}>{item.tournament_name}</span>
                            <span className={styles.rowMeta}>Tournament #{item.tournament_id}</span>
                          </div>
                          <span className={styles.rowMeta}>{capitalizeFirstLetter(item.role.replace(/_/g, " "))} · since {formatAdminTimestamp(item.created_at, "Unknown")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <CardDivider />
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Add internal review item</h3>
                  <FormGrid>
                    <SelectField label="Type" value={reviewKind} onChange={(event) => setReviewKind(event.target.value as "flag" | "note")}>
                      <option value="note">Internal note</option>
                      <option value="flag">Flag for review</option>
                    </SelectField>
                    <SelectField label="Category" value={reviewCategory} onChange={(event) => setReviewCategory(event.target.value)}>
                      <option value="general">General</option>
                      <option value="verification">Verification</option>
                      <option value="inactive">Inactive</option>
                      <option value="duplicate">Possible duplicate</option>
                      <option value="suspicious">Suspicious activity</option>
                      <option value="fake">Potentially fake</option>
                    </SelectField>
                    <TextAreaField
                      label="Note"
                      fullRow
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="Add factual context for other administrators..."
                      maxLength={2000}
                      helper={`${reviewNote.length}/2000`}
                    />
                  </FormGrid>
                  <div className={styles.formActions}>
                    <Button variant="primary" disabled={reviewSaving || !reviewNote.trim()} onClick={() => { void saveUserReview(); }}>
                      {reviewSaving ? "Saving..." : reviewKind === "flag" ? "Add flag" : "Add note"}
                    </Button>
                  </div>
                </section>
                <CardDivider />
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Review history</h3>
                  {reviewDetail.reviews.length === 0 ? <p className={styles.helper}>No flags or internal notes have been added.</p> : (
                    <ul className={styles.rows}>
                      {reviewDetail.reviews.map(item => (
                        <li key={item.id} className={styles.rowStack}>
                          <div className={styles.row}>
                            <span className={styles.rowTitle}>
                              {capitalizeFirstLetter(item.category.replace(/_/g, " "))}
                              <Badge tone={item.is_resolved ? "success" : item.kind === "flag" ? "danger" : "warning"}>
                                {item.is_resolved ? "Resolved" : item.kind === "flag" ? "Open flag" : "Open note"}
                              </Badge>
                            </span>
                            <span className={styles.rowMeta}>{formatAdminTimestamp(item.created_at, "")}</span>
                          </div>
                          <p className={styles.rowBody}>{item.note}</p>
                          <div className={styles.row}>
                            <span className={styles.rowMeta}>Added by @{item.admin_username}</span>
                            <Button variant="ghost" size="sm" onClick={() => { void resolveUserReview(item.id, !item.is_resolved); }}>
                              {item.is_resolved ? "Reopen" : "Resolve"}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <CardDivider />
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Recent login activity</h3>
                  {reviewDetail.sessions.length === 0 ? <p className={styles.helper}>No authenticated sessions recorded.</p> : (
                    <ul className={styles.rows}>
                      {reviewDetail.sessions.map(session => (
                        <li key={session.id} className={styles.row}>
                          <div className={styles.rowText}>
                            <span className={styles.rowTitle}>{session.device_nickname || "Browser session"}</span>
                            <span className={styles.rowMeta}>{session.region_hint || "Region unavailable"}</span>
                          </div>
                          <div className={styles.cellStack}>
                            <span className={styles.rowMeta}>Last seen {formatAdminTimestamp(session.last_seen_at, "Unknown")}</span>
                            <span className={styles.rowMeta}>Risk {session.risk_score.toFixed(2)} · {session.is_revoked ? "Revoked" : "Active"}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <CardDivider />
                <section className={styles.group}>
                  <h3 className={styles.subsectionTitle}>Acknowledgment history</h3>
                  {reviewDetail.acknowledgments.length === 0 ? <p className={styles.helper}>No server-recorded acknowledgments.</p> : (
                    <ul className={styles.rows}>
                      {reviewDetail.acknowledgments.map(item => (
                        <li key={item.id} className={styles.row}>
                          <div className={styles.rowText}>
                            <span className={styles.rowTitle}>{capitalizeFirstLetter(item.content_type.replace(/_/g, " "))}</span>
                            <span className={styles.rowMeta}>{item.content_id} · version {item.version}</span>
                          </div>
                          <span className={styles.rowMeta}>{formatAdminTimestamp(item.acknowledged_at, "Unknown")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title={`Edit ${editUser?.username ?? "user"}`}
        closeLabel="Close edit user dialog"
        dismissible={!editSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)} disabled={editSaving}>Cancel</Button>
            <Button
              variant="primary"
              disabled={editSaving}
              onClick={async () => {
                if (!editUser) return;
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
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {editError ? <Notice tone="danger" role="alert">{editError}</Notice> : null}
          <FormGrid>
            <TextField label="First name" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
            <TextField label="Last name" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
            <TextField label="Email" type="email" fullRow value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            <TextField label="Organization" optional fullRow value={editOrg} onChange={(e) => setEditOrg(e.target.value)} />
          </FormGrid>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetUser)}
        onClose={() => setResetUser(null)}
        title={`Reset password for ${resetUser?.username ?? "user"}`}
        size="sm"
        closeLabel="Close password reset dialog"
        dismissible={!resetSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setResetUser(null)} disabled={resetSaving}>Cancel</Button>
            <Button
              variant="primary"
              disabled={resetSaving || resetPassword.length < 8}
              onClick={async () => {
                if (!resetUser) return;
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
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {resetError ? <Notice tone="danger" role="alert">{resetError}</Notice> : null}
          <PasswordField
            ref={resetPasswordInputRef}
            label="New password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            helper="At least 8 characters."
            autoComplete="new-password"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteUser)}
        onClose={() => setDeleteUser(null)}
        title={`Delete user ${deleteUser?.username ?? ""}`}
        role="alertdialog"
        closeLabel="Close delete user dialog"
        dismissible={!deleteUserSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeleteUser(null)} disabled={deleteUserSaving}>Cancel</Button>
            <Button
              variant="danger"
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
              {deleteUserSaving ? "Deleting..." : "Delete user and all tournament data"}
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {deleteUserError ? <Notice tone="danger" role="alert">{deleteUserError}</Notice> : null}
          <Notice tone="warning">
            This permanently deletes the user, all BracketWorks and Tournament Central tournaments they own, and related records. Their Tournament Central registrations, bowler entries, and uploaded documents in other organizers&apos; tournaments are also deleted.
          </Notice>
          {deleteUserPreview ? (
            <dl className={styles.details}>
              {Object.entries(deleteUserPreview.impact).map(([key, value]) => (
                <AdminDetail key={key} label={capitalizeFirstLetter(key.replace(/_/g, " "))}>{value}</AdminDetail>
              ))}
            </dl>
          ) : null}
          <TextField label="Reason" value={deleteUserReason} onChange={(event) => setDeleteUserReason(event.target.value)} helper="Recorded in the audit log." />
          <TextField label="Type DELETE to confirm" value={deleteUserConfirmText} onChange={(event) => setDeleteUserConfirmText(event.target.value)} placeholder="DELETE" autoComplete="off" />
        </div>
      </Modal>

      <Modal
        open={Boolean(editTournament)}
        onClose={() => setEditTournament(null)}
        title={`Edit tournament #${editTournament?.id ?? ""}`}
        closeLabel="Close edit tournament dialog"
        dismissible={!editTournamentSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditTournament(null)} disabled={editTournamentSaving}>Cancel</Button>
            <Button
              variant="primary"
              disabled={editTournamentSaving}
              onClick={async () => {
                if (!editTournament) return;
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
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {editTournamentError ? <Notice tone="danger" role="alert">{editTournamentError}</Notice> : null}
          <FormGrid>
            <TextField label="Name" fullRow value={editTournamentName} onChange={(event) => setEditTournamentName(capitalizeFirstLetter(event.target.value))} />
            <TextField label="Location" fullRow value={editTournamentLocation} onChange={(event) => setEditTournamentLocation(capitalizeFirstLetter(event.target.value))} />
            <TextField label="Start date" value={editTournamentStartDate} onChange={(event) => setEditTournamentStartDate(event.target.value)} placeholder="YYYY-MM-DD or custom" />
            <TextField label="End date" value={editTournamentEndDate} onChange={(event) => setEditTournamentEndDate(event.target.value)} placeholder="YYYY-MM-DD or custom" />
          </FormGrid>
        </div>
      </Modal>

      <Modal
        open={Boolean(reassignTournament)}
        onClose={() => setReassignTournament(null)}
        title={`Reassign tournament #${reassignTournament?.id ?? ""}`}
        size="sm"
        closeLabel="Close reassign tournament dialog"
        dismissible={!reassignSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReassignTournament(null)} disabled={reassignSaving}>Cancel</Button>
            <Button
              variant="primary"
              disabled={reassignSaving || !reassignUserId}
              onClick={async () => {
                if (!reassignTournament) return;
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
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {reassignError ? <Notice tone="danger" role="alert">{reassignError}</Notice> : null}
          <SelectField label="New owner" value={reassignUserId} onChange={(event) => setReassignUserId(event.target.value)}>
            <option value="">Select user</option>
            {usersResponse.users.map((user) => (
              <option key={user.id} value={String(user.id)}>
                {user.first_name} {user.last_name} (@{user.username})
              </option>
            ))}
          </SelectField>
        </div>
      </Modal>

      <Modal
        open={Boolean(archiveTournament)}
        onClose={() => setArchiveTournament(null)}
        title={`Archive tournament #${archiveTournament?.id ?? ""}`}
        size="sm"
        closeLabel="Close archive tournament dialog"
        dismissible={!archiveSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setArchiveTournament(null)} disabled={archiveSaving}>Cancel</Button>
            <Button
              variant="primary"
              disabled={archiveSaving}
              onClick={async () => {
                if (!archiveTournament) return;
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
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {archiveError ? <Notice tone="danger" role="alert">{archiveError}</Notice> : null}
          <TextField label="Reason" optional value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Example: merged into Spring Open 2026" />
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTournament)}
        onClose={() => setDeleteTournament(null)}
        title={`Delete tournament #${deleteTournament?.id ?? ""}`}
        role="alertdialog"
        closeLabel="Close delete tournament dialog"
        dismissible={!deleteTournamentSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeleteTournament(null)} disabled={deleteTournamentSaving}>Cancel</Button>
            <Button
              variant="danger"
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
            </Button>
          </>
        )}
      >
        <div className={styles.stack}>
          {deleteTournamentError ? <Notice tone="danger" role="alert">{deleteTournamentError}</Notice> : null}
          <Notice tone="warning">This action is permanent and cannot be undone.</Notice>
          {deleteTournamentPreview ? (
            <dl className={styles.details}>
              {Object.entries(deleteTournamentPreview.impact).map(([key, value]) => (
                <AdminDetail key={key} label={capitalizeFirstLetter(key.replace(/_/g, " "))}>{value}</AdminDetail>
              ))}
            </dl>
          ) : null}
          {deleteTournamentPreview?.requires_force ? (
            <Notice tone="danger">This tournament has score data. Turn on force delete to continue.</Notice>
          ) : null}
          <TextField label="Reason" value={deleteTournamentReason} onChange={(event) => setDeleteTournamentReason(event.target.value)} helper="Recorded in the admin audit log." />
          <TextField label="Type DELETE to confirm" value={deleteTournamentConfirmText} onChange={(event) => setDeleteTournamentConfirmText(event.target.value)} placeholder="DELETE" autoComplete="off" />
          <CheckboxField label="Force delete even if score data exists" checked={forceDeleteTournament} onChange={(event) => setForceDeleteTournament(event.target.checked)} />
        </div>
      </Modal>
    </Page>
  );
}
