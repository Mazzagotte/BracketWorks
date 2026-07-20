'use client';

import { useEffect, useState } from 'react';

interface AuthQueryParams {
  sessionExpired: boolean;
  signupSuccess: boolean;
  verificationSuccess: boolean;
  resetSuccess: boolean;
}

/**
 * Parse and manage authentication-related query parameters
 * Handles: ?expired=true, ?signup=success, ?verified=success, ?reset=success
 */
export function useAuthQueryParams(): AuthQueryParams {
  const [params, setParams] = useState<AuthQueryParams>({
    sessionExpired: false,
    signupSuccess: false,
    verificationSuccess: false,
    resetSuccess: false,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    
    setParams({
      sessionExpired: searchParams.get('expired') === 'true',
      signupSuccess: searchParams.get('signup') === 'success',
      verificationSuccess: searchParams.get('verified') === 'success',
      resetSuccess: searchParams.get('reset') === 'success',
    });
  }, []);

  return params;
}
