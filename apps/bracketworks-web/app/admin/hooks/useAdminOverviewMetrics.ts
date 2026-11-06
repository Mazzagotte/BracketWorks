import { useMemo } from "react";
import type { StatItem } from "@bracketworks/ui";

import type { OverviewResponse } from "../types";

/** The overview's key numbers for one StatGroup: four totals, with items that need attention as details. */
export function useAdminOverviewMetrics(overview: OverviewResponse | null): StatItem[] {
  return useMemo(() => {
    if (!overview) return [];
    const { metrics } = overview;
    const unverified = metrics.unverified_users ?? 0;
    const openReviews = metrics.open_user_reviews ?? 0;
    const openNotes = metrics.open_tournament_notes ?? 0;
    const failedOperations = metrics.failed_operations ?? 0;

    return [
      {
        label: "Users",
        value: metrics.total_users.toLocaleString(),
        detail: `${unverified.toLocaleString()} unverified`,
        detailTone: unverified > 0 ? "warning" : "default",
      },
      {
        label: "Tournaments",
        value: metrics.total_tournaments.toLocaleString(),
        detail: `${openNotes.toLocaleString()} open tournament notes`,
        detailTone: openNotes > 0 ? "warning" : "default",
      },
      {
        label: "Entries",
        value: metrics.total_entries.toLocaleString(),
        detail: `${metrics.total_snapshots.toLocaleString()} bracket snapshots`,
      },
      {
        label: "Open reviews",
        value: openReviews.toLocaleString(),
        detail: `${failedOperations.toLocaleString()} failed operations`,
        detailTone: failedOperations > 0 ? "danger" : "default",
      },
    ];
  }, [overview]);
}
