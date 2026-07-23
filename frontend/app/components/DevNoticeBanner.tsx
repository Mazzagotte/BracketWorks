'use client';

import { useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import DevNoticeModal from './DevNoticeModal';
import styles from './DevNoticeBanner.module.css';

export const CURRENT_NOTICE_VERSION = '1.0';

const DISMISSED_KEY = 'dev_notice_banner_dismissed';
const HIDDEN_KEY = 'dev_notice_banner_hidden';
const ACCEPTED_VERSION_KEY = 'dev_notice_version_accepted';

type BannerState = 'default' | 'dismissed' | 'update-required' | 'hidden';

function getInitialState(): BannerState {
  if (typeof window === 'undefined') return 'default';
  if (sessionStorage.getItem(HIDDEN_KEY) === '1') return 'hidden';
  const accepted = localStorage.getItem(ACCEPTED_VERSION_KEY);
  if (accepted !== CURRENT_NOTICE_VERSION) return 'update-required';
  if (sessionStorage.getItem(DISMISSED_KEY) === '1') return 'dismissed';
  return 'default';
}

export default function DevNoticeBanner() {
  const [state, setState] = useState<BannerState>(getInitialState);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMode, setNoticeMode] = useState<'view-only' | 'require-acceptance'>('view-only');

  if (state === 'hidden') return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setState('dismissed');
  };

  const handleUndo = () => {
    sessionStorage.removeItem(DISMISSED_KEY);
    setState('default');
  };

  const handleHide = () => {
    sessionStorage.setItem(HIDDEN_KEY, '1');
    setState('hidden');
  };

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
          </p>
          <button className={styles.dismissBtn} onClick={handleDismiss}>
            Dismiss <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {state === 'dismissed' && (
        <div className={`${styles.banner} ${styles.bannerDismissed}`} role="status">
          <Info size={15} className={styles.iconMuted} aria-hidden="true" />
          <p className={styles.text}>
            <strong className={styles.labelMuted}>Development Preview</strong>{' '}
            You&apos;ve dismissed this message for this session.
          </p>
          <button className={styles.undoBtn} onClick={handleUndo}>
            Undo
          </button>
          <button className={styles.hideBtn} onClick={handleHide} aria-label="Hide banner">
            <X size={13} aria-hidden="true" />
          </button>
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

      {state === 'default' && (
        <p className={styles.footerNote}>
          You can review the full Development Notice anytime from the banner or from Settings &gt; Legal.
        </p>
      )}

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
