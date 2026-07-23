'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import DevNoticeModal from './DevNoticeModal';
import ChangelogModal from './ChangelogModal';
import styles from './DevNoticeBanner.module.css';

export const CURRENT_NOTICE_VERSION = '1.0';

const ACCEPTED_VERSION_KEY = 'dev_notice_version_accepted';

type BannerState = 'default' | 'update-required';

function getInitialState(): BannerState {
  if (typeof window === 'undefined') return 'default';
  const accepted = localStorage.getItem(ACCEPTED_VERSION_KEY);
  if (accepted !== CURRENT_NOTICE_VERSION) return 'update-required';
  return 'default';
}

export default function DevNoticeBanner() {
  const [state, setState] = useState<BannerState>(getInitialState);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMode, setNoticeMode] = useState<'view-only' | 'require-acceptance'>('view-only');
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    const initialState = getInitialState();
    setState(initialState);
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
    localStorage.setItem(ACCEPTED_VERSION_KEY, CURRENT_NOTICE_VERSION);
    setNoticeOpen(false);
    setState('default');
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
              What's new
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
        onLogout={() => setNoticeOpen(false)}
        onClose={() => setNoticeOpen(false)}
      />
    </>
  );
}
