export const ONBOARDING_STORAGE_KEY = 'bracketworks-onboarding-v1';
export const OPEN_ONBOARDING_EVENT = 'bracketworks:open-onboarding';

export function openOnboarding(): void {
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
}

