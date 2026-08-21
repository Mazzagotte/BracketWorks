import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import OrganizerAuthGuard from '@/components/organizer/OrganizerAuthGuard';
import OrganizerTopNav from '@/components/organizer/OrganizerTopNav';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: 'Organizer Dashboard | Tournament Central',
  robots: { index: false, follow: false },
};

export default function OrganizerLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizerAuthGuard>
      <div className={styles.shell}>
        <OrganizerTopNav />
        <main className={styles.content}>{children}</main>
      </div>
    </OrganizerAuthGuard>
  );
}
