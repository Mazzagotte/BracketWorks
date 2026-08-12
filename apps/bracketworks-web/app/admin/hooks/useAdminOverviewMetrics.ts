import { useMemo } from "react";

import type { AdminOverviewMetric, OverviewResponse } from "../types";

export function useAdminOverviewMetrics(overview: OverviewResponse | null): AdminOverviewMetric[] {
  return useMemo(() => {
    if (!overview) return [];

    return [
      { label: "Users", value: overview.metrics.total_users.toLocaleString(), tone: "orange" },
      { label: "Tournaments", value: overview.metrics.total_tournaments.toLocaleString(), tone: "blue" },
      { label: "Entries", value: overview.metrics.total_entries.toLocaleString(), tone: "green" },
      { label: "Bracket Snapshots", value: overview.metrics.total_snapshots.toLocaleString(), tone: "slate" },
      { label: "Unverified Users", value: (overview.metrics.unverified_users ?? 0).toLocaleString(), tone: "gold" },
      { label: "Open Reviews", value: (overview.metrics.open_user_reviews ?? 0).toLocaleString(), tone: "red" },
      { label: "Tournament Notes", value: (overview.metrics.open_tournament_notes ?? 0).toLocaleString(), tone: "gold" },
      { label: "Failed Operations", value: (overview.metrics.failed_operations ?? 0).toLocaleString(), tone: "red" },
    ];
  }, [overview]);
}
