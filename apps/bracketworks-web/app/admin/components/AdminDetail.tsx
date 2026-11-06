import type { ReactNode } from "react";

import styles from "../admin.module.css";

/** A label and value pair inside an admin `<dl className={styles.details}>`. */
export function AdminDetail({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.detail}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{children}</dd>
    </div>
  );
}
