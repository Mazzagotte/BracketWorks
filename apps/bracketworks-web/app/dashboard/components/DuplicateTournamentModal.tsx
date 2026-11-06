'use client'

import { useEffect, useState } from 'react'
import { Button, CardDivider, CheckboxField, FormGrid, Modal, Notice, TextField } from '@bracketworks/ui'

import { apiClient } from '../../lib/api'
import { Tournament } from '../../lib/types'
import styles from './DuplicateTournamentModal.module.css'

type CopyOptions = {
  copy_tournament_settings: boolean
  copy_bracket_programs: boolean
  copy_side_pots: boolean
  copy_squads: boolean
  copy_bowlers: boolean
}

const defaults: CopyOptions = {
  copy_tournament_settings: true,
  copy_bracket_programs: true,
  copy_side_pots: true,
  copy_squads: true,
  copy_bowlers: false,
}

const COPY_CHOICES = [
  ['copy_tournament_settings', 'Tournament settings and bracket size'],
  ['copy_bracket_programs', 'Bracket programs'],
  ['copy_side_pots', 'Side pots'],
  ['copy_squads', 'Squad structure'],
] as const

export function DuplicateTournamentModal({ open, tournament, onClose, onCreated }: {
  open: boolean
  tournament: Tournament
  onClose: () => void
  onCreated: (tournament: Tournament) => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [options, setOptions] = useState<CopyOptions>(defaults)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(`${tournament.name} copy`)
    setStartDate('')
    setEndDate('')
    setOptions(defaults)
    setError('')
  }, [open, tournament])

  const setOption = (key: keyof CopyOptions, value: boolean) => {
    setOptions(previous => ({ ...previous, [key]: value, ...(key === 'copy_squads' && !value ? { copy_bowlers: false } : {}) }))
  }
  const datesInvalid = Boolean(startDate && endDate && endDate < startDate)
  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const created = await apiClient.post<Tournament>(`/api/v1/tournaments/${tournament.id}/duplicate`, {
        name: name.trim(), start_date: startDate || null, end_date: endDate || null, ...options,
      })
      await onCreated(created)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to duplicate tournament.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Duplicate tournament"
      description={`Start a new tournament from ${tournament.name}'s setup. Results and payouts are never copied.`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving || !name.trim() || datesInvalid}>
            {saving ? 'Duplicating...' : 'Duplicate tournament'}
          </Button>
        </>
      )}
    >
      <div className={styles.body}>
        <FormGrid>
          <TextField label="Tournament name" fullRow value={name} onChange={event => setName(event.target.value)} maxLength={200} autoFocus />
          <TextField label="Start date" optional type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          <TextField
            label="End date"
            optional
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={event => setEndDate(event.target.value)}
            error={datesInvalid ? 'End date must be on or after the start date.' : undefined}
          />
        </FormGrid>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Copy</legend>
          {COPY_CHOICES.map(([key, label]) => (
            <CheckboxField key={key} label={label} checked={options[key]} onChange={event => setOption(key, event.target.checked)} />
          ))}
        </fieldset>
        <CardDivider />
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Advanced</legend>
          <CheckboxField
            label="Copy bowlers and their entry selections"
            helper="Payments reset to $0. Scores, brackets, winners, and payouts are not copied."
            checked={options.copy_bowlers}
            disabled={!options.copy_squads}
            onChange={event => setOption('copy_bowlers', event.target.checked)}
          />
        </fieldset>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      </div>
    </Modal>
  )
}
