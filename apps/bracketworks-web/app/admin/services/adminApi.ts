import { apiClient } from "../../lib/api";

import type {
  AdminAnnouncement,
  AdminAnnouncementAcknowledgment,
  AdminFeedbackMessage,
  AdminChangelogEntry,
  AuditLogsResponse,
  BowlerProfileOwner,
  BowlerProfileRow,
  BowlerProfilesResponse,
  DeletePreview,
  OverviewResponse,
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

type BowlerProfilesQueryOptions = {
  page: number;
  page_size: number;
  search: string;
  status: "all" | "active" | "archived";
  user_id?: number;
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
  getBowlerProfiles(options: BowlerProfilesQueryOptions) {
    const query = buildQuery(options);
    return apiClient.get<BowlerProfilesResponse>(`/api/v1/admin/bowlers${query}`, false);
  },
  getBowlerProfileOwners(search: string) {
    const query = buildQuery({ search, limit: 100 });
    return apiClient.get<{ users: BowlerProfileOwner[] }>(`/api/v1/admin/bowler-profile-owners${query}`, false);
  },
  updateBowlerProfile(profileId: number, payload: { first_name: string; last_name: string; usbc_number: string | null; average: number | null }) {
    return apiClient.patch<{ profile: BowlerProfileRow }>(`/api/v1/admin/bowlers/${profileId}`, payload);
  },
  importBowlerProfiles(payload: { user_id: number; rows: Array<{ first_name: string; last_name: string; usbc_number: string | null; average: number | null }> }) {
    return apiClient.post<{ created: number; duplicates: number; user_id: number }>("/api/v1/admin/bowlers/import", payload);
  },
  archiveBowlerProfile(profileId: number) {
    return apiClient.delete<{ id: number; is_active: boolean }>(`/api/v1/admin/bowlers/${profileId}`);
  },
  reactivateBowlerProfile(profileId: number) {
    return apiClient.post<{ id: number; is_active: boolean }>(`/api/v1/admin/bowlers/${profileId}/reactivate`, {});
  },
  getTournamentNotes(tournamentId: number) {
    return apiClient.get<{ notes: TournamentNote[] }>(`/api/v1/admin/tournaments/${tournamentId}/notes`, false);
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
  getAnnouncementAcknowledgments(announcementId: number) {
    return apiClient.get<{ users: AdminAnnouncementAcknowledgment[] }>(`/api/v1/admin/announcements/${announcementId}/acknowledgments`, false);
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
  getUserDeletePreview(userId: number) {
    return apiClient.get<DeletePreview>(`/api/v1/admin/users/${userId}/delete-preview`, false);
  },
  getTournamentDeletePreview(tournamentId: number) {
    return apiClient.get<DeletePreview>(`/api/v1/admin/tournaments/${tournamentId}/delete-preview`, false);
  },
};
