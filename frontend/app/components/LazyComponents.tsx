'use client';

import dynamic from 'next/dynamic';

// Lazy load heavy components to reduce initial bundle size
export const BracketRenderer = dynamic(() => import('./BracketRenderer').then(mod => ({ default: mod.BracketRenderer })), {
  loading: () => null,
  ssr: false
});

export const MobileTable = dynamic(() => import('../../components/MobileTable').then(mod => ({ default: mod.MobileTable })), {
  loading: () => null,
  ssr: false
});

export const ConfirmationDialog = dynamic(() => import('./ConfirmationDialog'), {
  loading: () => null,
  ssr: false
});

export const BracketGenerationModal = dynamic(() => import('./BracketGenerationModal'), {
  loading: () => null,
  ssr: false
});
