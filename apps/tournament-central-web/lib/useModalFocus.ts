'use client';

import { useEffect, useRef } from 'react';

const activeModals: HTMLElement[] = [];
let originalOverflow = '';

export function useModalFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement;
    if (activeModals.length === 0) originalOverflow = document.body.style.overflow;
    activeModals.push(dialog);
    document.body.style.overflow = 'hidden';
    dialog.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeModals[activeModals.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const controls = [...dialog.querySelectorAll<HTMLElement>(
          ':is(button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"]))',
        )].filter((control) => !control.closest('[hidden], [inert]'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (activeModals[activeModals.length - 1] !== dialog) return;
      if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocus);
    return () => {
      const wasTop = activeModals[activeModals.length - 1] === dialog;
      const index = activeModals.indexOf(dialog);
      if (index !== -1) activeModals.splice(index, 1);
      if (activeModals.length === 0) document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocus);
      const top = activeModals[activeModals.length - 1];
      if (wasTop) {
        if (trigger instanceof HTMLElement && trigger.isConnected && (!top || top.contains(trigger))) trigger.focus();
        else top?.focus();
      }
    };
  }, [open]);
  return ref;
}
