import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import styles from './tournament-setup.module.css';

type ConfigDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function ConfigDrawer({ open, title, subtitle, onClose, children }: ConfigDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.drawerBackdrop} role="presentation" onClick={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className={styles.drawerHeader}>
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </div>
  );
}
