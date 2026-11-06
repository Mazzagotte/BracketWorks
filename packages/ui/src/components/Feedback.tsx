import type { ReactNode } from 'react';
import { ICON_SIZE } from '../iconSize';
import { cx } from './cx';
import styles from './Feedback.module.css';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const badgeToneClass: Record<StatusTone, string | undefined> = {
  neutral: styles.badgeNeutral,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
  accent: styles.badgeAccent,
};

export interface BadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

/** Status pill. Sentence case; the words carry the meaning, the color supports it. */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return <span className={cx(styles.badge, badgeToneClass[tone], className)}>{children}</span>;
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

const noticeToneClass: Record<NoticeTone, string | undefined> = {
  info: styles.noticeInfo,
  success: styles.noticeSuccess,
  warning: styles.noticeWarning,
  danger: styles.noticeDanger,
};

function StatusIcon({ tone }: { tone: NoticeTone }) {
  const size = ICON_SIZE.md;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (tone === 'warning') {
    return (
      <svg {...common}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (tone === 'success') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (tone === 'danger') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  /** A link or ghost button on the right, for example "Review". */
  action?: ReactNode;
  /** `status` (polite) for updates, `alert` for errors that need attention now. */
  role?: 'status' | 'alert';
  className?: string;
}

/** Page or inline message. Not a card, so it may sit inside one. */
export function Notice({ tone = 'info', children, action, role, className }: NoticeProps) {
  return (
    <div role={role} className={cx(styles.notice, noticeToneClass[tone], className)}>
      <span className={styles.noticeIcon}><StatusIcon tone={tone} /></span>
      <span className={styles.noticeMessage}>{children}</span>
      {action ? <span className={styles.noticeAction}>{action}</span> : null}
    </div>
  );
}

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible name, for example "Bowlers scored". */
  label: string;
  /** Visible text, for example "21 of 32 scored". Always shown. */
  valueText: ReactNode;
  className?: string;
}

/** Solid fill, never a gradient. Turns success-green when complete. */
export function ProgressBar({ value, max, label, valueText, className }: ProgressBarProps) {
  const complete = max > 0 && value >= max;
  return (
    <div className={cx(styles.progress, className)}>
      <progress className={cx(styles.progressBar, complete && styles.progressComplete)} value={value} max={max} aria-label={label} />
      <span className={styles.progressText}>{valueText}</span>
    </div>
  );
}

export interface EmptyStateProps {
  /** A Lucide icon at `ICON_SIZE['2xl']`. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** One action. */
  action?: ReactNode;
  className?: string;
}

/** No-data state. Goes inside the card that would hold the data. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      {icon ? <span className={styles.emptyIcon} aria-hidden="true">{icon}</span> : null}
      <h3 className={styles.emptyTitle}>{title}</h3>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export interface ActivityItem {
  id: string;
  title: ReactNode;
  /** Timestamp text, for example "Oct 1, 5:56 PM". */
  time: ReactNode;
  /** One line, for example "Reason: corrected score · James Mazzagotte". */
  detail?: ReactNode;
}

/** History and audit rows separated by dividers. */
export function ActivityList({ items, className }: { items: ActivityItem[]; className?: string }) {
  return (
    <ul className={cx(styles.activityList, className)}>
      {items.map((item) => (
        <li key={item.id} className={styles.activityItem}>
          <span className={styles.activityTitle}>{item.title}</span>
          <span className={styles.activityTime}>{item.time}</span>
          {item.detail ? <span className={styles.activityDetail}>{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Initials in a neutral circle. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (
    <span className={cx(styles.avatar, className)} aria-hidden="true" title={name}>
      {initials}
    </span>
  );
}
