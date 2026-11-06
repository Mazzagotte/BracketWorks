import type { ReactNode } from 'react';

import { Card } from './Layout';
import { cx } from './cx';
import styles from './AuthShell.module.css';

export interface AuthFeature {
  title: string;
  description: string;
}

export interface AuthShellProps {
  /** Product mark and name, usually a link home. */
  brand: ReactNode;
  /** Short intro heading beside the form, for example "Your tournament starts here." */
  introTitle: string;
  introText: ReactNode;
  /** Up to three short points; shown as divider rows, never as icon tiles. */
  features?: readonly AuthFeature[];
  /** One line linking to the sister product. */
  crossLink?: ReactNode;
  /** The page's single h1, inside the form card. */
  title: string;
  subtitle?: ReactNode;
  /** Shown under the form, for example "New here? Create an account". */
  switchRow?: ReactNode;
  /** One body-small footer line. */
  footer: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Shared frame for login, signup, forgot password, and verify email in both products:
 * a short intro beside one form card (docs/ui-standards.md rule 1.9).
 */
export function AuthShell({
  brand,
  introTitle,
  introText,
  features = [],
  crossLink,
  title,
  subtitle,
  switchRow,
  footer,
  children,
  className,
}: AuthShellProps) {
  return (
    <div className={cx(styles.page, className)}>
      <main className={cx('bw-standard', styles.shell)}>
        <section className={styles.intro} aria-labelledby="auth-intro-title">
          <div className={styles.brand}>{brand}</div>
          <div className={styles.introText}>
            <h2 id="auth-intro-title" className={styles.introTitle}>{introTitle}</h2>
            <p className={styles.body}>{introText}</p>
          </div>
          {features.length > 0 ? (
            <ul className={styles.features}>
              {features.map((feature) => (
                <li key={feature.title}>
                  <span className={styles.featureTitle}>{feature.title}</span>
                  <span className={styles.helper}>{feature.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {crossLink ? <p className={styles.helper}>{crossLink}</p> : null}
        </section>

        <Card className={styles.card}>
          <header className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>{title}</h1>
            {subtitle ? <p className={styles.body}>{subtitle}</p> : null}
          </header>
          {children}
          {switchRow ? <p className={styles.switchRow}>{switchRow}</p> : null}
        </Card>
      </main>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
}
