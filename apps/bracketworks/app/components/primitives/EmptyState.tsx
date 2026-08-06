import React from 'react';
import styles from './primitives.module.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, actions, className }: EmptyStateProps) {
  const rootClass = className ? `${styles.emptyState} ${className}` : styles.emptyState;

  return (
    <section className={rootClass} role="status" aria-live="polite">
      <h3 className={styles.emptyStateTitle}>{title}</h3>
      {description ? <p className={styles.emptyStateDescription}>{description}</p> : null}
      {actions ? <div className={styles.emptyStateActions}>{actions}</div> : null}
    </section>
  );
}
