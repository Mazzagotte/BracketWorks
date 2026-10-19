'use client';

import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
};

export function useConfirmation() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);

  const settle = (confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setOptions(null);
    resolve?.(confirmed);
  };

  const confirm = (nextOptions: ConfirmationOptions): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setOptions(nextOptions);
    });
  };

  const confirmationDialog = <ConfirmDialog
    open={options !== null}
    title={options?.title ?? ''}
    message={options?.message ?? ''}
    confirmLabel={options?.confirmLabel}
    tone={options?.tone}
    onConfirm={() => settle(true)}
    onCancel={() => settle(false)}
  />;

  return { confirm, confirmationDialog };
}
