import React from 'react';
import styles from './primitives.module.css';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusPillProps {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}

export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  const toneClass =
    tone === 'info'
      ? styles.statusInfo
      : tone === 'success'
        ? styles.statusSuccess
        : tone === 'warning'
          ? styles.statusWarning
          : tone === 'danger'
            ? styles.statusDanger
            : styles.statusNeutral;

  const rootClass = [styles.statusPill, toneClass, className].filter(Boolean).join(' ');

  return <span className={rootClass}>{children}</span>;
}
