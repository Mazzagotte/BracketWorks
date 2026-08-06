'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useCooldownTimer() {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCooldown = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setCooldownSeconds(0);
  }, []);

  const startCooldown = useCallback((seconds: number) => {
    const initial = Math.max(0, seconds);
    setCooldownSeconds(initial);

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }

    if (initial <= 0) {
      cooldownTimerRef.current = null;
      return;
    }

    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds(previous => {
        if (previous <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => clearCooldown, [clearCooldown]);

  return {
    clearCooldown,
    cooldownSeconds,
    startCooldown,
  };
}