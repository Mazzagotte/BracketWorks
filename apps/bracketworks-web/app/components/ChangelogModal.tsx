'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import CloseControl from '../../components/CloseControl';
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
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Block Escape key to allow natural close behavior
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <BookOpen size={18} className={styles.icon} aria-hidden="true" />
            <h2 id="changelog-title" className={styles.title}>
              What&apos;s New
            </h2>
          </div>
          <CloseControl
            onClick={onClose}
            label="Close changelog"
            size="xs"
          />
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <p className={styles.loadingText}>Loading changelog...</p>
          ) : entries.length === 0 ? (
            <p className={styles.emptyText}>No changelog entries available.</p>
          ) : (
            <div className={styles.entriesList}>
              {entries.map((entry, idx) => (
                <div key={idx} className={styles.entry}>
                  <div className={styles.entryHeader}>
                    <h3 className={styles.version}>v{entry.version}</h3>
                    <time className={styles.date}>{entry.date}</time>
                  </div>
                  <ul className={styles.changesList}>
                    {entry.changes.map((change, changeIdx) => (
                      <li key={changeIdx} className={styles.changeItem}>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
