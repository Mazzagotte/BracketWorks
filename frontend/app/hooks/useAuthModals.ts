'use client';

import { useState, useCallback } from 'react';

interface AuthModals {
  signup: boolean;
  resetPassword: boolean;
  resetSuccess: boolean;
}

/**
 * Centralized modal state management for authentication flows
 * Reduces multiple useState calls to a single state object
 */
export function useAuthModals() {
  const [modals, setModals] = useState<AuthModals>({
    signup: false,
    resetPassword: false,
    resetSuccess: false,
  });

  const openModal = useCallback((modal: keyof AuthModals) => {
    setModals(prev => ({ ...prev, [modal]: true }));
  }, []);

  const closeModal = useCallback((modal: keyof AuthModals) => {
    setModals(prev => ({ ...prev, [modal]: false }));
  }, []);

  const toggleModal = useCallback((modal: keyof AuthModals) => {
    setModals(prev => ({ ...prev, [modal]: !prev[modal] }));
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    toggleModal,
  };
}
