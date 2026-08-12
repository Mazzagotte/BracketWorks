import { Fragment } from "react";

import { DataTableToolbar } from "../../components/primitives";

import type {
  TournamentActivityFilter,
  TournamentRow,
  TournamentSortOption,
  TournamentsResponse,
} from "../types";
import { formatAdminTimestamp } from "../utils";
import styles from "../admin.module.css";

type AdminTournamentsSectionProps = {
  tournamentsResponse: TournamentsResponse;
  tournamentsLoading: boolean;
  tournamentSearch: string;
  tournamentActivityFilter: TournamentActivityFilter;
  tournamentSort: TournamentSortOption;
  expandedTournamentIds: number[];
  onTournamentSearchChange: (value: string) => void;
  onTournamentActivityFilterChange: (value: TournamentActivityFilter) => void;
  onTournamentSortChange: (value: TournamentSortOption) => void;
  onTournamentPageChange: (value: number) => void;
  onExportTournamentsCsv: () => void;
  onLoadTournamentNotes: (tournament: TournamentRow) => void;
  onStartEditTournament: (tournament: TournamentRow) => void;
  onStartReassignTournament: (tournament: TournamentRow) => void;
  onUnarchiveTournament: (tournament: TournamentRow) => void;
  onStartArchiveTournament: (tournament: TournamentRow) => void;
  onStartDeleteTournament: (tournament: TournamentRow) => void;
  onToggleTournamentExpanded: (id: number) => void;
};

export function AdminTournamentsSection({
  tournamentsResponse,
  tournamentsLoading,
  tournamentSearch,
  tournamentActivityFilter,
  tournamentSort,
  expandedTournamentIds,
  onTournamentSearchChange,
  onTournamentActivityFilterChange,
  onTournamentSortChange,
  onTournamentPageChange,
  onExportTournamentsCsv,
  onLoadTournamentNotes,
  onStartEditTournament,
  onStartReassignTournament,
  onUnarchiveTournament,
  onStartArchiveTournament,
  onStartDeleteTournament,
  onToggleTournamentExpanded,
}: AdminTournamentsSectionProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>All Tournaments</h3>
        <span className={styles.panelSubtle}>{tournamentsResponse.total} total</span>
      </div>

      <DataTableToolbar
        className={styles.toolbarRow}
        left={(
          <input
            type="text"
            className={styles.toolbarInput}
            aria-label="Search tournaments"
            value={tournamentSearch}
            onChange={(event) => onTournamentSearchChange(event.target.value)}
            placeholder="Search name, owner, location"
          />
        )}
        right={(
          <>
            <select
              className={styles.toolbarSelect}
              aria-label="Filter tournaments by activity"
              value={tournamentActivityFilter}
              onChange={(event) => onTournamentActivityFilterChange(event.target.value as TournamentActivityFilter)}
            >
              <option value="all">All activity</option>
              <option value="has_entries">Has entries</option>
              <option value="no_entries">No entries</option>
            </select>
            <select
              className={styles.toolbarSelect}
              aria-label="Sort tournaments"
              value={tournamentSort}
              onChange={(event) => onTournamentSortChange(event.target.value as TournamentSortOption)}
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="entries_desc">Sort: Most entries</option>
              <option value="owner_asc">Sort: Owner A-Z</option>
            </select>
            <button type="button" className={styles.actionBtn} onClick={onExportTournamentsCsv} disabled={tournamentsResponse.tournaments.length === 0}>Export CSV</button>
          </>
        )}
      />

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
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournamentsLoading ? (
              <tr><td className={styles.tableState} colSpan={11}><span role="status">Loading tournaments…</span></td></tr>
            ) : tournamentsResponse.tournaments.length === 0 ? (
              <tr><td className={styles.tableState} colSpan={11}><strong>No tournaments found</strong><span>Try changing the search, activity, or sort options.</span></td></tr>
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
                      <td><span className={`${styles.statusPill} ${tournament.status === "current" ? styles.statusActive : styles.statusDraft}`}>{tournament.status}</span></td>
                      <td><span className={`${styles.statusPill} ${tournament.open_note_count > 0 ? styles.statusDraft : styles.statusActive}`}>{tournament.open_note_count > 0 ? `${tournament.open_note_count} open` : "Clear"}</span></td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => onLoadTournamentNotes(tournament)}
                          >
                            Notes
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => onStartEditTournament(tournament)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => onStartReassignTournament(tournament)}
                          >
                            Reassign
                          </button>
                          {tournament.archived_at ? (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => onUnarchiveTournament(tournament)}
                            >
                              Unarchive
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => onStartArchiveTournament(tournament)}
                            >
                              Archive
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => onStartDeleteTournament(tournament)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => onToggleTournamentExpanded(tournament.id)}
                          >
                            {expanded ? "Hide" : "Details"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={11}>
                          <div className={styles.detailCard}>
                            <div className={styles.detailGrid}>
                              <div><strong>Scores:</strong> {tournament.score_count}</div>
                              <div><strong>Payouts:</strong> {tournament.payout_count}</div>
                              <div><strong>Snapshots:</strong> {tournament.snapshot_count}</div>
                              <div><strong>Owner Email:</strong> {tournament.owner_email}</div>
                              <div><strong>Last bracket activity:</strong> {formatAdminTimestamp(tournament.last_activity_at, "None")}</div>
                              <div><strong>Last admin change:</strong> {formatAdminTimestamp(tournament.last_admin_change_at, "None")}</div>
                            </div>
                            {tournament.archive_reason && (
                              <div className={styles.detailNote}>Archive reason: {tournament.archive_reason}</div>
                            )}
                            <div className={styles.detailLinks}>
                              <a className={styles.linkBtn} href={`/view/${tournament.id}`} target="_blank" rel="noreferrer">Open Bowler View</a>
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
          onClick={() => onTournamentPageChange(Math.max(1, tournamentsResponse.page - 1))}
          disabled={tournamentsResponse.page <= 1 || tournamentsLoading}
        >
          Prev
        </button>
        <span className={styles.secondaryText}>Page {tournamentsResponse.page} of {tournamentsResponse.total_pages}</span>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onTournamentPageChange(Math.min(tournamentsResponse.total_pages, tournamentsResponse.page + 1))}
          disabled={tournamentsResponse.page >= tournamentsResponse.total_pages || tournamentsLoading}
        >
          Next
        </button>
      </div>
    </section>
  );
}
