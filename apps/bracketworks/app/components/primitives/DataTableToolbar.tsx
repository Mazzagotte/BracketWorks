import React from 'react';
import styles from './primitives.module.css';

interface DataTableToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function DataTableToolbar({ left, right, className }: DataTableToolbarProps) {
  const rootClass = className ? `${styles.dataTableToolbar} ${className}` : styles.dataTableToolbar;

  return (
    <div className={rootClass}>
      <div className={styles.dataTableToolbarLeft}>{left}</div>
      <div className={styles.dataTableToolbarRight}>{right}</div>
    </div>
  );
}
