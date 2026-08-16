import type { ChangelogEntry } from "../lib/types";

export type OverviewResponse = {
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

export type UserRow = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  organization: string | null;
  is_admin: boolean;
  is_active: boolean;
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

export type UserReviewDetail = {
  user: UserRow & { name: string };
  sessions: Array<{
    id: number;
    issued_at: string | null;
    last_seen_at: string | null;
    expires_at: string | null;
    is_revoked: boolean;
    revoked_at: string | null;
    region_hint: string | null;
    device_nickname: string | null;
    risk_score: number;
  }>;
  login_attempts: Array<{
    id: number;
    failed_count: number;
    window_start: string | null;
    blocked_until: string | null;
    updated_at: string | null;
  }>;
  reviews: Array<{
    id: number;
    kind: "flag" | "note";
    category: string;
    note: string;
    is_resolved: boolean;
    admin_username: string;
    created_at: string | null;
    resolved_at: string | null;
  }>;
  acknowledgments: Array<{
    id: number;
    content_type: string;
    content_id: string;
    version: string;
    acknowledged_at: string | null;
  }>;
};

export type UsersResponse = {
  users: UserRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type UsersVerificationFilter = "all" | "verified" | "unverified";
export type UsersActivityFilter = "all" | "active" | "inactive" | "never";
export type UsersReviewFilter = "all" | "flagged" | "clear";
export type UsersSortOption =
  | "id_asc"
  | "id_desc"
  | "created_desc"
  | "last_login_desc"
  | "name_asc"
  | "name_desc"
  | "tournaments_desc"
  | "reviews_desc";
export type UsersPageSize = 10 | 25 | 50 | 100;

export type TournamentRow = {
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

export type TournamentNote = {
  id: number;
  category: string;
  note: string;
  is_resolved: boolean;
  admin_username: string;
  created_at: string | null;
  resolved_at: string | null;
};

export type TournamentsResponse = {
  tournaments: TournamentRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type TournamentActivityFilter = "all" | "has_entries" | "no_entries";
export type TournamentSortOption = "newest" | "entries_desc" | "owner_asc" | "oldest";

export type TableInfo = {
  name: string;
  row_count: number | null;
  row_count_kind: "skipped" | "estimated" | "exact";
  columns: string[];
};

export type TablesResponse = {
  tables: TableInfo[];
  include_counts: boolean;
  total_tables: number;
};

export type AuditLogRow = {
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

export type AuditLogsResponse = {
  logs: AuditLogRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type DeletePreview = {
  impact: Record<string, number>;
  dependent_total_rows: number;
  requires_force?: boolean;
  score_count?: number;
};

export type AdminTab =
  | "overview"
  | "users"
  | "tournaments"
  | "operations"
  | "announcements"
  | "messages"
  | "database"
  | "audit"
  | "changelog";

export type AdminAnnouncement = {
  id: number;
  title: string;
  message: string;
  audience_type: "all" | "admins" | "user";
  audience_user_id: number | null;
  status: "draft" | "active" | "archived";
  requires_acknowledgment: boolean;
  starts_at: string | null;
  ends_at: string | null;
  acknowledgment_count: number;
};

export type AdminOperation = {
  job_id: string;
  job_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
};

export type ChangelogFormState = {
  version: string;
  date: string;
  changes: string;
};

export type AdminChangelogEntry = ChangelogEntry & {
  id: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminOverviewMetricTone = "orange" | "blue" | "green" | "slate" | "gold" | "red";

export type AdminOverviewMetric = {
  label: string;
  value: string;
  tone: AdminOverviewMetricTone;
};

export const EMPTY_CHANGELOG_FORM: ChangelogFormState = {
  version: "",
  date: "",
  changes: "",
};

export const TAB_LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  users: "Users",
  tournaments: "Tournaments",
  database: "Database",
  audit: "Audit",
  changelog: "Changelog",
  operations: "Operations",
  announcements: "Announcements",
  messages: "Messages",
};

export type AdminFeedbackMessage = {
  id: number;
  user_id: number;
  username: string;
  user_name: string;
  email: string;
  category: "problem" | "feature" | "other";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};
