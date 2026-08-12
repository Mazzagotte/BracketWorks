import { DataTableToolbar } from "../../components/primitives";

import type {
  UserRow,
  UsersActivityFilter,
  UsersPageSize,
  UsersResponse,
  UsersReviewFilter,
  UsersSortOption,
  UsersVerificationFilter,
} from "../types";
import { formatAdminTimestamp } from "../utils";
import styles from "../admin.module.css";

type AdminUsersSectionProps = {
  usersResponse: UsersResponse;
  usersLoading: boolean;
  usersSearch: string;
  usersVerification: UsersVerificationFilter;
  usersActivity: UsersActivityFilter;
  usersReview: UsersReviewFilter;
  usersSort: UsersSortOption;
  usersPageSize: UsersPageSize;
  currentUserId: number | null;
  adminRoleSavingUserId: number | null;
  onUsersSearchChange: (value: string) => void;
  onUsersVerificationChange: (value: UsersVerificationFilter) => void;
  onUsersActivityChange: (value: UsersActivityFilter) => void;
  onUsersReviewChange: (value: UsersReviewFilter) => void;
  onUsersSortChange: (value: UsersSortOption) => void;
  onUsersPageSizeChange: (value: UsersPageSize) => void;
  onUsersPageChange: (value: number) => void;
  onExportUsersCsv: () => void;
  onLoadUserReview: (user: UserRow) => void;
  onStartEditUser: (user: UserRow) => void;
  onStartResetUser: (user: UserRow) => void;
  onToggleAdminRole: (user: UserRow) => void;
  onStartDeleteUser: (user: UserRow) => void;
};

export function AdminUsersSection({
  usersResponse,
  usersLoading,
  usersSearch,
  usersVerification,
  usersActivity,
  usersReview,
  usersSort,
  usersPageSize,
  currentUserId,
  adminRoleSavingUserId,
  onUsersSearchChange,
  onUsersVerificationChange,
  onUsersActivityChange,
  onUsersReviewChange,
  onUsersSortChange,
  onUsersPageSizeChange,
  onUsersPageChange,
  onExportUsersCsv,
  onLoadUserReview,
  onStartEditUser,
  onStartResetUser,
  onToggleAdminRole,
  onStartDeleteUser,
}: AdminUsersSectionProps) {
  return (
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
            onChange={(event) => onUsersSearchChange(event.target.value)}
            placeholder="Search name, username, email, organization"
          />
        )}
        right={(
          <>
            <select className={styles.toolbarSelect} aria-label="Filter users by verification" value={usersVerification} onChange={(event) => onUsersVerificationChange(event.target.value as UsersVerificationFilter)}>
              <option value="all">All verification</option><option value="verified">Verified</option><option value="unverified">Unverified</option>
            </select>
            <select className={styles.toolbarSelect} aria-label="Filter users by activity" value={usersActivity} onChange={(event) => onUsersActivityChange(event.target.value as UsersActivityFilter)}>
              <option value="all">All activity</option><option value="active">Active in 90 days</option><option value="inactive">Inactive 90+ days</option><option value="never">Never signed in</option>
            </select>
            <select className={styles.toolbarSelect} aria-label="Filter users by review status" value={usersReview} onChange={(event) => onUsersReviewChange(event.target.value as UsersReviewFilter)}>
              <option value="all">All reviews</option><option value="flagged">Needs review</option><option value="clear">No open reviews</option>
            </select>
            <select className={styles.toolbarSelect} aria-label="Sort users" value={usersSort} onChange={(event) => onUsersSortChange(event.target.value as UsersSortOption)}>
              <option value="id_asc">Sort: Oldest</option><option value="id_desc">Sort: Newest ID</option><option value="created_desc">Sort: Newest signup</option><option value="last_login_desc">Sort: Recent login</option><option value="name_asc">Sort: Name A-Z</option><option value="name_desc">Sort: Name Z-A</option><option value="tournaments_desc">Sort: Most tournaments</option><option value="reviews_desc">Sort: Review items</option>
            </select>
            <select className={styles.toolbarSelect} aria-label="Users per page" value={usersPageSize} onChange={(event) => onUsersPageSizeChange(Number(event.target.value) as UsersPageSize)}>
              <option value={10}>10 per page</option><option value={25}>25 per page</option><option value={50}>50 per page</option><option value={100}>100 per page</option>
            </select>
            <button type="button" className={styles.actionBtn} onClick={onExportUsersCsv} disabled={usersResponse.users.length === 0}>Export CSV</button>
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
                      <button type="button" className={styles.actionBtn} onClick={() => { onLoadUserReview(user); }}>Review</button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => onStartEditUser(user)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => onStartResetUser(user)}
                      >
                        Reset PW
                      </button>
                      {user.id !== currentUserId && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${user.is_admin ? styles.actionBtnDanger : ""}`}
                          disabled={adminRoleSavingUserId === user.id}
                          onClick={() => onToggleAdminRole(user)}
                        >
                          {adminRoleSavingUserId === user.id
                            ? "Saving..."
                            : user.is_admin
                              ? "Change to User"
                              : "Promote to Admin"}
                        </button>
                      )}
                      {user.id !== currentUserId && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => onStartDeleteUser(user)}
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
          onClick={() => onUsersPageChange(Math.max(1, usersResponse.page - 1))}
          disabled={usersResponse.page <= 1 || usersLoading}
        >
          Prev
        </button>
        <span className={styles.secondaryText}>Page {usersResponse.page} of {usersResponse.total_pages}</span>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onUsersPageChange(Math.min(usersResponse.total_pages, usersResponse.page + 1))}
          disabled={usersResponse.page >= usersResponse.total_pages || usersLoading}
        >
          Next
        </button>
      </div>
    </section>
  );
}
