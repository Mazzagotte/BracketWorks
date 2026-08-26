'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import CloseControl from '../../components/CloseControl';
import { apiClient } from '../lib/api';
import type { ChangelogEntry } from '../lib/types';
import modalStyles from '../styles/modals.module.css';
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
      className={modalStyles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
    >
      <div className={`${modalStyles.modal} ${modalStyles.compactModal}`}>
        {/* Header */}
        <div className={modalStyles.header}>
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
            className={modalStyles.closeButton}
            position="absolute"
          />
        </div>

        {/* Body */}
        <div className={modalStyles.content}>
          {loading ? (
            <p className={styles.loadingText}>Loading changelog...</p>
          ) : entries.length === 0 ? (
            <p className={styles.emptyText}>No changelog entries available.</p>
          ) : (
            <div className={styles.entriesList}>
              {entries.map((entry, idx) => (
                <div key={idx} className={styles.entry}>
                  <div className={styles.entryHeader}>
                    <div className={styles.entryMeta}>
                      <span className={styles.version}>v{entry.version}</span>
                      {entry.tags?.map((tag) => <span className={styles.tag} key={tag}>{tag}</span>)}
                    </div>
                    <time className={styles.date}>{entry.date}</time>
                  </div>
                  {entry.sections?.length ? (
                    <div className={styles.structuredContent}>
                      <h3 className={styles.entryTitle}>{entry.title}</h3>
                      {entry.summary && <p className={styles.summary}>{entry.summary}</p>}
                      {entry.sections.map((section, sectionIndex) => <section className={styles.section} key={sectionIndex}>
                        <h4>{section.heading}</h4>
                        <ul className={styles.changesList}>{section.items.map((item, itemIndex) => <li key={itemIndex} className={styles.changeItem}>{item}</li>)}</ul>
                      </section>)}
                    </div>
                  ) : (
                    <ul className={styles.changesList}>{entry.changes.map((change, changeIdx) => <li key={changeIdx} className={styles.changeItem}>{change}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={modalStyles.footer}>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
