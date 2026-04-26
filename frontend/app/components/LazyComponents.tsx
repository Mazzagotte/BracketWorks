'use client';

import dynamic from 'next/dynamic';
import styles from './LazyComponents.module.css';

// Lazy load heavy components to reduce initial bundle size
export const BracketRenderer = dynamic(() => import('./BracketRenderer').then(mod => ({ default: mod.BracketRenderer })), {
  loading: () => (
    <div className={styles.bracketLoading}>
      Loading bracket display...
    </div>
  ),
  ssr: false
});

export const MobileTable = dynamic(() => import('../../components/MobileTable').then(mod => ({ default: mod.MobileTable })), {
  loading: () => (
    <div className={styles.inlineLoading}>
      Loading table...
    </div>
  ),
  ssr: false
});

export const ConfirmationDialog = dynamic(() => import('./ConfirmationDialog'), {
  loading: () => null, // Dialogs don't need loading states
  ssr: false
});

export const BracketGenerationModal = dynamic(() => import('./BracketGenerationModal'), {
  loading: () => (
    <div className={styles.modalLoading}>
      <div className={styles.modalLoadingText}>Loading...</div>
    </div>
  ),
  ssr: false
});
