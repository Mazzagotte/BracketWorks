import React from 'react';
import { DataTableToolbar } from './DataTableToolbar';
import styles from './primitives.module.css';
import cardStyles from '../../styles/cards.module.css';

interface SearchPanelProps {
  title?: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  toolbarClassName?: string;
  useToolbar?: boolean;
}

export function SearchPanel({
  title,
  subtitle,
  left,
  right,
  className,
  toolbarClassName,
  useToolbar = true,
}: SearchPanelProps) {
  const rootClass = className
    ? `${cardStyles.card} ${cardStyles.accentCard} ${styles.searchPanel} ${className}`
    : `${cardStyles.card} ${cardStyles.accentCard} ${styles.searchPanel}`;
  const composedToolbarClass = toolbarClassName
    ? `${styles.searchPanelToolbar} ${toolbarClassName}`
    : styles.searchPanelToolbar;

  return (
    <div className={rootClass}>
      {(title || subtitle) && (
        <div className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.searchPanelHeader}`}>
          {title && <h3 className={styles.searchPanelTitle}>{title}</h3>}
          {subtitle && <p className={styles.searchPanelSubtitle}>{subtitle}</p>}
        </div>
      )}
      <div className={styles.searchPanelBody}>
        {useToolbar ? (
          <DataTableToolbar className={composedToolbarClass} left={left} right={right} />
        ) : (
          <div className={styles.searchPanelContentRow}>
            <div className={styles.searchPanelContentLeft}>{left}</div>
            {right ? <div className={styles.searchPanelContentRight}>{right}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
