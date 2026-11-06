'use client'

import { useCallback, useEffect, useState } from 'react'
import { GitMerge, RefreshCcw } from 'lucide-react'
import { Button, Card, CardHeader, ICON_SIZE, Notice, SelectField, TextField } from '@bracketworks/ui'
import { apiClient } from '../../lib/api'
import styles from './DuplicateResolutionPanel.module.css'

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
    <div className={styles.player}>
      <p className={styles.playerName}>{player.full_name}</p>
      <dl className={styles.facts}>
        <div><dt>USBC</dt><dd>{player.usbc_number || 'Not provided'}</dd></div>
        <div><dt>Average</dt><dd>{player.average ?? 'Missing'}</dd></div>
        <div><dt>Lane</dt><dd>{player.lane || '-'}</dd></div>
        <div><dt>Entries</dt><dd>{entries.length ? entries.map(([name, count]) => `${name} ${count}`).join(', ') : 'None'}</dd></div>
        <div><dt>Side pots</dt><dd>{sidePots.length ? sidePots.join(', ') : 'None'}</dd></div>
        <div><dt>Paid</dt><dd>${Number(player.amount_paid).toFixed(2)}</dd></div>
      </dl>
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
    <Card aria-labelledby="duplicate-player-heading">
      <CardHeader
        title={<span id="duplicate-player-heading">Possible duplicate players</span>}
        description="Compare records before merging. Entries, payments, scores, and results are kept."
        actions={(
          <Button size="sm" variant="ghost" icon={<RefreshCcw size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => void load()} disabled={busy}>
            Refresh
          </Button>
        )}
      />
      <div className={styles.body}>
        {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
        {data?.candidates.map(candidate => (
          <section className={styles.candidate} key={candidate.pair_key} aria-label={candidate.reason}>
            <h3 className={styles.reason}>{candidate.reason}</h3>
            <div className={styles.comparison}>
              <PlayerComparison player={candidate.left} />
              <PlayerComparison player={candidate.right} />
            </div>
            {!candidate.can_merge ? (
              <Notice tone="warning">These records belong to different squads and cannot be merged.</Notice>
            ) : null}
            {mergePair === candidate.pair_key ? (
              <div className={styles.mergeForm}>
                <SelectField label="Record to keep" value={targetId ?? ''} onChange={event => setTargetId(Number(event.target.value))}>
                  <option value="" disabled>Select the record to keep</option>
                  <option value={candidate.left.id}>{candidate.left.full_name} (#{candidate.left.id})</option>
                  <option value={candidate.right.id}>{candidate.right.full_name} (#{candidate.right.id})</option>
                </SelectField>
                <TextField label="Reason for merge" value={reason} onChange={event => setReason(event.target.value)} helper="For example: duplicate import" maxLength={1000} />
                <div className={styles.actions}>
                  <Button variant="secondary" disabled={busy} onClick={() => setMergePair(null)}>Cancel</Button>
                  <Button variant="primary" icon={<GitMerge size={ICON_SIZE.md} aria-hidden="true" />} disabled={busy || !targetId || !reason.trim()} onClick={() => void merge(candidate)}>
                    Confirm merge
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void resolve(candidate, 'not_duplicate')}>Not a duplicate</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void resolve(candidate, 'keep_both')}>Keep both</Button>
                <Button
                  size="sm"
                  variant="accent-outline"
                  icon={<GitMerge size={ICON_SIZE.md} aria-hidden="true" />}
                  disabled={busy || !candidate.can_merge}
                  onClick={() => { setMergePair(candidate.pair_key); setTargetId(candidate.left.id) }}
                >
                  Merge records
                </Button>
              </div>
            )}
          </section>
        ))}
      </div>
    </Card>
  )
}
