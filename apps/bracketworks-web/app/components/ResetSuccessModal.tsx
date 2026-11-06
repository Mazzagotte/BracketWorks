'use client';

import { Button, Modal } from '@bracketworks/ui';

interface ResetSuccessModalProps {
  isOpen: boolean;
  countdown: number;
  onDismiss: () => void;
}

/** Confirms a password reset on the login page, then closes on its own. */
export default function ResetSuccessModal({ isOpen, countdown, onDismiss }: ResetSuccessModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onDismiss}
      size="sm"
      title="Password updated"
      description={`Your password was reset. You can log in with your new password. This message closes in ${countdown} seconds.`}
      footer={<Button variant="primary" onClick={onDismiss}>Continue to log in</Button>}
    />
  );
}
