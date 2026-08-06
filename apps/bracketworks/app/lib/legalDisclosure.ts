export const OPEN_LEGAL_DISCLOSURE_EVENT = 'bracketworks:open-legal-disclosure';

export function openLegalDisclosure(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_LEGAL_DISCLOSURE_EVENT));
  }
}
