import { Fragment } from "react";
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
  Pagination,
  SearchField,
  SelectField,
  TableToolbar,
  ButtonLink,
  capitalizeFirstLetter,
} from "@bracketworks/ui";
import { Archive, ArchiveRestore, Download, ExternalLink, MoreHorizontal, NotebookPen, Pencil, Trash2, UserCog } from "lucide-react";

import type {
  TournamentActivityFilter,
  TournamentRow,
  TournamentSortOption,
  TournamentsResponse,
} from "../types";
import { formatAdminTimestamp } from "../utils";
import { AdminDetail } from "./AdminDetail";
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

const COLUMN_COUNT = 11;

const humanize = (value: string) => capitalizeFirstLetter(value.replace(/_/g, " "));

function TournamentDetails({ tournament }: { tournament: TournamentRow }) {
  return (
    <div className={styles.expanded}>
      <dl className={styles.details}>
        <AdminDetail label="Scores">{tournament.score_count}</AdminDetail>
        <AdminDetail label="Payouts">{tournament.payout_count}</AdminDetail>
        <AdminDetail label="Snapshots">{tournament.snapshot_count}</AdminDetail>
        <AdminDetail label="Workflow">{humanize(tournament.workflow_status)}</AdminDetail>
        <AdminDetail label="Staff">{tournament.staff_count}</AdminDetail>
        <AdminDetail label="Brackets">{humanize(tournament.bracket_state)}</AdminDetail>
        <AdminDetail label="Score state">{humanize(tournament.score_state)}{tournament.scores_locked ? " (locked)" : ""}</AdminDetail>
        <AdminDetail label="Payout state">{humanize(tournament.payout_state)}</AdminDetail>
        <AdminDetail label="Owner email">{tournament.owner_email}</AdminDetail>
        <AdminDetail label="Last bracket activity">{formatAdminTimestamp(tournament.last_activity_at, "None")}</AdminDetail>
        <AdminDetail label="Last admin change">{formatAdminTimestamp(tournament.last_admin_change_at, "None")}</AdminDetail>
      </dl>
      {tournament.archive_reason ? <p className={styles.helper}>Archive reason: {tournament.archive_reason}</p> : null}
      <div className={styles.group}>
        <h3 className={styles.subsectionTitle}>Tournament staff</h3>
        {tournament.staff.length === 0 ? (
          <p className={styles.helper}>Owner only</p>
        ) : (
          <ul className={styles.rows}>
            {tournament.staff.map((member) => (
              <li key={member.user_id} className={styles.row}>
                <span className={styles.rowMeta}>{member.name || member.username} (@{member.username}) · {humanize(member.role)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.group}>
        <h3 className={styles.subsectionTitle}>Recent tournament activity</h3>
        {tournament.recent_audit_events.length === 0 ? (
          <p className={styles.helper}>None recorded</p>
        ) : (
          <ul className={styles.rows}>
            {tournament.recent_audit_events.map((event) => (
              <li key={event.id} className={styles.row}>
                <span className={styles.rowMeta}>{formatAdminTimestamp(event.created_at, "Unknown")} · {event.summary} · {event.user_display_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <ButtonLink variant="secondary" size="sm" href={`/view/${tournament.id}`} target="_blank" rel="noreferrer" icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}>
          Open bowler view
        </ButtonLink>
      </div>
    </div>
  );
}

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
  const { page, page_size: pageSize, total, total_pages: totalPages, tournaments } = tournamentsResponse;
  const firstShown = tournaments.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = tournaments.length === 0 ? 0 : firstShown + tournaments.length - 1;

  return (
    <Card padding="flush" aria-label="All tournaments">
      <CardHeader title="All tournaments" description={`${total} total`} />
      <TableToolbar
        search={(
          <SearchField
            label="Search tournaments"
            value={tournamentSearch}
            onChange={(event) => onTournamentSearchChange(event.target.value)}
            placeholder="Search ID, name, owner, location"
          />
        )}
      >
        <SelectField
          label="Filter tournaments by activity"
          hideLabel
          value={tournamentActivityFilter}
          onChange={(event) => onTournamentActivityFilterChange(event.target.value as TournamentActivityFilter)}
        >
          <option value="all">All activity</option>
          <option value="has_entries">Has entries</option>
          <option value="no_entries">No entries</option>
        </SelectField>
        <SelectField
          label="Sort tournaments"
          hideLabel
          value={tournamentSort}
          onChange={(event) => onTournamentSortChange(event.target.value as TournamentSortOption)}
        >
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="entries_desc">Sort: Most entries</option>
          <option value="owner_asc">Sort: Owner A-Z</option>
        </SelectField>
        <Button variant="secondary" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} onClick={onExportTournamentsCsv} disabled={tournaments.length === 0}>
          Export CSV
        </Button>
      </TableToolbar>

      <DataTable caption="All tournaments">
        <thead>
          <tr>
            <th scope="col" data-align="right">ID</th>
            <th scope="col">Name</th>
            <th scope="col">Owner</th>
            <th scope="col">Location</th>
            <th scope="col">Start</th>
            <th scope="col">End</th>
            <th scope="col" data-align="right">Squads</th>
            <th scope="col" data-align="right">Entries</th>
            <th scope="col">Status</th>
            <th scope="col">Notes</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tournamentsLoading ? (
            <tr><td className={styles.stateCell} colSpan={COLUMN_COUNT}><span className={styles.helper} role="status">Loading tournaments...</span></td></tr>
          ) : tournaments.length === 0 ? (
            <tr>
              <td className={styles.stateCell} colSpan={COLUMN_COUNT}>
                <EmptyState title="No tournaments found" description="Try changing the search, activity, or sort options." />
              </td>
            </tr>
          ) : (
            tournaments.map((tournament) => {
              const expanded = expandedTournamentIds.includes(tournament.id);
              const detailsId = `admin-tournament-details-${tournament.id}`;
              return (
                <Fragment key={tournament.id}>
                  <tr>
                    <td data-align="right">{tournament.id}</td>
                    <td>{tournament.name}</td>
                    <td title={tournament.owner_email}>{tournament.owner_name || tournament.owner_username}</td>
                    <td data-tone="secondary">{tournament.location || "-"}</td>
                    <td data-tone="secondary">{tournament.start_date || "-"}</td>
                    <td data-tone="secondary">{tournament.end_date || "-"}</td>
                    <td data-align="right">{tournament.squad_count}</td>
                    <td data-align="right">{tournament.entry_count}</td>
                    <td><Badge tone={tournament.status === "current" ? "success" : "neutral"}>{humanize(tournament.status)}</Badge></td>
                    <td>
                      <Badge tone={tournament.open_note_count > 0 ? "warning" : "neutral"}>
                        {tournament.open_note_count > 0 ? `${tournament.open_note_count} open` : "Clear"}
                      </Badge>
                    </td>
                    <td>
                      <div className={styles.cellActions}>
                        <Button
                          variant="accent-outline"
                          size="sm"
                          aria-expanded={expanded}
                          aria-controls={expanded ? detailsId : undefined}
                          aria-label={`${expanded ? "Hide" : "Show"} details for ${tournament.name}`}
                          onClick={() => onToggleTournamentExpanded(tournament.id)}
                        >
                          {expanded ? "Hide" : "Details"}
                        </Button>
                        <Menu triggerLabel={`More actions for ${tournament.name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                          <MenuItem icon={<NotebookPen size={ICON_SIZE.md} />} onSelect={() => onLoadTournamentNotes(tournament)}>Notes</MenuItem>
                          <MenuItem icon={<Pencil size={ICON_SIZE.md} />} onSelect={() => onStartEditTournament(tournament)}>Edit</MenuItem>
                          <MenuItem icon={<UserCog size={ICON_SIZE.md} />} onSelect={() => onStartReassignTournament(tournament)}>Reassign owner</MenuItem>
                          {tournament.archived_at ? (
                            <MenuItem icon={<ArchiveRestore size={ICON_SIZE.md} />} onSelect={() => onUnarchiveTournament(tournament)}>Unarchive</MenuItem>
                          ) : (
                            <MenuItem icon={<Archive size={ICON_SIZE.md} />} onSelect={() => onStartArchiveTournament(tournament)}>Archive</MenuItem>
                          )}
                          <MenuDivider />
                          <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} />} onSelect={() => onStartDeleteTournament(tournament)}>
                            Delete tournament
                          </MenuItem>
                        </Menu>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr id={detailsId}>
                      <td className={styles.expandedCell} colSpan={COLUMN_COUNT}>
                        <TournamentDetails tournament={tournament} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </DataTable>

      <Pagination
        page={page}
        pageCount={totalPages}
        onPageChange={onTournamentPageChange}
        summary={`Showing ${firstShown}-${lastShown} of ${total}`}
      />
    </Card>
  );
}
