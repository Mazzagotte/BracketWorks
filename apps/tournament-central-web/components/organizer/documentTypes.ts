import type { TournamentDocumentKind } from './organizerApi';

/** Every kind of file an organizer can attach to a tournament, in the order the type picker lists them. */
export const DOCUMENT_TYPE_OPTIONS: Array<{ value: TournamentDocumentKind; label: string }> = [
  { value: 'rules', label: 'Rules' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'oil_pattern', label: 'Oil pattern' },
  { value: 'entry_form', label: 'Entry form' },
  { value: 'notice', label: 'Notice' },
  { value: 'other', label: 'Other' },
];

const DOCUMENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export function documentTypeLabel(docType: string): string {
  return DOCUMENT_TYPE_LABEL[docType] ?? 'Other';
}

export function formatDocumentUploadedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
