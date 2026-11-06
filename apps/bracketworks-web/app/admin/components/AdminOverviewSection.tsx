import type { ReactNode } from "react";
import { Card, CardHeader, StatGroup } from "@bracketworks/ui";
import type { StatItem } from "@bracketworks/ui";

import { formatShortMonthDayYear } from "../../lib/formatters";
import type { OverviewResponse } from "../types";
import styles from "../admin.module.css";

type AdminOverviewSectionProps = {
  overview: OverviewResponse | null;
  metrics: StatItem[];
};

function OverviewList({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className={styles.helper}>{empty}</p>;
  return <ul className={styles.rows}>{children}</ul>;
}

export function AdminOverviewSection({ overview, metrics }: AdminOverviewSectionProps) {
  return (
    <>
      {metrics.length > 0 ? <StatGroup label="Platform totals" items={metrics} /> : null}

      <div className={styles.twoColumn}>
        <Card>
          <CardHeader title="Top operators" description="Most tournaments created" />
          <OverviewList empty="No operators yet.">
            {(overview?.top_operators || []).map((operator) => (
              <li key={operator.id} className={styles.row}>
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{operator.name || operator.username}</span>
                  <span className={styles.rowMeta}>@{operator.username}</span>
                </div>
                <span className={styles.rowValue} aria-label={`${operator.tournament_count} tournaments`}>
                  {operator.tournament_count}
                </span>
              </li>
            ))}
          </OverviewList>
        </Card>

        <Card>
          <CardHeader title="Recent tournaments" description="Latest tournament records" />
          <OverviewList empty="No tournaments yet.">
            {(overview?.recent_tournaments || []).map((tournament) => (
              <li key={tournament.id} className={styles.row}>
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{tournament.name}</span>
                  <span className={styles.rowMeta}>
                    {tournament.owner_name || tournament.owner_username}
                    {tournament.location ? ` · ${tournament.location}` : ""}
                  </span>
                </div>
                <span className={styles.rowMeta}>#{tournament.id}</span>
              </li>
            ))}
          </OverviewList>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent signups" description="Newest accounts" />
        <OverviewList empty="No signups yet.">
          {(overview?.recent_signups || []).map((user) => (
            <li key={user.id} className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.rowTitle}>{user.name || user.username}</span>
                <span className={styles.rowMeta}>@{user.username}</span>
              </div>
              <span className={styles.rowMeta}>
                {user.created_at ? formatShortMonthDayYear(new Date(user.created_at)) : "-"}
              </span>
            </li>
          ))}
        </OverviewList>
      </Card>
    </>
  );
}
