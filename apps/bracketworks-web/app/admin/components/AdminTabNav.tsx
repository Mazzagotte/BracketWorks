import type { AdminTab } from "../types";
import { TAB_LABELS } from "../types";
import styles from "../admin.module.css";

type AdminTabNavProps = {
  activeTab: AdminTab;
  isDevelopment: boolean;
  onTabChange: (tab: AdminTab) => void;
};

export function AdminTabNav({ activeTab, isDevelopment, onTabChange }: AdminTabNavProps) {
  const tabs: AdminTab[] = [
    "overview",
    "users",
    "tournaments",
    "announcements",
    "operations",
    "audit",
    "changelog",
    ...(isDevelopment ? ["database" as AdminTab] : []),
  ];

  return (
    <nav className={styles.adminNav} aria-label="Admin sections">
      <div className={styles.tabRow}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </nav>
  );
}
