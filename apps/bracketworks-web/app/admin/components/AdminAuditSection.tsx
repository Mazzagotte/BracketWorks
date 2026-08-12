import { DataTableToolbar } from "../../components/primitives";

import type { AuditLogsResponse, UserRow } from "../types";
import styles from "../admin.module.css";

type AdminAuditSectionProps = {
  auditResponse: AuditLogsResponse;
  auditLoading: boolean;
  auditSearch: string;
  auditAction: string;
  auditTargetType: string;
  auditAdminUserId: string;
  auditDateFrom: string;
  auditDateTo: string;
  adminUsers: UserRow[];
  onAuditSearchChange: (value: string) => void;
  onAuditActionChange: (value: string) => void;
  onAuditTargetTypeChange: (value: string) => void;
  onAuditAdminUserIdChange: (value: string) => void;
  onAuditDateFromChange: (value: string) => void;
  onAuditDateToChange: (value: string) => void;
  onAuditPageChange: (value: number) => void;
  onExportAuditCsv: () => void;
};

export function AdminAuditSection({
  auditResponse,
  auditLoading,
  auditSearch,
  auditAction,
  auditTargetType,
  auditAdminUserId,
  auditDateFrom,
  auditDateTo,
  adminUsers,
  onAuditSearchChange,
  onAuditActionChange,
  onAuditTargetTypeChange,
  onAuditAdminUserIdChange,
  onAuditDateFromChange,
  onAuditDateToChange,
  onAuditPageChange,
  onExportAuditCsv,
}: AdminAuditSectionProps) {
  return (
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
            onChange={(event) => onAuditSearchChange(event.target.value)}
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
              onChange={(event) => onAuditActionChange(event.target.value)}
              placeholder="Action (example: tournament.delete)"
            />
            <input
              type="text"
              className={styles.toolbarInput}
              aria-label="Filter audit log by target type"
              value={auditTargetType}
              onChange={(event) => onAuditTargetTypeChange(event.target.value)}
              placeholder="Target type (user, tournament)"
            />
            <select className={styles.toolbarSelect} aria-label="Filter audit log by administrator" value={auditAdminUserId} onChange={(event) => onAuditAdminUserIdChange(event.target.value)}>
              <option value="">All administrators</option>
              {adminUsers.filter((user) => user.is_admin).map((user) => (
                <option value={String(user.id)} key={user.id}>{user.first_name} {user.last_name} (@{user.username})</option>
              ))}
            </select>
            <input type="date" className={styles.toolbarInput} aria-label="Audit start date" value={auditDateFrom} onChange={(event) => onAuditDateFromChange(event.target.value)} />
            <input type="date" className={styles.toolbarInput} aria-label="Audit end date" value={auditDateTo} onChange={(event) => onAuditDateToChange(event.target.value)} />
            <button type="button" className={styles.actionBtn} onClick={onExportAuditCsv} disabled={auditResponse.logs.length === 0}>Export CSV</button>
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
          onClick={() => onAuditPageChange(Math.max(1, auditResponse.page - 1))}
          disabled={auditResponse.page <= 1 || auditLoading}
        >
          Prev
        </button>
        <span className={styles.secondaryText}>Page {auditResponse.page} of {auditResponse.total_pages}</span>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onAuditPageChange(Math.min(auditResponse.total_pages, auditResponse.page + 1))}
          disabled={auditResponse.page >= auditResponse.total_pages || auditLoading}
        >
          Next
        </button>
      </div>
    </section>
  );
}
