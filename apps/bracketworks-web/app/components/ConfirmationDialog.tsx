"use client";

import { Button, Modal } from "@bracketworks/ui";

interface ConfirmationDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

/** A short success message after an action, on the shared Modal. */
export default function ConfirmationDialog({ open, message, onClose }: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Done"
      description={message}
      footer={<Button variant="primary" onClick={onClose}>Close</Button>}
    />
  );
}
