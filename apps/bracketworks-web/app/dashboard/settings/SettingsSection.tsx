import type { ReactNode } from 'react';
import { Card, CardHeader } from '@bracketworks/ui';

import styles from './dashboard-settings-page.module.css';

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Inside a modal there are no cards: the section is a plain group with a divider above it. */
  inModal: boolean;
  children: ReactNode;
}

/** One tournament settings group: a Card on the page, a divided section inside a modal. */
export function SettingsSection({ id, title, description, actions, inModal, children }: SettingsSectionProps) {
  const titleId = `${id}-title`;
  if (inModal) {
    return (
      <section className={styles.modalSection} aria-labelledby={titleId}>
        <div className={styles.modalSectionHeader}>
          <div className={styles.modalSectionText}>
            <h3 id={titleId} className={styles.modalSectionTitle}>{title}</h3>
            {description ? <p className={styles.meta}>{description}</p> : null}
          </div>
          {actions}
        </div>
        {children}
      </section>
    );
  }
  return (
    <Card aria-labelledby={titleId}>
      <CardHeader title={<span id={titleId}>{title}</span>} description={description} actions={actions} />
      <div className={styles.cardBody}>{children}</div>
    </Card>
  );
}
