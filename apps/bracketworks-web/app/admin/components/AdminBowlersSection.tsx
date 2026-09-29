"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Pencil, RotateCcw, Trash2 } from "lucide-react";
import CloseControl from "../../../components/CloseControl";
import { useModalBehavior } from "../../hooks/useModalBehavior";
import { useToastHelpers } from "../../components/Toast";
import { adminApi } from "../services/adminApi";
import type { BowlerProfileOwner, BowlerProfileRow, BowlerProfilesResponse } from "../types";
import { formatAdminTimestamp } from "../utils";
import buttonStyles from "../../styles/buttons.module.css";
import styles from "../admin.module.css";

type Props = {
  onSuccess: (message: string) => void;
};

type ImportRow = { first_name: string; last_name: string; usbc_number: string | null; average: number | null };

const emptyResponse: BowlerProfilesResponse = { profiles: [], page: 1, page_size: 25, total: 0, total_pages: 1 };

export function AdminBowlersSection({ onSuccess }: Props) {
  const { error: showError } = useToastHelpers();
  const [response, setResponse] = useState<BowlerProfilesResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
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
  const [owners, setOwners] = useState<BowlerProfileOwner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importSkippedRows, setImportSkippedRows] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const importDialogRef = useRef<HTMLDivElement>(null);

  const { onOverlayClick: onEditOverlayClick } = useModalBehavior({
    open: Boolean(editingProfile),
    onClose: () => setEditingProfile(null),
    dialogRef: editDialogRef,
  });
  const { onOverlayClick: onImportOverlayClick } = useModalBehavior({
    open: Boolean(importRows),
    onClose: () => setImportRows(null),
    dialogRef: importDialogRef,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    void adminApi.getBowlerProfiles({
      page,
      page_size: 25,
      search,
      status,
      ...(selectedOwnerId ? { user_id: Number(selectedOwnerId) } : {}),
    })
      .then(data => { if (active) setResponse(data); })
      .catch(err => { if (active) showError(err instanceof Error ? err.message : "Failed to load bowler profiles"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, refreshKey, search, selectedOwnerId, showError, status]);

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
    if (profile.is_active && !window.confirm(`Archive ${profile.first_name} ${profile.last_name}? Tournament history will be preserved.`)) return;
    try {
      if (profile.is_active) await adminApi.archiveBowlerProfile(profile.id);
      else await adminApi.reactivateBowlerProfile(profile.id);
      setRefreshKey(value => value + 1);
      onSuccess(`Bowler profile ${action === "archive" ? "archived" : "reactivated"}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : `Failed to ${action} bowler profile`);
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

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Reusable Bowler Profiles</h3>
        <span className={styles.panelSubtle}>{response.total} profiles</span>
      </div>
      <div className={styles.toolbarRow}>
        <div>
          <input className={styles.toolbarInput} aria-label="Search bowler profiles" placeholder="Search name, USBC, owner" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
          <select className={styles.toolbarSelect} aria-label="Filter bowler profiles" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}>
            <option value="active">Active profiles</option><option value="archived">Archived profiles</option><option value="all">All profiles</option>
          </select>
        </div>
        <div>
          <select className={styles.toolbarSelect} aria-label="Filter and import/export by profile owner" value={selectedOwnerId} onChange={event => { setSelectedOwnerId(event.target.value); setPage(1); }}>
            <option value="">All profile owners</option>
            {owners.map(owner => <option value={owner.id} key={owner.id}>{owner.name || owner.username} (@{owner.username})</option>)}
          </select>
          <button type="button" className={styles.actionBtn} disabled={!selectedOwnerId || exporting} onClick={() => { void exportSelectedOwnerProfiles(); }}><Download aria-hidden="true" size={15} /> {exporting ? "Exporting…" : "Export CSV"}</button>
          <button type="button" className={styles.actionBtn} disabled={!selectedOwnerId} onClick={() => fileInputRef.current?.click()}><FileUp aria-hidden="true" size={15} /> Import Excel</button>
          <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void parseImportFile(file); event.target.value = ""; }} />
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Bowler</th><th>USBC</th><th>Average</th><th>Profile owner</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td className={styles.tableState} colSpan={7}><span role="status">Loading bowler profiles…</span></td></tr> : response.profiles.length === 0 ? <tr><td className={styles.tableState} colSpan={7}><strong>No bowler profiles found</strong><span>Try a different search or status filter.</span></td></tr> : response.profiles.map(profile => (
              <tr key={profile.id}>
                <td><strong>{profile.first_name} {profile.last_name}</strong><br /><span className={styles.secondaryText}>Profile #{profile.id}</span></td>
                <td>{profile.usbc_number || "-"}</td>
                <td>{profile.average ?? "-"}</td>
                <td>{profile.owner_name || profile.owner_username}<br /><span className={styles.secondaryText}>@{profile.owner_username} · {profile.owner_email}</span></td>
                <td><span className={`${styles.statusPill} ${profile.is_active ? styles.statusActive : styles.statusInactive}`}>{profile.is_active ? "Active" : "Archived"}</span></td>
                <td>{formatAdminTimestamp(profile.updated_at, "Unknown")}</td>
                <td><div className={styles.rowActions}>
                  <button type="button" className={styles.actionBtn} aria-label={`Edit ${profile.first_name} ${profile.last_name}`} onClick={() => beginEdit(profile)}><Pencil aria-hidden="true" size={14} /> Edit</button>
                  <button type="button" className={`${styles.actionBtn} ${profile.is_active ? styles.actionBtnDanger : ""}`} aria-label={`${profile.is_active ? "Archive" : "Reactivate"} ${profile.first_name} ${profile.last_name}`} onClick={() => { void changeProfileStatus(profile); }}>
                    {profile.is_active ? <Trash2 aria-hidden="true" size={14} /> : <RotateCcw aria-hidden="true" size={14} />}{profile.is_active ? "Archive" : "Reactivate"}
                  </button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.paginationRow}>
        <button type="button" className={styles.actionBtn} onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Prev</button>
        <span className={styles.secondaryText}>Page {response.page} of {response.total_pages}</span>
        <button type="button" className={styles.actionBtn} onClick={() => setPage(value => Math.min(response.total_pages, value + 1))} disabled={page >= response.total_pages || loading}>Next</button>
      </div>

      {editingProfile && (
        <div className={styles.modalOverlay} onClick={onEditOverlayClick}>
          <div ref={editDialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-label={`Edit ${editingProfile.first_name} ${editingProfile.last_name}`} tabIndex={-1}>
            <div className={styles.modalHeader}><h3 className={styles.modalTitle}>Edit Bowler Profile</h3><CloseControl size="sm" label="Close bowler editor" onClick={() => setEditingProfile(null)} /></div>
            <div className={styles.modalBody}>
              {editError && <div className={styles.modalError} role="alert">{editError}</div>}
              <div className={styles.formRow}><label className={styles.formLabel} htmlFor="profile-first-name">First name</label><input id="profile-first-name" className={styles.formInput} value={editFirstName} onChange={event => setEditFirstName(event.target.value)} /></div>
              <div className={styles.formRow}><label className={styles.formLabel} htmlFor="profile-last-name">Last name</label><input id="profile-last-name" className={styles.formInput} value={editLastName} onChange={event => setEditLastName(event.target.value)} /></div>
              <div className={styles.formRow}><label className={styles.formLabel} htmlFor="profile-usbc">USBC number</label><input id="profile-usbc" className={styles.formInput} value={editUsbc} onChange={event => setEditUsbc(event.target.value)} /></div>
              <div className={styles.formRow}><label className={styles.formLabel} htmlFor="profile-average">Average</label><input id="profile-average" className={styles.formInput} type="number" min="0" max="300" step="1" value={editAverage} onChange={event => setEditAverage(event.target.value)} /></div>
              <p className={styles.secondaryText}>{editingProfile.linked_entry_count} tournament entries will keep their history and receive the updated name/USBC.</p>
            </div>
            <div className={styles.modalFooter}><button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setEditingProfile(null)}>Cancel</button><button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} disabled={editSaving || !editFirstName.trim() || !editLastName.trim()} onClick={() => { void saveEdit(); }}>{editSaving ? "Saving…" : "Save changes"}</button></div>
          </div>
        </div>
      )}

      {importRows && (
        <div className={styles.modalOverlay} onClick={onImportOverlayClick}>
          <div ref={importDialogRef} className={`${styles.modal} ${styles.reviewModal}`} role="dialog" aria-modal="true" aria-label="Review bowler profile import" tabIndex={-1}>
            <div className={styles.modalHeader}><div><h3 className={styles.modalTitle}>Review Bowler Import</h3><div className={styles.secondaryText}>{importFileName} · {importRows.length} profiles</div></div><CloseControl size="sm" label="Close import preview" onClick={() => setImportRows(null)} /></div>
            <div className={styles.modalBody}>
              {importError && <div className={styles.modalError} role="alert">{importError}</div>}
              {importRows.length > 0 && <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>First name</th><th>Last name</th><th>USBC</th><th>Average</th></tr></thead><tbody>{importRows.slice(0, 100).map((row, index) => <tr key={`${row.usbc_number || row.first_name}-${index}`}><td>{row.first_name}</td><td>{row.last_name}</td><td>{row.usbc_number || "-"}</td><td>{row.average ?? "-"}</td></tr>)}</tbody></table>{importRows.length > 100 && <p className={styles.secondaryText}>Showing first 100 rows; all {importRows.length} will be imported.</p>}</div>}
              {importSkippedRows > 0 && <p className={styles.secondaryText}>{importSkippedRows} row{importSkippedRows === 1 ? " was" : "s were"} skipped because the name was incomplete.</p>}
              <p className={styles.secondaryText}>Owner: {owners.find(owner => String(owner.id) === selectedOwnerId)?.name || "Selected account"}. Existing profiles with matching USBC or name will be skipped.</p>
            </div>
            <div className={styles.modalFooter}><button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} onClick={() => setImportRows(null)} disabled={importing}>Cancel</button><button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} onClick={() => { void commitImport(); }} disabled={importing || !importRows.length || !selectedOwnerId}>{importing ? "Importing…" : `Import ${importRows.length} profiles`}</button></div>
          </div>
        </div>
      )}
    </section>
  );
}