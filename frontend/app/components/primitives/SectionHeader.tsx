import React from 'react';
import styles from './primitives.module.css';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, actions, className }: SectionHeaderProps) {
  const rootClass = className ? `${styles.sectionHeader} ${className}` : styles.sectionHeader;

  return (
    <header className={rootClass}>
      <div className={styles.sectionHeaderText}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.sectionHeaderActions}>{actions}</div> : null}
    </header>
  );
}
