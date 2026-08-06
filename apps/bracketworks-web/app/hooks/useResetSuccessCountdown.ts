'use client';

import { useEffect, useState, useCallback } from 'react';

const INITIAL_COUNTDOWN = 10;

/**
 * Manage countdown timer for reset success modal
 * Automatically closes modal when countdown reaches 0
 */
export function useResetSuccessCountdown(isOpen: boolean) {
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);

  const reset = useCallback(() => {
    setCountdown(INITIAL_COUNTDOWN);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isOpen]);

  return { countdown, reset };
}
