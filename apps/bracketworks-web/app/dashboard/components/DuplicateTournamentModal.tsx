'use client'

import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import CloseControl from '../../../components/CloseControl'
import { apiClient } from '../../lib/api'
import { Tournament } from '../../lib/types'
import buttonStyles from '../../styles/buttons.module.css'
import formStyles from '../../styles/forms.module.css'
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
    setName(`${tournament.name} Copy`)
    setStartDate('')
    setEndDate('')
    setOptions(defaults)
    setError('')
  }, [open, tournament])

  if (!open) return null
  const setOption = (key: keyof CopyOptions, value: boolean) => {
    setOptions(previous => ({ ...previous, [key]: value, ...(key === 'copy_squads' && !value ? { copy_bowlers: false } : {}) }))
  }
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
    <div className={styles.overlay} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="duplicate-tournament-title">
        <CloseControl position="absolute" size="sm" label="Close duplicate tournament dialog" onClick={onClose} />
        <header>
          <h2 id="duplicate-tournament-title"><Copy aria-hidden="true" />Duplicate Tournament</h2>
          <p>Create a fresh tournament from {tournament.name}&apos;s setup. Results and payouts are never copied.</p>
        </header>
        <div className={styles.body}>
          <label>Tournament name
            <input className={formStyles.input} value={name} onChange={event => setName(event.target.value)} maxLength={200} autoFocus />
          </label>
          <div className={styles.dateGrid}>
            <label>Start date<input className={formStyles.input} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
            <label>End date<input className={formStyles.input} type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} /></label>
          </div>
          <fieldset>
            <legend>Copy configuration</legend>
            {([
              ['copy_tournament_settings', 'Tournament settings and bracket size'],
              ['copy_bracket_programs', 'Bracket programs'],
              ['copy_side_pots', 'Side pots'],
              ['copy_squads', 'Squad structure'],
            ] as const).map(([key, label]) => (
              <label className={styles.check} key={key}><input type="checkbox" checked={options[key]} onChange={event => setOption(key, event.target.checked)} />{label}</label>
            ))}
          </fieldset>
          <fieldset className={styles.advanced}>
            <legend>Advanced</legend>
            <label className={styles.check}>
              <input type="checkbox" checked={options.copy_bowlers} disabled={!options.copy_squads} onChange={event => setOption('copy_bowlers', event.target.checked)} />
              Copy bowlers and their entry selections
            </label>
            <p>Payments reset to $0. Scores, brackets, winners, and payouts are not copied.</p>
          </fieldset>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
        <footer>
          <button type="button" className={`${buttonStyles.button} ${buttonStyles.ghost}`} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary}`} onClick={() => void submit()} disabled={saving || !name.trim() || Boolean(startDate && endDate && endDate < startDate)}>{saving ? 'Duplicating…' : 'Duplicate Tournament'}</button>
        </footer>
      </section>
    </div>
  )
}
