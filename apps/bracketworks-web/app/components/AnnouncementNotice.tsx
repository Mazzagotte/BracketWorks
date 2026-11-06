'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from '@bracketworks/ui';
import { apiClient } from '../lib/api';
import styles from './AnnouncementNotice.module.css';

type Announcement = { id: number; title: string; message: string; requires_acknowledgment: boolean; version: string };

export default function AnnouncementNotice({ enabled, onVisibilityChange }: { enabled: boolean; onVisibilityChange?: (visible: boolean) => void }) {
  const [items, setItems] = useState<Announcement[]>([]);
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

  if (!enabled || !current) return null;
  const remaining = items.length - 1;
  return (
    <Modal
      open
      onClose={() => { void acknowledge(); }}
      dismissible={!current.requires_acknowledgment}
      size="sm"
      role={current.requires_acknowledgment ? 'alertdialog' : 'dialog'}
      title={current.title}
      footer={(
        <>
          {remaining > 0 ? <span className={styles.more}>{remaining} more announcement{remaining === 1 ? '' : 's'}</span> : null}
          <Button variant="primary" onClick={() => { void acknowledge(); }}>{current.requires_acknowledgment ? 'Acknowledge' : 'Dismiss'}</Button>
        </>
      )}
    >
      <p className={styles.message}>{current.message}</p>
    </Modal>
  );
}
