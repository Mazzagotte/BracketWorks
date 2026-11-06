import type { ReactNode } from 'react';
import { Modal } from '@bracketworks/ui';

type ConfigDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

/** Setup editors (squads, questions, fields, add-ons, locations) in the shared Modal. */
export default function ConfigDrawer({ open, title, subtitle, onClose, children }: ConfigDrawerProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={subtitle || undefined} size="lg" closeLabel="Close editor">
      {children}
    </Modal>
  );
}
