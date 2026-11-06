import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Layout.module.css';

export interface PageProps extends HTMLAttributes<HTMLElement> {
  /** `default` 1440px for app pages; `narrow` 768px for forms and reading pages. */
  width?: 'default' | 'narrow';
  as?: ElementType;
}

/** Page content area: centered, max width, page gutters, and the standard gap between cards. */
export function Page({ width = 'default', as: Tag = 'div', className, ...rest }: PageProps) {
  return <Tag className={cx(styles.page, width === 'narrow' && styles.pageNarrow, className)} {...rest} />;
}

/** Main column (2/3) and side column (1/3) on desktop; stacked below 1024px. */
export function PageColumns({ main, side, className }: { main: ReactNode; side: ReactNode; className?: string }) {
  return (
    <div className={cx(styles.columns, className)}>
      <div className={styles.column}>{main}</div>
      <div className={styles.column}>{side}</div>
    </div>
  );
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** `dense` for compact data cards; `flush` when a table should run edge to edge. */
  padding?: 'default' | 'dense' | 'flush';
  /** The whole card is a link target: hover changes only the border. */
  interactive?: boolean;
  as?: ElementType;
}

/** The only container. Never put a Card inside a Card or a Modal. */
export function Card({ padding = 'default', interactive, as: Tag = 'section', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(styles.card, padding === 'dense' && styles.dense, padding === 'flush' && styles.flush, interactive && styles.interactive, className)}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Heading level for the title. Default `h2`. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

/** Section title, optional short description, and actions on the right. */
export function CardHeader({ title, description, actions, headingLevel: Heading = 'h2', className }: CardHeaderProps) {
  return (
    <header className={cx(styles.cardHeader, className)}>
      <div className={styles.cardHeaderText}>
        <Heading className={styles.sectionTitle}>{title}</Heading>
        {description ? <p className={styles.cardDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

/** A 1px divider that separates groups inside a card. */
export function CardDivider({ className }: { className?: string }) {
  return <hr className={cx(styles.divider, className)} />;
}

export interface PageHeaderProps {
  title: ReactNode;
  /** Names the parent area. Only when it adds context. */
  overline?: ReactNode;
  /** Usually a `Badge` showing the page's status. */
  badge?: ReactNode;
  /** A line of key facts, for example "Saturday, May 30 · Snake River Bowl · 22 players". */
  description?: ReactNode;
  /** Secondary actions first, then at most one primary. */
  actions?: ReactNode;
  className?: string;
}

/** The page's single h1. Sits on the page background, never inside a card. */
export function PageHeader({ title, overline, badge, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.pageHeader, className)}>
      <div className={styles.pageHeaderText}>
        {overline ? <p className={styles.overline}>{overline}</p> : null}
        <div className={styles.pageTitleRow}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {badge}
        </div>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export interface StatItem {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  detailTone?: 'default' | 'success' | 'warning' | 'danger';
  /** Stable key when labels are not unique strings. */
  id?: string;
}

const detailToneClass = {
  default: undefined,
  success: styles.statDetailSuccess,
  warning: styles.statDetailWarning,
  danger: styles.statDetailDanger,
} as const;

export interface StatGroupProps {
  items: StatItem[];
  /** Accessible name for the group, for example "Tournament totals". */
  label: string;
  className?: string;
}

/** A page's key numbers: one card, values separated by dividers. Use once per page, under the header. */
export function StatGroup({ items, label, className }: StatGroupProps) {
  const style = { '--stat-columns': String(Math.max(1, Math.min(items.length, 6))) } as CSSProperties;
  return (
    <section aria-label={label} className={cx(styles.statGroup, className)} style={style}>
      {items.map((item, index) => (
        <div key={item.id ?? (typeof item.label === 'string' ? item.label : index)} className={styles.stat}>
          <span className={styles.statLabel}>{item.label}</span>
          <span className={styles.statValue}>{item.value}</span>
          {item.detail ? <span className={cx(styles.statDetail, detailToneClass[item.detailTone ?? 'default'])}>{item.detail}</span> : null}
        </div>
      ))}
    </section>
  );
}
