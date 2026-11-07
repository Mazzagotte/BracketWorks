'use client';

import { Button, CheckboxField, FormGrid, Modal, Notice, TextField } from '@bracketworks/ui';
import { useEffect, useState } from 'react';

import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';

/** Next year's name: bump a four-digit year in the name, otherwise add "(copy)". */
export function suggestDuplicateName(name: string): string {
  const yearMatch = /\b(19|20)\d{2}\b/u.exec(name);
  if (yearMatch) return name.replace(yearMatch[0], String(Number(yearMatch[0]) + 1));
  return `${name} (copy)`;
}

/** The same weekday about a year later (52 weeks), so a Saturday event stays on a Saturday. */
export function suggestNextStartDate(startDate: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(startDate ?? '');
  if (!match) return '';
  const next = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 364);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

type DuplicateTournamentModalProps = {
  tournament: OrganizerDashboardTournament | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (options: { name: string; startDate: string; includeDocuments: boolean }) => void;
};

export default function DuplicateTournamentModal({ tournament, busy, error, onCancel, onConfirm }: DuplicateTournamentModalProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [includeDocuments, setIncludeDocuments] = useState(true);

  useEffect(() => {
    if (!tournament) return;
    setName(suggestDuplicateName(tournament.name));
    setStartDate(suggestNextStartDate(tournament.startDate));
    setIncludeDocuments(true);
  }, [tournament]);

  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <Modal
      open={Boolean(tournament)}
      onClose={onCancel}
      title="Duplicate tournament"
      description="Copies the setup, squads, events, fees, questions, logo, and rules. Registrations are not copied, and the copy starts unpublished."
      size="sm"
      closeLabel="Close duplicate tournament"
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => onConfirm({ name: name.trim(), startDate, includeDocuments })}
          >
            {busy ? 'Duplicating...' : 'Duplicate'}
          </Button>
        </>
      )}
    >
      <div className={styles.modalBody}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        <FormGrid>
          <TextField label="New tournament name" value={name} onChange={(event) => setName(event.target.value)} fullRow />
          <TextField
            label="First day"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            helper="Every date moves by the same amount, including squads and the registration window."
            fullRow
          />
        </FormGrid>
        <CheckboxField
          label="Copy documents"
          helper="Rules, flyers, and other files bowlers can download."
          checked={includeDocuments}
          onChange={(event) => setIncludeDocuments(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
