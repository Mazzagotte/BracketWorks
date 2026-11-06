import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Menu,
  MenuDivider,
  MenuItem,
  MenuNote,
  Pagination,
  SearchField,
  SelectField,
  TableToolbar,
} from "@bracketworks/ui";
import { Download, KeyRound, MoreHorizontal, Pencil, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";

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
import { AdminDetail } from "./AdminDetail";
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
  onToggleUserActive: (user: UserRow) => void;
  onStartDeleteUser: (user: UserRow) => void;
};

const COLUMN_COUNT = 10;

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
  onToggleUserActive,
  onStartDeleteUser,
}: AdminUsersSectionProps) {
  const { page, page_size: pageSize, total, total_pages: totalPages, users } = usersResponse;
  const firstShown = users.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = users.length === 0 ? 0 : firstShown + users.length - 1;

  return (
    <Card padding="flush" aria-label="Users">
      <CardHeader title="Users" description={`${total} total`} />
      <TableToolbar
        search={(
          <SearchField
            label="Search users"
            value={usersSearch}
            onChange={(event) => onUsersSearchChange(event.target.value)}
            placeholder="Search name, username, email, organization"
          />
        )}
      >
        <SelectField label="Filter users by verification" hideLabel value={usersVerification} onChange={(event) => onUsersVerificationChange(event.target.value as UsersVerificationFilter)}>
          <option value="all">All verification</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </SelectField>
        <SelectField label="Filter users by activity" hideLabel value={usersActivity} onChange={(event) => onUsersActivityChange(event.target.value as UsersActivityFilter)}>
          <option value="all">All activity</option>
          <option value="active">Active in 90 days</option>
          <option value="inactive">Inactive 90+ days</option>
          <option value="never">Never signed in</option>
        </SelectField>
        <SelectField label="Filter users by review status" hideLabel value={usersReview} onChange={(event) => onUsersReviewChange(event.target.value as UsersReviewFilter)}>
          <option value="all">All reviews</option>
          <option value="flagged">Needs review</option>
          <option value="clear">No open reviews</option>
        </SelectField>
        <SelectField label="Sort users" hideLabel value={usersSort} onChange={(event) => onUsersSortChange(event.target.value as UsersSortOption)}>
          <option value="id_asc">Sort: Oldest</option>
          <option value="id_desc">Sort: Newest ID</option>
          <option value="created_desc">Sort: Newest signup</option>
          <option value="last_login_desc">Sort: Recent login</option>
          <option value="name_asc">Sort: Name A-Z</option>
          <option value="name_desc">Sort: Name Z-A</option>
          <option value="tournaments_desc">Sort: Most tournaments</option>
          <option value="reviews_desc">Sort: Review items</option>
        </SelectField>
        <Button variant="secondary" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} onClick={onExportUsersCsv} disabled={users.length === 0}>
          Export CSV
        </Button>
      </TableToolbar>

      <DataTable caption="Users">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Username</th>
            <th scope="col">Email</th>
            <th scope="col">Status</th>
            <th scope="col">Organization</th>
            <th scope="col">Role</th>
            <th scope="col" data-align="right">Tournaments</th>
            <th scope="col" data-align="right">Bowler profiles</th>
            <th scope="col">Review</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {usersLoading ? (
            <tr><td className={styles.stateCell} colSpan={COLUMN_COUNT}><span className={styles.helper} role="status">Loading users...</span></td></tr>
          ) : users.length === 0 ? (
            <tr>
              <td className={styles.stateCell} colSpan={COLUMN_COUNT}>
                <EmptyState title="No users found" description="Try changing the search or filter options." />
              </td>
            </tr>
          ) : (
            users.map((user) => {
              const isSelf = user.id === currentUserId;
              const displayName = `${user.first_name} ${user.last_name}`.trim() || user.username;
              return (
                <tr key={user.id}>
                  <td>{`${user.first_name} ${user.last_name}`.trim()}</td>
                  <td data-tone="secondary">{user.username}</td>
                  <td data-tone="secondary">{user.email}</td>
                  <td>
                    <details className={styles.disclosure}>
                      <summary aria-label={`Account status for ${user.username}`}>
                        <Badge tone={user.email_verified ? "success" : "warning"}>{user.email_verified ? "Verified" : "Pending"}</Badge>
                      </summary>
                      <dl className={`${styles.details} ${styles.detailsCompact}`}>
                        <AdminDetail label="Email verified">{user.email_verified ? "Yes" : "No"}</AdminDetail>
                        <AdminDetail label="Verified at">{formatAdminTimestamp(user.email_verified_at)}</AdminDetail>
                        <AdminDetail label="Last login">{formatAdminTimestamp(user.last_login_at)}</AdminDetail>
                        <AdminDetail label="Created">{formatAdminTimestamp(user.created_at, "Unknown")}</AdminDetail>
                        <AdminDetail label="Active sessions">{user.active_session_count}</AdminDetail>
                        <AdminDetail label="Failed logins">{user.failed_login_count}</AdminDetail>
                        <AdminDetail label="Development notice">{user.dev_notice_version_accepted || "Not acknowledged"}</AdminDetail>
                      </dl>
                    </details>
                  </td>
                  <td data-tone="secondary">{user.organization || "-"}</td>
                  <td>{user.is_admin ? "Administrator" : "User"}</td>
                  <td data-align="right">{user.tournament_count}</td>
                  <td data-align="right">{user.profile_count}</td>
                  <td>
                    <Badge tone={user.open_review_count > 0 ? "warning" : "neutral"}>
                      {user.open_review_count > 0 ? `${user.open_review_count} open` : "Clear"}
                    </Badge>
                  </td>
                  <td>
                    <div className={styles.cellActions}>
                      <Button variant="accent-outline" size="sm" onClick={() => onLoadUserReview(user)} aria-label={`Review ${user.username}`}>
                        Review
                      </Button>
                      <Menu triggerLabel={`More actions for ${displayName}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                        <MenuItem icon={<Pencil size={ICON_SIZE.md} />} onSelect={() => onStartEditUser(user)}>Edit</MenuItem>
                        <MenuItem icon={<KeyRound size={ICON_SIZE.md} />} onSelect={() => onStartResetUser(user)}>Reset password</MenuItem>
                        <MenuItem
                          icon={user.is_admin ? <ShieldOff size={ICON_SIZE.md} /> : <ShieldCheck size={ICON_SIZE.md} />}
                          onSelect={() => onToggleAdminRole(user)}
                          disabled={isSelf || adminRoleSavingUserId === user.id}
                        >
                          {adminRoleSavingUserId === user.id ? "Saving..." : user.is_admin ? "Change to user" : "Promote to admin"}
                        </MenuItem>
                        <MenuItem
                          icon={user.is_active ? <UserX size={ICON_SIZE.md} /> : <UserCheck size={ICON_SIZE.md} />}
                          onSelect={() => onToggleUserActive(user)}
                        >
                          {user.is_active ? "Deactivate" : "Reactivate"}
                        </MenuItem>
                        <MenuDivider />
                        <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => onStartDeleteUser(user)} disabled={isSelf}>
                          Delete user
                        </MenuItem>
                        {isSelf ? <MenuNote>You cannot change your own role or delete your own account.</MenuNote> : null}
                      </Menu>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </DataTable>

      <Pagination
        page={page}
        pageCount={totalPages}
        onPageChange={onUsersPageChange}
        summary={`Showing ${firstShown}-${lastShown} of ${total}`}
        pageSizeControl={(
          <SelectField label="Users per page" hideLabel value={usersPageSize} onChange={(event) => onUsersPageSizeChange(Number(event.target.value) as UsersPageSize)}>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </SelectField>
        )}
      />
    </Card>
  );
}
