'use client';

import { useEffect } from 'react';

type AuthFormShortcutOptions = {
  focusOnMount?: () => void;
  canSubmitShortcut?: () => boolean;
  onSubmitShortcut?: () => void;
  enableEscape?: boolean;
  onEscape?: () => void;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
};

export function useAuthFormShortcuts({
  focusOnMount,
  canSubmitShortcut,
  onSubmitShortcut,
  enableEscape = false,
  onEscape,
  onKeyDown,
}: AuthFormShortcutOptions) {
  useEffect(() => {
    focusOnMount?.();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (onKeyDown?.(event)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && canSubmitShortcut?.()) {
        event.preventDefault();
        onSubmitShortcut?.();
        return;
      }

      if (enableEscape && event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canSubmitShortcut, enableEscape, focusOnMount, onEscape, onKeyDown, onSubmitShortcut]);
}