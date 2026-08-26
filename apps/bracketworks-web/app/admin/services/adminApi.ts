import { apiClient } from "../../lib/api";

import type {
  AdminAnnouncement,
  AdminFeedbackMessage,
  AdminChangelogEntry,
  AdminOperation,
  AdminSystemHealth,
  AuditLogsResponse,
  DeletePreview,
  OverviewResponse,
  TablesResponse,
  TournamentActivityFilter,
  TournamentNote,
  TournamentSortOption,
  TournamentsResponse,
  UsersActivityFilter,
  UsersReviewFilter,
  UserReviewDetail,
  UsersSortOption,
  UsersResponse,
  UsersVerificationFilter,
} from "../types";
import { buildQuery } from "../utils";

type UsersQueryOptions = {
  page: number;
  page_size: number;
  search: string;
  sort: UsersSortOption;
  verification: UsersVerificationFilter;
  activity: UsersActivityFilter;
  review: UsersReviewFilter;
};

type TournamentsQueryOptions = {
  page: number;
  page_size: number;
  search: string;
  activity: TournamentActivityFilter;
  sort: TournamentSortOption;
};

type TablesQueryOptions = {
  include_counts: boolean;
  search: string;
  limit: number;
};

type AuditLogsQueryOptions = {
  page: number;
  page_size: number;
  search: string;
  action: string;
  target_type: string;
  admin_user_id: string;
  date_from: string;
  date_to: string;
};

export const adminApi = {
  getOverview() {
    return apiClient.get<OverviewResponse>("/api/v1/admin/overview", false);
  },
  getUsers(options: UsersQueryOptions) {
    const query = buildQuery(options);
    return apiClient.get<UsersResponse>(`/api/v1/admin/users${query}`, false);
  },
  getUserReview(userId: number) {
    return apiClient.get<UserReviewDetail>(`/api/v1/admin/users/${userId}/review`, false);
  },
  getTournaments(options: TournamentsQueryOptions) {
    const query = buildQuery(options);
    return apiClient.get<TournamentsResponse>(`/api/v1/admin/tournaments${query}`, false);
  },
  getTournamentNotes(tournamentId: number) {
    return apiClient.get<{ notes: TournamentNote[] }>(`/api/v1/admin/tournaments/${tournamentId}/notes`, false);
  },
  getTables(options: TablesQueryOptions) {
    const query = buildQuery(options);
    return apiClient.get<TablesResponse>(`/api/v1/admin/database/tables${query}`, false);
  },
  getAuditLogs(options: AuditLogsQueryOptions) {
    const query = buildQuery(options);
    return apiClient.get<AuditLogsResponse>(`/api/v1/admin/audit-logs${query}`, false);
  },
  getChangelog() {
    return apiClient.get<{ entries: AdminChangelogEntry[] }>("/api/v1/admin/changelog", false);
  },
  getAnnouncements() {
    return apiClient.get<{ announcements: AdminAnnouncement[] }>("/api/v1/admin/announcements", false);
  },
  getFeedback() {
    return apiClient.get<{ messages: AdminFeedbackMessage[] }>("/api/v1/admin/feedback", false);
  },
  updateFeedback(messageId: number, payload: { status: AdminFeedbackMessage["status"]; admin_note: string | null }) {
    return apiClient.patch<AdminFeedbackMessage>(`/api/v1/admin/feedback/${messageId}`, payload);
  },
  deleteAnnouncement(announcementId: number) {
    return apiClient.delete<{ ok: boolean; acknowledgments_deleted: number }>(`/api/v1/admin/announcements/${announcementId}`);
  },
  getOperations() {
    return apiClient.get<{ operations: AdminOperation[]; note: string }>("/api/v1/admin/operations", false);
  },
  getSystemHealth() {
    return apiClient.get<AdminSystemHealth>("/api/v1/admin/system-health", false);
  },
  getUserDeletePreview(userId: number) {
    return apiClient.get<DeletePreview>(`/api/v1/admin/users/${userId}/delete-preview`, false);
  },
  getTournamentDeletePreview(tournamentId: number) {
    return apiClient.get<DeletePreview>(`/api/v1/admin/tournaments/${tournamentId}/delete-preview`, false);
  },
};
