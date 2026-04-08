'use client';

import dynamic from 'next/dynamic';

// Lazy load heavy components to reduce initial bundle size
export const BracketRenderer = dynamic(() => import('./BracketRenderer').then(mod => ({ default: mod.BracketRenderer })), {
  loading: () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '200px',
      fontSize: '14px',
      color: '#6b7280'
    }}>
      Loading bracket display...
    </div>
  ),
  ssr: false
});

export const SmartSuggestions = dynamic(() => import('./SmartSuggestions'), {
  loading: () => (
    <div style={{ 
      padding: '1rem',
      fontSize: '14px',
      color: '#6b7280'
    }}>
      Loading suggestions...
    </div>
  ),
  ssr: false
});

export const MobileTable = dynamic(() => import('../../components/MobileTable').then(mod => ({ default: mod.MobileTable })), {
  loading: () => (
    <div style={{ 
      padding: '1rem',
      fontSize: '14px',
      color: '#6b7280'
    }}>
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
    <div style={{ 
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000
    }}>
      <div style={{ color: '#fff', fontSize: '16px' }}>Loading...</div>
    </div>
  ),
  ssr: false
});

export const DataManagement = dynamic(() => import('./DataManagement').then(mod => ({ 
  default: () => null // Export utility functions only
})), {
  ssr: false
});

export const HoverPreview = dynamic(() => import('./HoverPreview'), {
  loading: () => null,
  ssr: false
});

export const DuplicateDetection = dynamic(() => import('./DuplicateDetection'), {
  loading: () => (
    <div style={{ padding: '0.5rem', fontSize: '12px', color: '#6b7280' }}>
      Loading validation...
    </div>
  ),
  ssr: false
});
