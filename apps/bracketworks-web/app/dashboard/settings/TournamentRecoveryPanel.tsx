"use client";

import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';

import { apiClient } from '../../lib/api';
import { useToast } from '../../components/Toast';
import styles from './dashboard-settings-page.module.css';

type RestorePoint = {
  id: number;
  trigger: string;
  summary: string;
  created_at: string;
  later_activity_count: number;
  safe_to_restore: boolean;
  restored_at: string | null;
};

export function TournamentRecoveryPanel({ tournamentId, tournamentName }: { tournamentId: number; tournamentName: string }) {
  const { addToast } = useToast();
  const [points, setPoints] = useState<RestorePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setPoints(await apiClient.get<RestorePoint[]>(`/api/v1/tournament-snapshots/${tournamentId}`, false)); }
    catch { setPoints([]); }
    finally { setLoading(false); }
  }, [tournamentId]);
  useEffect(() => { void load(); }, [load]);

  const restore = async (point: RestorePoint) => {
    const confirmation = window.prompt(`Type "${tournamentName}" to restore this tournament to the selected point.`);
    if (confirmation === null) return;
    let acknowledgeLaterActivity = false;
    if (!point.safe_to_restore) {
      acknowledgeLaterActivity = window.confirm(
        `${point.later_activity_count} later activity events may be overwritten. Have you inspected the restore point and want to continue?`,
      );
      if (!acknowledgeLaterActivity) return;
    }
    try {
      await apiClient.post(`/api/v1/tournament-snapshots/${tournamentId}/${point.id}/restore`, {
        confirmation, acknowledge_later_activity: acknowledgeLaterActivity,
        reason: 'Restored from Tournament Settings recovery history',
      });
      addToast({ type: 'success', message: 'Tournament state restored. Reloading…' });
      window.location.reload();
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to restore tournament.' });
    }
  };

  return (
    <section className={styles.staffPanel} aria-labelledby="recovery-title">
      <div className={styles.staffHeader}>
        <span className={styles.staffIcon}><History aria-hidden="true" /></span>
        <div><h2 id="recovery-title">Recovery History</h2><p>Restore points created before important tournament changes.</p></div>
      </div>
      {loading ? <p className={styles.staffState}>Loading recovery history…</p> : points.length === 0 ? (
        <p className={styles.staffState}>No restore points have been created yet.</p>
      ) : (
        <div className={styles.staffList}>
          {points.map(point => (
            <div className={styles.staffRow} key={point.id}>
              <div>
                <strong>{point.summary}</strong>
                <span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(point.created_at))} · {point.safe_to_restore ? 'No unexpected later activity' : `${point.later_activity_count} later events`}</span>
              </div>
              <button className={styles.restoreButton} type="button" onClick={() => void restore(point)}>
                <RotateCcw aria-hidden="true" />Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
