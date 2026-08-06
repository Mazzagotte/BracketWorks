import { useEffect, useRef, useState, useCallback } from 'react';

import { useToastHelpers } from './Toast';

interface UseAutoSaveOptions<T> {
  data: T;
  saveFunction: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export function useAutoSave<T>({
  data,
  saveFunction,
  delay = 2000,
  enabled = true,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions<T>) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const dataRef = useRef(data);
  const { info, error: showError } = useToastHelpers();

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const save = useCallback(async () => {
    if (!enabled || saving) return;

    try {
      setSaving(true);
      onSaveStart?.();
      await saveFunction(dataRef.current);
      setLastSaved(new Date());
      onSaveSuccess?.();
      info('Changes saved automatically', '', { duration: 2000 });
    } catch (err: unknown) {
      onSaveError?.(err instanceof Error ? err : new Error('Save failed'));
      showError('Failed to save changes automatically', 'Auto-save Error');
    } finally {
      setSaving(false);
    }
  }, [saveFunction, enabled, saving, onSaveStart, onSaveSuccess, onSaveError, info, showError]);

  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, delay);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [data, save, delay, enabled]);

  const saveNow = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return save();
  }, [save]);

  return { saving, lastSaved, saveNow };
}
