'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, GitMerge, RefreshCcw } from 'lucide-react'
import { apiClient } from '../../lib/api'
import styles from '../entries.module.css'
import cardStyles from '../../styles/cards.module.css'
import buttonStyles from '../../styles/buttons.module.css'
import formStyles from '../../styles/forms.module.css'

type DuplicatePlayer = {
  id: number
  full_name: string
  usbc_number: string | null
  average: number | null
  squad_id: number
  program_entry_counts: Record<string, number>
  side_pot_entries: Record<string, boolean>
  amount_paid: number
  lane: string | null
  division: string | null
}

type DuplicateCandidate = {
  pair_key: string
  reason: string
  can_merge: boolean
  left: DuplicatePlayer
  right: DuplicatePlayer
}

type DuplicateResponse = { count: number; candidates: DuplicateCandidate[] }

function PlayerComparison({ player }: { player: DuplicatePlayer }) {
  const entries = Object.entries(player.program_entry_counts || {}).filter(([, count]) => count > 0)
  const sidePots = Object.entries(player.side_pot_entries || {}).filter(([, entered]) => entered).map(([name]) => name)
  return (
    <div className={styles.duplicatePlayer}>
      <strong>{player.full_name}</strong>
      <span>USBC: {player.usbc_number || 'Not provided'}</span>
      <span>Average: {player.average ?? 'Missing'} · Lane: {player.lane || '—'}</span>
      <span>Entries: {entries.length ? entries.map(([name, count]) => `${name} ${count}`).join(', ') : 'None'}</span>
      <span>Side pots: {sidePots.length ? sidePots.join(', ') : 'None'} · Paid: ${Number(player.amount_paid).toFixed(2)}</span>
    </div>
  )
}

export default function DuplicateResolutionPanel({ tournamentId, onResolved }: { tournamentId: number; onResolved: () => void | Promise<void> }) {
  const [data, setData] = useState<DuplicateResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mergePair, setMergePair] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      setData(await apiClient.get<DuplicateResponse>(`/api/v1/bowlers/duplicates/${tournamentId}`, false))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to check duplicate players.')
    }
  }, [tournamentId])

  useEffect(() => { void load() }, [load])

  const finish = async () => {
    setMergePair(null)
    setReason('')
    await Promise.all([load(), Promise.resolve(onResolved())])
  }

  const resolve = async (candidate: DuplicateCandidate, resolution: 'keep_both' | 'not_duplicate') => {
    setBusy(true)
    setError('')
    try {
      await apiClient.post(`/api/v1/bowlers/duplicates/${tournamentId}/resolve`, {
        left_player_id: candidate.left.id,
        right_player_id: candidate.right.id,
        resolution,
      })
      await finish()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to resolve duplicate.')
    } finally {
      setBusy(false)
    }
  }

  const merge = async (candidate: DuplicateCandidate) => {
    if (!targetId || !reason.trim()) return
    const target = targetId === candidate.left.id ? candidate.left : candidate.right
    const source = targetId === candidate.left.id ? candidate.right : candidate.left
    setBusy(true)
    setError('')
    try {
      await apiClient.post(`/api/v1/bowlers/duplicates/${tournamentId}/merge`, {
        source_player_id: source.id,
        target_player_id: target.id,
        full_name: target.full_name,
        usbc_number: target.usbc_number,
        average: target.average,
        reason: reason.trim(),
      })
      await finish()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to merge player records.')
    } finally {
      setBusy(false)
    }
  }

  if (!error && (!data || data.count === 0)) return null

  return (
    <section className={`${cardStyles.card} ${styles.duplicatePanel}`} aria-labelledby="duplicate-player-heading">
      <div className={styles.duplicateHeader}>
        <div>
          <h3 id="duplicate-player-heading"><AlertTriangle aria-hidden="true" /> Possible duplicate players</h3>
          <p>Compare records before merging. Entries, payments, scores, and downstream results are preserved.</p>
        </div>
        <button type="button" className={`${buttonStyles.button} ${buttonStyles.ghost}`} onClick={() => void load()} disabled={busy}><RefreshCcw aria-hidden="true" />Refresh</button>
      </div>
      {error && <p className={styles.duplicateError} role="alert">{error}</p>}
      {data?.candidates.map(candidate => (
        <div className={styles.duplicateCandidate} key={candidate.pair_key}>
          <div className={styles.duplicateReason}>{candidate.reason}</div>
          <div className={styles.duplicateComparison}>
            <PlayerComparison player={candidate.left} />
            <span className={styles.duplicateVersus}>and</span>
            <PlayerComparison player={candidate.right} />
          </div>
          {!candidate.can_merge && <p className={styles.duplicateWarning}>These records belong to different squads and cannot be merged.</p>}
          {mergePair === candidate.pair_key ? (
            <div className={styles.duplicateMergeForm}>
              <label>Record to keep
                <select className={formStyles.input} value={targetId ?? ''} onChange={event => setTargetId(Number(event.target.value))}>
                  <option value="" disabled>Select the canonical record</option>
                  <option value={candidate.left.id}>{candidate.left.full_name} (#{candidate.left.id})</option>
                  <option value={candidate.right.id}>{candidate.right.full_name} (#{candidate.right.id})</option>
                </select>
              </label>
              <label>Reason for merge
                <input className={formStyles.input} value={reason} onChange={event => setReason(event.target.value)} placeholder="Example: duplicate import" maxLength={1000} />
              </label>
              <div className={styles.duplicateActions}>
                <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary}`} disabled={busy || !targetId || !reason.trim()} onClick={() => void merge(candidate)}><GitMerge aria-hidden="true" />Confirm Merge</button>
                <button type="button" className={`${buttonStyles.button} ${buttonStyles.ghost}`} disabled={busy} onClick={() => setMergePair(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className={styles.duplicateActions}>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary}`} disabled={busy || !candidate.can_merge} onClick={() => { setMergePair(candidate.pair_key); setTargetId(candidate.left.id) }}><GitMerge aria-hidden="true" />Merge Records</button>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary}`} disabled={busy} onClick={() => void resolve(candidate, 'keep_both')}>Keep Both</button>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.ghost}`} disabled={busy} onClick={() => void resolve(candidate, 'not_duplicate')}>Not a Duplicate</button>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
