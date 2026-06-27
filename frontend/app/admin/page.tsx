"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { usePageHeader } from "../lib/header-context";
import { apiClient } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { formatShortMonthDayYear } from "../lib/formatters";
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
};

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

type AdminTab = "overview" | "users" | "tournaments" | "database" | "audit";

const TAB_LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  users: "Users",
  tournaments: "Tournaments",
  database: "Database",
  audit: "Audit",
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

  const [tournamentsResponse, setTournamentsResponse] = useState<TournamentsResponse>({ tournaments: [], page: 1, page_size: 25, total: 0, total_pages: 1 });
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false);
  const [tournamentSearch, setTournamentSearch] = useState("");
  const [tournamentActivityFilter, setTournamentActivityFilter] = useState<"all" | "has_entries" | "no_entries">("all");
  const [tournamentSort, setTournamentSort] = useState<"newest" | "entries_desc" | "owner_asc" | "oldest">("newest");
  const [tournamentPage, setTournamentPage] = useState(1);
  const [expandedTournamentIds, setExpandedTournamentIds] = useState<number[]>([]);

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
  const [auditPage, setAuditPage] = useState(1);

  const [refreshing, setRefreshing] = useState(false);

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
      const query = buildQuery({ page: usersPage, page_size: 25, search: usersSearch, sort: usersSort });
      const data = await apiClient.get<UsersResponse>(`/api/v1/admin/users${query}`, false);
      setUsersResponse(data);
      setUsersLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [currentUser?.isAdmin, usersPage, usersSearch, usersSort]);

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
  }, [currentUser?.isAdmin, auditPage, auditSearch, auditAction, auditTargetType]);

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
    await loadAuditLogs(manual);
  }, [activeTab, loadOverview, loadUsers, loadTournaments, loadTables, loadAuditLogs]);

  const refreshAfterMutation = useCallback(async ({
    overview = false,
    users = false,
    tournaments = false,
    tables = false,
    audit = false,
  }: {
    overview?: boolean;
    users?: boolean;
    tournaments?: boolean;
    tables?: boolean;
    audit?: boolean;
  }) => {
    const refreshTasks: Promise<unknown>[] = [];
    if (overview) refreshTasks.push(loadOverview(false));
    if (users) refreshTasks.push(loadUsers(false));
    if (tournaments) refreshTasks.push(loadTournaments(false));
    if (tables) refreshTasks.push(loadTables(false));
    if (audit) refreshTasks.push(loadAuditLogs(false));
    await Promise.allSettled(refreshTasks);
  }, [loadOverview, loadUsers, loadTournaments, loadTables, loadAuditLogs]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin privileges");
    } finally {
      setAdminRoleSavingUserId(null);
    }
  }, [refreshAfterMutation]);

  const adminTabs = useMemo(() => (
    <nav className={styles.adminNav} aria-label="Admin sections">
      <div className={styles.tabRow}>
        {(["overview", "users", "tournaments", "database", "audit"] as AdminTab[]).map((tab) => (
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
  ), [activeTab]);

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
      {error && <div className={styles.errorBanner}>{error}</div>}

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
          <div className={styles.toolbarRow}>
            <input
              type="text"
              className={styles.toolbarInput}
              value={usersSearch}
              onChange={(event) => {
                setUsersSearch(event.target.value);
                setUsersPage(1);
              }}
              placeholder="Search name, username, email, organization"
            />
            <select
              className={styles.toolbarSelect}
              value={usersSort}
              onChange={(event) => {
                setUsersSort(event.target.value);
                setUsersPage(1);
              }}
            >
              <option value="id_asc">Sort: Oldest</option>
              <option value="id_desc">Sort: Newest</option>
              <option value="name_asc">Sort: Name A-Z</option>
              <option value="name_desc">Sort: Name Z-A</option>
              <option value="tournaments_desc">Sort: Most tournaments</option>
            </select>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Organization</th>
                  <th>Admin</th>
                  <th>Tournaments</th>
                  <th>Bowler Profiles</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={9}>Loading users...</td></tr>
                ) : usersResponse.users.length === 0 ? (
                  <tr><td colSpan={9}>No users match the current filters.</td></tr>
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
                            </div>
                          </div>
                        </details>
                      </td>
                      <td>{user.organization || "-"}</td>
                      <td>{user.is_admin ? "Yes" : "-"}</td>
                      <td>{user.tournament_count}</td>
                      <td>{user.profile_count}</td>
                      <td>
                        <div className={styles.rowActions}>
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
                                  ? "Revoke Admin"
                                  : "Make Admin"}
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

          <div className={styles.toolbarRow}>
            <input
              type="text"
              className={styles.toolbarInput}
              value={tournamentSearch}
              onChange={(event) => {
                setTournamentSearch(event.target.value);
                setTournamentPage(1);
              }}
              placeholder="Search name, owner, location"
            />
            <select
              className={styles.toolbarSelect}
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
          </div>

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tournamentsLoading ? (
                  <tr><td colSpan={9}>Loading tournaments...</td></tr>
                ) : tournamentsResponse.tournaments.length === 0 ? (
                  <tr><td colSpan={9}>No tournaments match the current filters.</td></tr>
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
                          <td>
                            <div className={styles.rowActions}>
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
                            <td colSpan={9}>
                              <div className={styles.detailCard}>
                                <div className={styles.detailGrid}>
                                  <div><strong>Scores:</strong> {tournament.score_count}</div>
                                  <div><strong>Payouts:</strong> {tournament.payout_count}</div>
                                  <div><strong>Snapshots:</strong> {tournament.snapshot_count}</div>
                                  <div><strong>Owner Email:</strong> {tournament.owner_email}</div>
                                </div>
                                {tournament.archive_reason && (
                                  <div className={styles.detailNote}>Archive reason: {tournament.archive_reason}</div>
                                )}
                                <div className={styles.detailLinks}>
                                  <a className={styles.linkBtn} href={`/view/${tournament.id}`} target="_blank" rel="noreferrer">Open Bowler View</a>
                                  <a className={styles.linkBtn} href="/scores" target="_blank" rel="noreferrer">Open Scores Page</a>
                                  <a className={styles.linkBtn} href="/players" target="_blank" rel="noreferrer">Open Players Page</a>
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
          <div className={styles.toolbarRow}>
            <input
              type="text"
              className={styles.toolbarInput}
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Search table names"
            />
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={tableIncludeCounts}
                onChange={(event) => setTableIncludeCounts(event.target.checked)}
              />
              <span>Include row counts (uses estimates on Postgres)</span>
            </label>
          </div>
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
                  <tr><td colSpan={4}>Loading tables...</td></tr>
                ) : tablesResponse.tables.length === 0 ? (
                  <tr><td colSpan={4}>No tables found.</td></tr>
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
          <div className={styles.toolbarRow}>
            <input
              type="text"
              className={styles.toolbarInput}
              value={auditSearch}
              onChange={(event) => {
                setAuditSearch(event.target.value);
                setAuditPage(1);
              }}
              placeholder="Search action, reason, target"
            />
            <input
              type="text"
              className={styles.toolbarInput}
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
              value={auditTargetType}
              onChange={(event) => {
                setAuditTargetType(event.target.value);
                setAuditPage(1);
              }}
              placeholder="Target type (user, tournament)"
            />
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={5}>Loading audit logs...</td></tr>
                ) : auditResponse.logs.length === 0 ? (
                  <tr><td colSpan={5}>No audit log entries found.</td></tr>
                ) : (
                  auditResponse.logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
                      <td>{log.admin_name || log.admin_username || `User ${log.admin_user_id}`}</td>
                      <td>{log.action}</td>
                      <td>{log.target_type || "-"}{log.target_id ? ` #${log.target_id}` : ""}</td>
                      <td>{log.reason || "-"}</td>
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

      {editUser && (
        <div className={styles.modalOverlay} onClick={() => setEditUser(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit {editUser.username}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setEditUser(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {editError && <div className={styles.modalError}>{editError}</div>}
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
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reset password for {resetUser.username}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setResetUser(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {resetError && <div className={styles.modalError}>{resetError}</div>}
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
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete user {deleteUser.username}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setDeleteUser(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {deleteUserError && <div className={styles.modalError}>{deleteUserError}</div>}
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
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Tournament #{editTournament.id}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setEditTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {editTournamentError && <div className={styles.modalError}>{editTournamentError}</div>}
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
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reassign Tournament #{reassignTournament.id}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setReassignTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {reassignError && <div className={styles.modalError}>{reassignError}</div>}
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
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Archive Tournament #{archiveTournament.id}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setArchiveTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {archiveError && <div className={styles.modalError}>{archiveError}</div>}
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
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Tournament #{deleteTournament.id}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setDeleteTournament(null)}>X</button>
            </div>
            <div className={styles.modalBody}>
              {deleteTournamentError && <div className={styles.modalError}>{deleteTournamentError}</div>}
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
