'use client';

import { useCallback, useEffect, useState } from 'react';

import { API } from '../lib/api';

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

  const resetUsernameAvailability = useCallback(() => {
    setUsernameAvailable(null);
    setCheckingUsername(false);
  }, []);

  const checkUsernameAvailability = useCallback(async (value: string) => {
    if (value.trim().length < minLength) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);

    try {
      const response = await fetch(API(`/api/v1/users/check-username?username=${encodeURIComponent(value)}`));
      const data = await response.json().catch(() => null);
      setUsernameAvailable(typeof data?.available === 'boolean' ? data.available : null);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
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