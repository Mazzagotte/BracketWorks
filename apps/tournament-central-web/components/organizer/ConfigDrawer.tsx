import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useId } from 'react';
import { useModalFocus } from '@/lib/useModalFocus';
import styles from './tournament-setup.module.css';

type ConfigDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function ConfigDrawer({ open, title, subtitle, onClose, children }: ConfigDrawerProps) {
  const ref = useModalFocus<HTMLElement>(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  if (!open) {
    return null;
  }

  return (
    <div className={styles.drawerBackdrop} role="presentation" onClick={onClose}>
      <aside
        ref={ref}
        tabIndex={-1}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descriptionId : undefined}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className={styles.drawerHeader}>
          <div>
            <h3 id={titleId}>{title}</h3>
            {subtitle ? <p id={descriptionId}>{subtitle}</p> : null}
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
