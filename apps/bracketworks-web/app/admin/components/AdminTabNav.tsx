import { navItemClassName } from "@bracketworks/ui";

import type { AdminTab } from "../types";
import { TAB_LABELS } from "../types";
import styles from "../admin.module.css";

type AdminTabNavProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
};

const TABS: AdminTab[] = [
  "overview",
  "users",
  "tournaments",
  "bowlers",
  "announcements",
  "messages",
  "audit",
  "changelog",
];

export function AdminTabNav({ activeTab, onTabChange }: AdminTabNavProps) {
  return (
    <nav aria-label="Admin sections">
      <ul className={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <li key={tab}>
              <button
                type="button"
                className={navItemClassName(active, styles.tab)}
                aria-current={active ? "true" : undefined}
                onClick={() => onTabChange(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
