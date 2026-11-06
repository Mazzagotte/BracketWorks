'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Modal } from '@bracketworks/ui';
import { apiClient } from '../lib/api';
import type { ChangelogEntry } from '../lib/types';
import styles from './ChangelogModal.module.css';

export interface ChangelogModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    
    const fetchChangelog = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<{ entries: ChangelogEntry[] }>('/api/v1/users/changelog', false);
        if (!isCancelled) {
          setEntries(data.entries);
        }
      } catch (error) {
        console.error('Failed to fetch changelog:', error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchChangelog();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  const close = () => onClose?.();

  return (
    <Modal
      open={isOpen}
      onClose={close}
      closeLabel="Close changelog"
      title="What's new"
      footer={<Button variant="secondary" onClick={close}>Close</Button>}
    >
      {loading ? (
        <p className={styles.status} role="status">Loading changelog...</p>
      ) : entries.length === 0 ? (
        <p className={styles.status}>No changelog entries yet.</p>
      ) : (
        <div className={styles.entries}>
          {entries.map((entry, idx) => (
            <article key={idx} className={styles.entry}>
              <div className={styles.entryHeader}>
                <span className={styles.version}>Version {entry.version}</span>
                {entry.tags?.map(tag => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                <time className={styles.date}>{entry.date}</time>
              </div>
              {entry.sections?.length ? (
                <>
                  <h3 className={styles.title}>{entry.title}</h3>
                  {entry.summary ? <p className={styles.text}>{entry.summary}</p> : null}
                  {entry.sections.map((section, sectionIndex) => (
                    <section className={styles.section} key={sectionIndex}>
                      <h4 className={styles.sectionTitle}>{section.heading}</h4>
                      <ul className={styles.list}>{section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
                    </section>
                  ))}
                </>
              ) : (
                <ul className={styles.list}>{entry.changes.map((change, changeIdx) => <li key={changeIdx}>{change}</li>)}</ul>
              )}
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
