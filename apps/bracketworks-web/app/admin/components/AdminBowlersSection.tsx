"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormGrid,
  ICON_SIZE,
  Menu,
  MenuItem,
  Modal,
  Notice,
  Pagination,
  SearchField,
  SelectField,
  TableToolbar,
  TextField,
} from "@bracketworks/ui";
import { Archive, Download, FileUp, MoreHorizontal, RotateCcw } from "lucide-react";
import { useToastHelpers } from "../../components/Toast";
import { adminApi } from "../services/adminApi";
import type { BowlerProfileOwner, BowlerProfileRow, BowlerProfilesResponse } from "../types";
import { formatAdminTimestamp } from "../utils";
import styles from "../admin.module.css";

type Props = {
  onSuccess: (message: string) => void;
};

type ImportRow = { first_name: string; last_name: string; usbc_number: string | null; average: number | null };

const emptyResponse: BowlerProfilesResponse = { profiles: [], page: 1, page_size: 25, total: 0, total_pages: 1 };
const COLUMN_COUNT = 7;

export function AdminBowlersSection({ onSuccess }: Props) {
  const { error: showError } = useToastHelpers();
  const [response, setResponse] = useState<BowlerProfilesResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingProfile, setEditingProfile] = useState<BowlerProfileRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editUsbc, setEditUsbc] = useState("");
  const [editAverage, setEditAverage] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<BowlerProfileRow | null>(null);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [owners, setOwners] = useState<BowlerProfileOwner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importSkippedRows, setImportSkippedRows] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!loadedRef.current) setLoading(true);
    void adminApi.getBowlerProfiles({
      page,
      page_size: 25,
      search,
      status,
      ...(selectedOwnerId ? { user_id: Number(selectedOwnerId) } : {}),
    })
      .then(data => { if (active) { setResponse(data); loadedRef.current = true; } })
      .catch(err => { if (active) showError(err instanceof Error ? err.message : "Failed to load bowler profiles"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, refreshKey, search, selectedOwnerId, showError, status]);

  useEffect(() => {
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") setRefreshKey(value => value + 1);
    }, 30000);
    return () => window.clearInterval(refresh);
  }, []);

  useEffect(() => {
    let active = true;
    void adminApi.getBowlerProfileOwners("")
      .then(data => { if (active) setOwners(data.users); })
      .catch(err => { if (active) showError(err instanceof Error ? err.message : "Failed to load profile owners"); });
    return () => { active = false; };
  }, [showError]);

  const beginEdit = (profile: BowlerProfileRow) => {
    setEditingProfile(profile);
    setEditFirstName(profile.first_name);
    setEditLastName(profile.last_name);
    setEditUsbc(profile.usbc_number || "");
    setEditAverage(profile.average == null ? "" : String(profile.average));
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingProfile) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await adminApi.updateBowlerProfile(editingProfile.id, {
        first_name: editFirstName,
        last_name: editLastName,
        usbc_number: editUsbc.trim() || null,
        average: editAverage.trim() ? Number(editAverage) : null,
      });
      setEditingProfile(null);
      setRefreshKey(value => value + 1);
      onSuccess("Bowler profile updated.");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update bowler profile");
    } finally {
      setEditSaving(false);
    }
  };

  const changeProfileStatus = async (profile: BowlerProfileRow) => {
    const action = profile.is_active ? "archive" : "reactivate";
    try {
      if (profile.is_active) await adminApi.archiveBowlerProfile(profile.id);
      else await adminApi.reactivateBowlerProfile(profile.id);
      setRefreshKey(value => value + 1);
      onSuccess(`Bowler profile ${action === "archive" ? "archived" : "reactivated"}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : `Failed to ${action} bowler profile`);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveSaving(true);
    try {
      await changeProfileStatus(archiveTarget);
    } finally {
      setArchiveSaving(false);
      setArchiveTarget(null);
    }
  };

  const parseImportFile = async (file: File) => {
    setImportFileName(file.name);
    setImportError(null);
    try {
      const parsed = await adminApi.parseBowlerProfileWorkbook(file);
      const rows = parsed.rows;
      setImportSkippedRows(parsed.skipped_rows);
      if (rows.length === 0) {
        setImportError("No rows with both a first and last name were found.");
        setImportRows([]);
        return;
      }
      setImportRows(rows);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unable to read this workbook");
      setImportRows([]);
    }
  };

  const commitImport = async () => {
    if (!selectedOwnerId || !importRows?.length) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await adminApi.importBowlerProfiles({ user_id: Number(selectedOwnerId), rows: importRows });
      setImportRows(null);
      setRefreshKey(value => value + 1);
      onSuccess(`Imported ${result.created} profiles; skipped ${result.duplicates} duplicates.`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import bowler profiles");
    } finally {
      setImporting(false);
    }
  };

  const exportSelectedOwnerProfiles = async () => {
    if (!selectedOwnerId) return;
    setExporting(true);
    try {
      const userId = Number(selectedOwnerId);
      const firstPage = await adminApi.getBowlerProfiles({
        page: 1,
        page_size: 200,
        search: "",
        status: "all",
        user_id: userId,
      });
      const profiles = [...firstPage.profiles];
      for (let currentPage = 2; currentPage <= firstPage.total_pages; currentPage += 1) {
        const result = await adminApi.getBowlerProfiles({
          page: currentPage,
          page_size: 200,
          search: "",
          status: "all",
          user_id: userId,
        });
        profiles.push(...result.profiles);
      }

      if (profiles.length === 0) {
        showError("This account has no bowler profiles to export.");
        return;
      }

      const columns = ["Profile ID", "First Name", "Last Name", "USBC Number", "Average"];
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = profiles.map(profile => [
        profile.id,
        profile.first_name,
        profile.last_name,
        profile.usbc_number,
        profile.average,
      ]);
      const csv = [columns, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
      const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      const owner = owners.find(item => item.id === userId);
      const safeOwner = (owner?.username || `user-${userId}`).replace(/[^a-zA-Z0-9_-]/g, "_");
      anchor.href = blobUrl;
      anchor.download = `bracketworks-bowler-profiles-${safeOwner}.csv`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
      onSuccess(`Exported ${profiles.length} bowler profiles.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to export bowler profiles");
    } finally {
      setExporting(false);
    }
  };

  const firstShown = response.profiles.length === 0 ? 0 : (response.page - 1) * response.page_size + 1;
  const lastShown = response.profiles.length === 0 ? 0 : firstShown + response.profiles.length - 1;
  const selectedOwner = owners.find(owner => String(owner.id) === selectedOwnerId);

  return (
    <Card padding="flush" aria-label="Reusable bowler profiles">
      <CardHeader
        title="Reusable bowler profiles"
        description={`${response.total} profiles. Choose a profile owner to export or import that account's profiles.`}
      />
      <TableToolbar
        search={(
          <SearchField label="Search bowler profiles" placeholder="Search name, USBC, owner" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        )}
      >
        <SelectField label="Filter bowler profiles" hideLabel value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}>
          <option value="active">Active profiles</option>
          <option value="archived">Archived profiles</option>
          <option value="all">All profiles</option>
        </SelectField>
        <SelectField label="Filter and import/export by profile owner" hideLabel value={selectedOwnerId} onChange={event => { setSelectedOwnerId(event.target.value); setPage(1); }}>
          <option value="">All profile owners</option>
          {owners.map(owner => <option value={owner.id} key={owner.id}>{owner.name || owner.username} (@{owner.username})</option>)}
        </SelectField>
        <Button variant="secondary" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} disabled={!selectedOwnerId || exporting} onClick={() => { void exportSelectedOwnerProfiles(); }}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
        <Button variant="secondary" icon={<FileUp size={ICON_SIZE.md} aria-hidden="true" />} disabled={!selectedOwnerId} onClick={() => fileInputRef.current?.click()}>
          Import Excel
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void parseImportFile(file); event.target.value = ""; }} />
      </TableToolbar>

      <DataTable caption="Reusable bowler profiles">
        <thead>
          <tr>
            <th scope="col">Bowler</th>
            <th scope="col">USBC</th>
            <th scope="col" data-align="right">Average</th>
            <th scope="col">Profile owner</th>
            <th scope="col">Status</th>
            <th scope="col">Updated</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td className={styles.stateCell} colSpan={COLUMN_COUNT}><span className={styles.helper} role="status">Loading bowler profiles...</span></td></tr>
          ) : response.profiles.length === 0 ? (
            <tr>
              <td className={styles.stateCell} colSpan={COLUMN_COUNT}>
                <EmptyState title="No bowler profiles found" description="Try a different search or status filter." />
              </td>
            </tr>
          ) : response.profiles.map(profile => {
            const name = `${profile.first_name} ${profile.last_name}`;
            return (
              <tr key={profile.id}>
                <td>
                  <span className={styles.cellStack}>
                    <span className={styles.cellTitle}>{name}</span>
                    <span className={styles.cellMeta}>Profile #{profile.id}</span>
                  </span>
                </td>
                <td data-tone="secondary">{profile.usbc_number || "-"}</td>
                <td data-align="right">{profile.average ?? "-"}</td>
                <td>
                  <span className={styles.cellStack}>
                    <span>{profile.owner_name || profile.owner_username}</span>
                    <span className={styles.cellMeta}>@{profile.owner_username} · {profile.owner_email}</span>
                  </span>
                </td>
                <td><Badge tone={profile.is_active ? "success" : "neutral"}>{profile.is_active ? "Active" : "Archived"}</Badge></td>
                <td data-tone="secondary">{formatAdminTimestamp(profile.updated_at, "Unknown")}</td>
                <td>
                  <div className={styles.cellActions}>
                    <Button variant="accent-outline" size="sm" aria-label={`Edit ${name}`} onClick={() => beginEdit(profile)}>
                      Edit
                    </Button>
                    <Menu triggerLabel={`More actions for ${name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                      {profile.is_active ? (
                        <MenuItem tone="danger" icon={<Archive size={ICON_SIZE.md} />} onSelect={() => setArchiveTarget(profile)} aria-label={`Archive ${name}`}>
                          Archive profile
                        </MenuItem>
                      ) : (
                        <MenuItem icon={<RotateCcw size={ICON_SIZE.md} />} onSelect={() => { void changeProfileStatus(profile); }} aria-label={`Reactivate ${name}`}>
                          Reactivate profile
                        </MenuItem>
                      )}
                    </Menu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      <Pagination
        page={response.page}
        pageCount={response.total_pages}
        onPageChange={setPage}
        summary={`Showing ${firstShown}-${lastShown} of ${response.total}`}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title={`Archive ${archiveTarget ? `${archiveTarget.first_name} ${archiveTarget.last_name}` : "bowler profile"}?`}
        description="The profile is hidden from new entries. Tournament history is preserved, and you can reactivate it later."
        confirmLabel="Archive profile"
        busyLabel="Archiving..."
        tone="danger"
        busy={archiveSaving}
        onConfirm={() => { void confirmArchive(); }}
        onCancel={() => setArchiveTarget(null)}
      />

      <Modal
        open={Boolean(editingProfile)}
        onClose={() => setEditingProfile(null)}
        title="Edit bowler profile"
        closeLabel="Close bowler editor"
        dismissible={!editSaving}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditingProfile(null)} disabled={editSaving}>Cancel</Button>
            <Button variant="primary" disabled={editSaving || !editFirstName.trim() || !editLastName.trim()} onClick={() => { void saveEdit(); }}>
              {editSaving ? "Saving..." : "Save changes"}
            </Button>
          </>
        )}
      >
        {editingProfile ? (
          <div className={styles.stack}>
            {editError ? <Notice tone="danger" role="alert">{editError}</Notice> : null}
            <FormGrid>
              <TextField id="profile-first-name" label="First name" value={editFirstName} onChange={event => setEditFirstName(event.target.value)} />
              <TextField id="profile-last-name" label="Last name" value={editLastName} onChange={event => setEditLastName(event.target.value)} />
              <TextField id="profile-usbc" label="USBC number" optional value={editUsbc} onChange={event => setEditUsbc(event.target.value)} />
              <TextField id="profile-average" label="Average" optional type="number" min="0" max="300" step="1" value={editAverage} onChange={event => setEditAverage(event.target.value)} />
            </FormGrid>
            <p className={styles.helper}>{editingProfile.linked_entry_count} tournament entries will keep their history and receive the updated name and USBC number.</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(importRows)}
        onClose={() => setImportRows(null)}
        title="Review bowler import"
        description={`${importFileName} · ${importRows?.length ?? 0} profiles`}
        size="lg"
        closeLabel="Close import preview"
        dismissible={!importing}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setImportRows(null)} disabled={importing}>Cancel</Button>
            <Button variant="primary" onClick={() => { void commitImport(); }} disabled={importing || !importRows?.length || !selectedOwnerId}>
              {importing ? "Importing..." : `Import ${importRows?.length ?? 0} profiles`}
            </Button>
          </>
        )}
      >
        {importRows ? (
          <div className={styles.stack}>
            {importError ? <Notice tone="danger" role="alert">{importError}</Notice> : null}
            {importRows.length > 0 ? (
              <DataTable caption="Profiles to import">
                <thead>
                  <tr>
                    <th scope="col">First name</th>
                    <th scope="col">Last name</th>
                    <th scope="col">USBC</th>
                    <th scope="col" data-align="right">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 100).map((row, index) => (
                    <tr key={`${row.usbc_number || row.first_name}-${index}`}>
                      <td>{row.first_name}</td>
                      <td>{row.last_name}</td>
                      <td data-tone="secondary">{row.usbc_number || "-"}</td>
                      <td data-align="right">{row.average ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : null}
            {importRows.length > 100 ? <p className={styles.helper}>Showing the first 100 rows; all {importRows.length} will be imported.</p> : null}
            {importSkippedRows > 0 ? <p className={styles.helper}>{importSkippedRows} row{importSkippedRows === 1 ? " was" : "s were"} skipped because the name was incomplete.</p> : null}
            <p className={styles.helper}>Owner: {selectedOwner?.name || "Selected account"}. Existing profiles with a matching USBC number or name will be skipped.</p>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
