'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { API, apiFetch } from '../lib/api';

type UseUsernameAvailabilityOptions = {
  minLength?: number;
  debounceMs?: number;
};

export function useUsernameAvailability(
  username: string,
  options: UseUsernameAvailabilityOptions = {}
) {
  const { minLength = 3, debounceMs = 500 } = options;
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const requestIdRef = useRef(0);

  const resetUsernameAvailability = useCallback(() => {
    setUsernameAvailable(null);
    setCheckingUsername(false);
  }, []);

  const checkUsernameAvailability = useCallback(async (value: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (value.trim().length < minLength) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);

    try {
      const response = await apiFetch(API(`/api/v1/users/check-username?username=${encodeURIComponent(value)}`));
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (data && typeof data === 'object' && 'available' in data) {
        const available = (data as { available?: unknown }).available;
        setUsernameAvailable(typeof available === 'boolean' ? available : null);
      } else {
        setUsernameAvailable(null);
      }
    } catch {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setUsernameAvailable(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setCheckingUsername(false);
      }
    }
  }, [minLength]);

  useEffect(() => {
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < minLength) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      checkUsernameAvailability(trimmedUsername);
    }, debounceMs);

    return () => clearTimeout(debounceTimer);
  }, [checkUsernameAvailability, debounceMs, minLength, username]);

  return {
    checkingUsername,
    resetUsernameAvailability,
    usernameAvailable,
  };
}