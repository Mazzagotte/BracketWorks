'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import DevNoticeModal from './DevNoticeModal';
import ChangelogModal from './ChangelogModal';
import styles from './DevNoticeBanner.module.css';
import { Button, Notice } from '@bracketworks/ui';

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
      {state === 'default' ? (
        <Notice
          tone="warning"
          role="status"
          action={(
            <span className={styles.actions}>
              <Button size="sm" variant="ghost" onClick={handleViewNotice}>View notice</Button>
              <Button size="sm" variant="ghost" onClick={() => setChangelogOpen(true)}>What&apos;s new</Button>
            </span>
          )}
        >
          <strong>Development preview.</strong> BracketWorks is still in active development. Verify all tournament data before publishing results.
        </Notice>
      ) : (
        <Notice
          tone="danger"
          role="alert"
          action={<Button size="sm" variant="primary" onClick={handleReviewNow}>Review now</Button>}
        >
          <strong>Important update.</strong> The development notice has changed. Please review and accept the new notice.
        </Notice>
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
