"use client";

"use client";
function get12hrTimes() {
  const times: string[] = [];
  // First all AM times
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${h}:${m.toString().padStart(2, '0')} AM`);
    }
  }
  // Then all PM times
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${h}:${m.toString().padStart(2, '0')} PM`);
    }
  }
  return times;
}
const timeOptions = get12hrTimes();
import { useEffect, useState } from 'react';
import styles from '../page.module.css';
import Link from 'next/link';

// TypeScript types for tournament and form
export interface Tournament {
  id: number;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  squad_times: Record<string, string[]>;
}

export interface TournamentForm {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  squad_times: Record<string, string[]>;
}

function getDatesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function EditTournamentModal({ open, onClose, tournament, onSave }: {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSave: (form: TournamentForm) => void;
}) {
  const [form, setForm] = useState<TournamentForm>({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    squad_times: {}
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which input to focus (date, index)
  const [focusTime, setFocusTime] = useState<{date: string, idx: number} | null>(null);
  const timeInputs: Record<string, Array<HTMLInputElement | null>> = {};

  useEffect(() => {
    if (tournament) {
      setForm({
        name: tournament.name || '',
        location: tournament.location || '',
        start_date: tournament.start_date || '',
        end_date: tournament.end_date || '',
        squad_times: tournament.squad_times || {}
      });
    }
  }, [tournament]);

  // Focus new time input when added
  useEffect(() => {
    if (focusTime && timeInputs[focusTime.date]?.[focusTime.idx]) {
      timeInputs[focusTime.date][focusTime.idx]?.focus();
      setFocusTime(null);
    }
  });

  // 12hr format validation (hh:mm am/pm)
  function isValid12hr(time: string) {
    return /^([1-9]|1[0-2]):[0-5][0-9] ?([aApP][mM])$/.test(time.trim());
  }

  if (!open) return null;

  const days = getDatesBetween(form.start_date || '', form.end_date || '');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(30, 34, 44, 0.45)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
    }}>
      <div style={{ background: '#ffeeba', color: '#856404', padding: 8, borderRadius: 6, marginBottom: 12, fontWeight: 600, fontSize: 15 }}>
        {'EditTournamentModal mounted/rendered at ' + new Date().toLocaleTimeString()}
      </div>
      <form
        style={{
          background: 'linear-gradient(135deg, #fff 80%, #f0f4fa 100%)',
          borderRadius: 20,
          padding: '36px 36px 28px 36px',
          minWidth: 420,
          boxShadow: '0 8px 40px #232b3640, 0 1.5px 8px #232b3620',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
        onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          try {
            // Debug: log form data
            // eslint-disable-next-line no-console
            console.log('Submitting tournament form:', form);
            await onSave(form);
            // Debug: show alert on success
            alert('Save handler completed successfully.');
          } catch (err: any) {
            setError(err?.message || 'Failed to save.');
            // Debug: show alert on error
            alert('Save handler error: ' + (err?.message || err));
          } finally {
            setSaving(false);
          }
        }}
      >
        {error && (
          <div style={{ color: '#e74c3c', marginBottom: 12, fontWeight: 500, fontSize: 15 }}>{error}</div>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'none',
            border: 'none',
            fontSize: 26,
            color: '#b0b6c3',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.color = '#e74c3c')}
          onMouseOut={e => (e.currentTarget.style.color = '#b0b6c3')}
        >
          ×
        </button>
        <h2 style={{ marginBottom: 24, fontWeight: 700, fontSize: 26, color: '#232b36', letterSpacing: '-0.5px' }}>Edit Tournament</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <label style={{ fontWeight: 500, color: '#232b36', fontSize: 15 }}>Name:<br />
              <input
                className={styles.input}
                style={{ marginTop: 4, marginBottom: 16, fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: '100%' }}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label style={{ fontWeight: 500, color: '#232b36', fontSize: 15 }}>Location:<br />
              <input
                className={styles.input}
                style={{ marginTop: 4, marginBottom: 16, fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: '100%' }}
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </label>
            <label style={{ fontWeight: 500, color: '#232b36', fontSize: 15 }}>Start Date:<br />
              <input
                className={styles.input}
                type="date"
                style={{ marginTop: 4, marginBottom: 16, fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: '100%' }}
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </label>
            <label style={{ fontWeight: 500, color: '#232b36', fontSize: 15 }}>End Date:<br />
              <input
                className={styles.input}
                type="date"
                style={{ marginTop: 4, marginBottom: 16, fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: '100%' }}
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </label>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10, color: '#232b36', fontSize: 16 }}>Squad Times by Day:</div>
            {days.length === 0 && <div style={{ color: '#b0b6c3', fontSize: 15, marginBottom: 8 }}>Select start and end dates to add squad times.</div>}
            {days.map(date => (
              <div key={date} style={{ marginBottom: 16, background: '#f8f9fb', borderRadius: 10, padding: 10, boxShadow: '0 1px 4px #232b3608' }}>
                <div style={{ fontWeight: 500, marginBottom: 6, color: '#3a4250', fontSize: 15 }}>{date}</div>
                {(form.squad_times[date] || []).map((time, i) => {
                  if (!timeInputs[date]) timeInputs[date] = [];
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center' }}>
                      <select
                        className={styles.input}
                        ref={el => { timeInputs[date][i] = el as any; }}
                        style={{ maxWidth: 140, fontSize: 15, padding: '7px 10px', borderRadius: 7, border: '1.5px solid #dbe2ea', background: '#fff' }}
                        value={time}
                        onChange={e => setForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].map((t, j) => j === i ? e.target.value : t) } }))}
                      >
                        <option value="" disabled>Select time</option>
                        {timeOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: f.squad_times[date].filter((_, j) => j !== i) } }))}
                        style={{
                          color: '#e74c3c',
                          background: 'none',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 20,
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'color 0.15s',
                        }}
                        onMouseOver={e => (e.currentTarget.style.color = '#c0392b')}
                        onMouseOut={e => (e.currentTarget.style.color = '#e74c3c')}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const times = form.squad_times[date] || [];
                    // Only add if last is selected
                    if (times.length === 0 || (times[times.length - 1] && times[times.length - 1] !== '')) {
                      setForm(f => ({ ...f, squad_times: { ...f.squad_times, [date]: [...(f.squad_times[date] || []), ''] } }));
                      setFocusTime({ date, idx: (form.squad_times[date]?.length || 0) });
                    }
                  }}
                  className={styles.primaryBtn}
                  style={{
                    marginTop: 2,
                    fontSize: 14,
                    padding: '5px 14px',
                    borderRadius: 7,
                    background: 'linear-gradient(90deg, #4f8cff 60%, #6ed0fa 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    boxShadow: '0 1px 4px #232b3608',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#3578e5')}
                  onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #4f8cff 60%, #6ed0fa 100%)')}
                >
                  Add Time
                </button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className={styles.primaryBtn}
            style={{
              fontSize: 17,
              padding: '10px 28px',
              borderRadius: 9,
              background: 'linear-gradient(90deg, #4f8cff 60%, #6ed0fa 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              boxShadow: '0 1px 4px #232b3608',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              transition: 'background 0.15s',
            }}
            disabled={saving}
            onMouseOver={e => (e.currentTarget.style.background = '#3578e5')}
            onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #4f8cff 60%, #6ed0fa 100%)')}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            style={{
              background: '#f3f5fa',
              color: '#232b36',
              fontWeight: 600,
              fontSize: 17,
              padding: '10px 22px',
              borderRadius: 9,
              border: '1.5px solid #dbe2ea',
              boxShadow: '0 1px 4px #232b3608',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onClick={onClose}
            onMouseOver={e => (e.currentTarget.style.background = '#e4e8f0')}
            onMouseOut={e => (e.currentTarget.style.background = '#f3f5fa')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TournamentDashboard() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  useEffect(() => {
    fetch('/api/v1/tournaments/')
      .then(r => r.json())
      .then(async data => {
        if (data.length > 0) {
          setTournament(data[0]);
        } else {
          // No tournament exists, create one
          const res = await fetch('/api/v1/tournaments/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'New Tournament',
              location: '',
              start_date: '',
              end_date: '',
              squad_times: {}
            })
          });
          if (res.ok) {
            const created = await res.json();
            setTournament(created);
          }
        }
      });
  }, []);

  const handleSave = async (form: TournamentForm) => {
    if (createMode) {
      // Create new tournament
      const res = await fetch('/api/v1/tournaments/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        let msg = 'Failed to create.';
        try {
          const data = await res.json();
          msg = data.detail || msg;
        } catch {}
        throw new Error(msg);
      }
      const created = await res.json();
      setTournament(created);
      setModalOpen(false);
      setCreateMode(false);
    } else {
      // Edit existing tournament
      if (!tournament) throw new Error('No tournament loaded');
      const res = await fetch(`/api/v1/tournaments/${tournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        let msg = 'Failed to save.';
        try {
          const data = await res.json();
          msg = data.detail || msg;
        } catch {}
        throw new Error(msg);
      }
      const updated = await res.json();
      setTournament(updated);
      setModalOpen(false);
    }
  };

  return (
    <main className={styles.main}>
      <EditTournamentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCreateMode(false); }}
        tournament={createMode ? null : tournament}
        onSave={handleSave}
      />
      <div className={styles.heroCard}>
        <h2 className={styles.heroTitle}>Tournament Overview</h2>
        <p className={styles.heroText}>Name: {tournament?.name || '—'}</p>
        <p className={styles.heroText}>Location: {tournament?.location || '—'}</p>
        <p className={styles.heroText}>Date: {tournament?.start_date || '—'} {tournament?.end_date ? `to ${tournament.end_date}` : ''}</p>
        <p className={styles.heroText}>Squad Times:</p>
        {tournament?.squad_times && Object.keys(tournament.squad_times).length > 0 ? (
          <ul style={{ textAlign: 'left', margin: '0 auto', maxWidth: 340 }}>
            {Object.entries(tournament.squad_times).map(([date, times]) => (
              <li key={date}><b>{date}:</b> {times.join(', ')}</li>
            ))}
          </ul>
        ) : <p style={{ color: '#888' }}>—</p>}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button
            className={styles.primaryBtn}
            onClick={() => { setModalOpen(true); setCreateMode(false); }}
            disabled={!tournament}
            style={!tournament ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            Edit Tournament
          </button>
          <button
            className={styles.primaryBtn}
            onClick={() => { setModalOpen(true); setCreateMode(true); }}
            style={{ background: 'linear-gradient(90deg, #6ed0fa 60%, #4f8cff 100%)' }}
          >
            Create Tournament
          </button>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.card}>
          <h3>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className={styles.primaryBtn}>Add Bracket</button>
            <button className={styles.primaryBtn}>Add Player</button>
            <button className={styles.primaryBtn}>Start Squad</button>
            <button className={styles.primaryBtn}>View Payouts</button>
          </div>
        </div>
        <div className={styles.card}>
          <h3>Brackets Summary</h3>
          <ul className={styles.actionList}>
            <li>Open Brackets: 3</li>
            <li>Completed Brackets: 1</li>
            <li>
              <Link href="/brackets" className={styles.navLink}>
                Manage Brackets
              </Link>
            </li>
          </ul>
        </div>
        <div className={styles.card}>
          <h3>Players Summary</h3>
          <ul className={styles.actionList}>
            <li>Total Players: 42</li>
            <li>New Signups: 5</li>
            <li>
              <Link href="/players" className={styles.navLink}>
                Add/Import Players
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.card}>
          <h3>Squads & Schedule</h3>
          <ul className={styles.actionList}>
            <li>Next Squad: B (1PM)</li>
            <li>Players Assigned: 28</li>
            <li>
              <button className={styles.primaryBtn}>Assign Players</button>
            </li>
          </ul>
        </div>
        <div className={styles.card}>
          <h3>Payouts Preview</h3>
          <ul className={styles.actionList}>
            <li>Payout Presets: 2</li>
            <li>Total Payout: $1,200</li>
            <li>
              <button className={styles.primaryBtn}>Configure Payouts</button>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
