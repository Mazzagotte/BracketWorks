'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import DevNoticeModal from './DevNoticeModal';
import ChangelogModal from './ChangelogModal';
import styles from './DevNoticeBanner.module.css';

export const CURRENT_NOTICE_VERSION = '1.1';

type BannerState = 'default' | 'update-required';

type CurrentUser = { dev_notice_version_accepted: string | null };

export default function DevNoticeBanner() {
  const router = useRouter();
  const { logoutUser } = useAuth();
  const [state, setState] = useState<BannerState>('default');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMode, setNoticeMode] = useState<'view-only' | 'require-acceptance'>('view-only');
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadNoticeStatus = async () => {
      try {
        const user = await apiClient.get<CurrentUser>('/api/v1/users/me', false);
        if (!cancelled) {
          setState(user.dev_notice_version_accepted === CURRENT_NOTICE_VERSION ? 'default' : 'update-required');
        }
      } catch {
        if (!cancelled) setState('default');
      }
    };
    void loadNoticeStatus();
    return () => { cancelled = true; };
  }, []);

  const handleReviewNow = () => {
    setNoticeMode('require-acceptance');
    setNoticeOpen(true);
  };

  const handleViewNotice = () => {
    setNoticeMode('view-only');
    setNoticeOpen(true);
  };

  const handleAccepted = () => {
    setNoticeOpen(false);
    setState('default');
  };

  const handleLogout = () => {
    setNoticeOpen(false);
    logoutUser({ fastRedirect: true });
    router.push('/login');
  };

  return (
    <>
      {state === 'default' && (
        <div className={`${styles.banner} ${styles.bannerDefault}`} role="status">
          <AlertTriangle size={15} className={styles.icon} aria-hidden="true" />
          <p className={styles.text}>
            <strong className={styles.label}>Development Preview</strong>{' '}
            BracketWorks is still in active development. Verify all tournament data before
            publishing results.{' '}
            <button className={styles.viewLink} onClick={handleViewNotice}>
              View notice
            </button>
            {' • '}
            <button className={styles.viewLink} onClick={() => setChangelogOpen(true)}>
              What&apos;s new
            </button>
          </p>
        </div>
      )}

      {state === 'update-required' && (
        <div className={`${styles.banner} ${styles.bannerUpdate}`} role="alert">
          <AlertTriangle size={15} className={styles.iconAlert} aria-hidden="true" />
          <p className={styles.text}>
            <strong className={styles.labelAlert}>Important Update</strong>{' '}
            Our development notice has been updated. Please review and accept the new notice.
          </p>
          <button className={styles.reviewBtn} onClick={handleReviewNow}>
            Review Now
          </button>
        </div>
      )}

      <ChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />

      <DevNoticeModal
        isOpen={noticeOpen}
        mode={noticeMode}
        noticeVersion={CURRENT_NOTICE_VERSION}
        onAccepted={handleAccepted}
        onLogout={handleLogout}
        onClose={() => setNoticeOpen(false)}
      />
    </>
  );
}
