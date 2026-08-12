import { formatShortMonthDayYear } from "../../lib/formatters";

import type { AdminOverviewMetric, OverviewResponse } from "../types";
import styles from "../admin.module.css";

type AdminOverviewSectionProps = {
  overview: OverviewResponse | null;
  metrics: AdminOverviewMetric[];
};

export function AdminOverviewSection({ overview, metrics }: AdminOverviewSectionProps) {
  return (
    <div className={styles.sectionStack}>
      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <section key={metric.label} className={`${styles.metricCard} ${styles[`tone${metric.tone.charAt(0).toUpperCase()}${metric.tone.slice(1)}`]}`}>
            <div className={styles.metricLabel}>{metric.label}</div>
            <div className={styles.metricValue}>{metric.value}</div>
          </section>
        ))}
      </div>

      <div className={styles.twoColumnGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Top Operators</h3>
            <span className={styles.panelSubtle}>Most tournaments created</span>
          </div>
          <div className={styles.listStack}>
            {(overview?.top_operators || []).map((operator) => (
              <div key={operator.id} className={styles.listRow}>
                <div>
                  <div className={styles.primaryText}>{operator.name || operator.username}</div>
                  <div className={styles.secondaryText}>@{operator.username}</div>
                </div>
                <span className={styles.valuePill}>{operator.tournament_count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Recent Tournaments</h3>
            <span className={styles.panelSubtle}>Latest tournament records</span>
          </div>
          <div className={styles.listStack}>
            {(overview?.recent_tournaments || []).map((tournament) => (
              <div key={tournament.id} className={styles.listRow}>
                <div>
                  <div className={styles.primaryText}>{tournament.name}</div>
                  <div className={styles.secondaryText}>
                    {tournament.owner_name || tournament.owner_username}
                    {tournament.location ? ` - ${tournament.location}` : ""}
                  </div>
                </div>
                <span className={styles.valuePill}>#{tournament.id}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Recent Signups</h3>
          <span className={styles.panelSubtle}>Newest accounts</span>
        </div>
        <div className={styles.listStack}>
          {(overview?.recent_signups || []).map((user) => (
            <div key={user.id} className={styles.listRow}>
              <div>
                <div className={styles.primaryText}>{user.name || user.username}</div>
                <div className={styles.secondaryText}>@{user.username}</div>
              </div>
              <div className={styles.secondaryText}>
                {user.created_at ? formatShortMonthDayYear(new Date(user.created_at)) : "-"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
