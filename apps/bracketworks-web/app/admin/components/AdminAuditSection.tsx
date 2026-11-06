import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ICON_SIZE,
  Pagination,
  SearchField,
  SelectField,
  TableToolbar,
  TextField,
} from "@bracketworks/ui";
import { Download } from "lucide-react";

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

const COLUMN_COUNT = 6;

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
  const { page, page_size: pageSize, total, total_pages: totalPages, logs } = auditResponse;
  const firstShown = logs.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = logs.length === 0 ? 0 : firstShown + logs.length - 1;

  return (
    <Card padding="flush" aria-label="Audit log">
      <CardHeader title="Audit log" description={`${total} entries`} />
      <TableToolbar
        search={(
          <SearchField
            label="Search audit log"
            value={auditSearch}
            onChange={(event) => onAuditSearchChange(event.target.value)}
            placeholder="Search action, reason, target"
          />
        )}
      >
        <TextField
          label="Filter audit log by action"
          hideLabel
          value={auditAction}
          onChange={(event) => onAuditActionChange(event.target.value)}
          placeholder="Action (example: tournament.delete)"
        />
        <TextField
          label="Filter audit log by target type"
          hideLabel
          value={auditTargetType}
          onChange={(event) => onAuditTargetTypeChange(event.target.value)}
          placeholder="Target type (user, tournament)"
        />
        <SelectField label="Filter audit log by administrator" hideLabel value={auditAdminUserId} onChange={(event) => onAuditAdminUserIdChange(event.target.value)}>
          <option value="">All administrators</option>
          {adminUsers.filter((user) => user.is_admin).map((user) => (
            <option value={String(user.id)} key={user.id}>{user.first_name} {user.last_name} (@{user.username})</option>
          ))}
        </SelectField>
        <TextField type="date" label="Audit start date" hideLabel value={auditDateFrom} onChange={(event) => onAuditDateFromChange(event.target.value)} />
        <TextField type="date" label="Audit end date" hideLabel value={auditDateTo} onChange={(event) => onAuditDateToChange(event.target.value)} />
        <Button variant="secondary" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} onClick={onExportAuditCsv} disabled={logs.length === 0}>
          Export CSV
        </Button>
      </TableToolbar>

      <DataTable caption="Audit log">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Admin</th>
            <th scope="col">Action</th>
            <th scope="col">Target</th>
            <th scope="col">Reason</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {auditLoading ? (
            <tr><td className={styles.stateCell} colSpan={COLUMN_COUNT}><span className={styles.helper} role="status">Loading audit log...</span></td></tr>
          ) : logs.length === 0 ? (
            <tr>
              <td className={styles.stateCell} colSpan={COLUMN_COUNT}>
                <EmptyState title="No audit entries found" description="Try clearing or broadening the audit filters." />
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td data-tone="secondary">{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
                <td>{log.admin_name || log.admin_username || `User ${log.admin_user_id}`}</td>
                <td>{log.action}</td>
                <td>{log.target_type || "-"}{log.target_id ? ` #${log.target_id}` : ""}</td>
                <td data-tone="secondary">{log.reason || "-"}</td>
                <td>
                  {log.details ? (
                    <details className={styles.disclosure}>
                      <summary className={styles.disclosureLink} aria-label={`View details for audit entry ${log.id}`}>View</summary>
                      <pre className={styles.code}>{JSON.stringify(log.details, null, 2)}</pre>
                    </details>
                  ) : "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <Pagination
        page={page}
        pageCount={totalPages}
        onPageChange={onAuditPageChange}
        summary={`Showing ${firstShown}-${lastShown} of ${total}`}
      />
    </Card>
  );
}
