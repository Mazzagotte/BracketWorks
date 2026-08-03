'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/api';
import { setBodyInteractionState } from '../utils/modalUtils';
import buttonStyles from '../styles/buttons.module.css';
import modalStyles from '../styles/modals.module.css';
import styles from './AnnouncementNotice.module.css';

type Announcement = { id: number; title: string; message: string; requires_acknowledgment: boolean; version: string };

export default function AnnouncementNotice({ enabled, onVisibilityChange }: { enabled: boolean; onVisibilityChange?: (visible: boolean) => void }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = items[0];

  useEffect(() => { onVisibilityChange?.(Boolean(enabled && current)); }, [current, enabled, onVisibilityChange]);

  useEffect(() => {
    if (!enabled) { setItems([]); return; }
    void apiClient.get<{ announcements: Announcement[] }>('/api/v1/users/announcements/active', false).then(data => setItems(data.announcements)).catch(() => undefined);
  }, [enabled]);

  const acknowledge = useCallback(async () => {
    if (!current) return;
    await apiClient.post('/api/v1/users/acknowledgments', { content_type: 'announcement', content_id: String(current.id), version: current.version });
    setItems(previous => previous.slice(1));
  }, [current]);

  useEffect(() => {
    if (!current) return undefined;
    setBodyInteractionState({ scrollLocked: true, touchLocked: false });
    const frame = requestAnimationFrame(() => buttonRef.current?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !current.requires_acknowledgment) { event.preventDefault(); void acknowledge(); }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown); setBodyInteractionState({ scrollLocked: false, touchLocked: false }); };
  }, [acknowledge, current]);

  if (!enabled || !current) return null;
  return <div className={modalStyles.overlay}><div ref={dialogRef} className={`${modalStyles.modal} ${modalStyles.compactModal}`} role="dialog" aria-modal="true" aria-labelledby="announcement-title" aria-describedby="announcement-message"><div className={modalStyles.header}><p className={modalStyles.kicker}>BracketWorks Announcement</p><h2 id="announcement-title">{current.title}</h2></div><div className={`${modalStyles.content} ${styles.content}`}><p id="announcement-message">{current.message}</p><button ref={buttonRef} type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.fullWidth}`} onClick={() => { void acknowledge(); }}>{current.requires_acknowledgment ? 'Acknowledge' : 'Dismiss'}</button>{items.length > 1 && <span>{items.length - 1} more announcement{items.length === 2 ? '' : 's'}</span>}</div></div></div>;
}
