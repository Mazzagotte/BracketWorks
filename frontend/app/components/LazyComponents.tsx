'use client';

import dynamic from 'next/dynamic';

// Lazy load heavy components to reduce initial bundle size
export const ConfirmationDialog = dynamic(() => import('./ConfirmationDialog').then(mod => ({ default: mod.default })), {
  loading: () => null,
  ssr: false
});
