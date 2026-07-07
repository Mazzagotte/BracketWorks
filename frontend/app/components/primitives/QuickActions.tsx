import React from 'react';
import styles from './primitives.module.css';

interface QuickActionsProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function QuickActions({ left, right, className }: QuickActionsProps) {
  const rootClass = className ? `${styles.quickActions} ${className}` : styles.quickActions;

  return (
    <div className={rootClass}>
      <div className={styles.quickActionsGroup}>{left}</div>
      <div className={styles.quickActionsGroup}>{right}</div>
    </div>
  );
}
