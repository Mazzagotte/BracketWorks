"use client";
import React from 'react';
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
// Show all AM and PM times
import { useEffect, useState } from 'react';
import styles from '../page.module.css';
import ConfirmationDialog from '../components/ConfirmationDialog';
import Link from 'next/link';
import { API } from '../lib/api';

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
  user_id?: number;
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
          } catch (err: any) {
            setError(err?.message || 'Failed to save.');
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
                        &times;
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
  // SSR-safe isAdmin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedSquadDate, setSelectedSquadDate] = useState<string>('');
  const [selectedSquadTime, setSelectedSquadTime] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: number, name: string} | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  useEffect(() => {
    const adminFlag = localStorage.getItem('is_admin');
    setIsAdmin(adminFlag === '1' || adminFlag === 'true');
  }, []);

  // Fetch all tournaments for user when load modal opens
  const fetchAllTournaments = async () => {
    const path = isAdmin ? '/api/v1/tournaments/?all=1' : '/api/v1/tournaments/';
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Tournament fetch skipped: missing auth token');
      return;
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const response = await fetch(API(path), { headers });
    if (response.ok) {
      const data = await response.json();
      setAllTournaments(data);
    } else {
      console.warn('Tournament fetch failed', response.status);
    }
  };

  // Load selected tournament
  const handleLoadTournament = (t: Tournament) => {
    setTournament(t);
    setLoadModalOpen(false);
  };

  // Delete selected tournament
  const handleDeleteTournament = async (id: number) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(API(`/api/v1/tournaments/${id}`), {
      method: 'DELETE',
      headers
    });
    if (response.ok) {
      setAllTournaments(allTournaments.filter(t => t.id !== id));
      setDeleteConfirm(null);
      setConfirmMsg('Tournament deleted successfully!');
      setConfirmOpen(true);
    } else {
      setConfirmMsg('Failed to delete tournament.');
      setConfirmOpen(true);
    }
  };

  // Save tournament handler (stub, implement as needed)
  const handleSave = async (form: TournamentForm) => {
    // Example: Save logic here, update tournament state, etc.
    setTournament({
      id: tournament?.id ?? Date.now(),
      ...form
    });
    setModalOpen(false);
    setCreateMode(false);
    setConfirmMsg('Tournament changes saved successfully!');
    setConfirmOpen(true);
  };

  return (
      <>
        <ConfirmationDialog open={confirmOpen} message={confirmMsg} onClose={() => setConfirmOpen(false)} />
        <EditTournamentModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setCreateMode(false); }}
          tournament={createMode ? null : tournament}
          onSave={handleSave}
        />
        <div>
          <div className={styles.heroCard}>
            <h2 className={styles.heroTitle}>Tournament Overview</h2>
            <p className={styles.heroText}>Name: {tournament?.name || ''}</p>
            <p className={styles.heroText}>Location: {tournament?.location || ''}</p>
            <p className={styles.heroText}>Date: {tournament?.start_date || ''} {tournament?.end_date ? `to ${tournament.end_date}` : ''}</p>
            <p className={styles.heroText} style={{ marginBottom: '0.7rem' }}>Squad Times:</p>
            <>
              {tournament && tournament.squad_times && Object.keys(tournament.squad_times).length > 0 ? (
                <ul style={{ textAlign: 'left', margin: '0 auto', maxWidth: 340, padding: 0, listStyle: 'none' }}>
                  {Object.entries(tournament.squad_times).map(([date, times]) => (
                    <li key={date} style={{ marginBottom: '0.7em', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: '#232b36', fontSize: '1.08em', marginRight: 6 }}>{date}:</span>
                      <span style={{ fontWeight: 500, fontSize: '1em', color: '#232b36' }}>{times.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              ) : <p style={{ color: '#888', marginBottom: '1.2em' }}>No squad times</p>}
              <div style={{ display: 'flex', gap: 18, marginTop: 24, justifyContent: 'center' }}>
                <button
                  className={styles.primaryBtn}
                  style={{ minWidth: 0, flex: 1, maxWidth: 180, fontSize: '1.08em', background: 'linear-gradient(90deg, #ffb347 60%, #ffcc80 100%)', color: '#232b36' }}
                  onClick={() => { setModalOpen(true); setCreateMode(false); }}
                  disabled={!tournament}
                >
                  Edit Tournament
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{ minWidth: 0, flex: 1, maxWidth: 180, fontSize: '1.08em', background: 'linear-gradient(90deg, #6ed0fa 60%, #4f8cff 100%)', color: '#fff' }}
                  onClick={() => { setModalOpen(true); setCreateMode(true); }}
                >
                  Create Tournament
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{ minWidth: 0, flex: 1, maxWidth: 180, fontSize: '1.08em', background: 'linear-gradient(90deg, #ffb347 60%, #ffcc80 100%)', color: '#232b36' }}
                  onClick={() => {
                    setLoadModalOpen(true);
                    fetchAllTournaments();
                  }}
                >
                  Load Tournament
                </button>
              </div>
            </>
          </div>
          {/* Squad Selection Card */}
          {tournament && tournament.squad_times && Object.keys(tournament.squad_times).length > 0 && (
            <div className={styles.heroCard}>
              <h2 className={styles.heroTitle} style={{ color: '#232b36', fontSize: '1.3rem', marginBottom: '1.2em' }}>Squad Selection</h2>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1em',
                alignItems: 'center',
                margin: '0 auto',
                maxWidth: 400,
                padding: '0.5em 0 0.5em 0'
              }}>
                {Object.entries(tournament.squad_times).map(([date, times]) => (
                  times.map((time, i) => {
                    const isSelected = selectedSquadDate === date && selectedSquadTime === time;
                    return (
                      <button
                        key={date + '-' + time}
                        className={styles.squadPill}
                        style={{
                          width: '100%',
                          maxWidth: 340,
                          fontSize: '1.08em',
                          padding: '14px 0',
                          borderRadius: 32,
                          border: isSelected ? '2.5px solid #4f8cff' : '1.5px solid #ffd580',
                          background: isSelected ? 'linear-gradient(90deg, #6ed0fa 60%, #4f8cff 100%)' : '#fff',
                          color: isSelected ? '#fff' : '#232b36',
                          fontWeight: 700,
                          boxShadow: isSelected ? '0 2px 12px #4f8cff33' : '0 1px 4px #232b3608',
                          cursor: 'pointer',
                          transition: 'all 0.18s',
                          outline: isSelected ? 'none' : undefined,
                        }}
                        onClick={() => {
                          setSelectedSquadDate(date);
                          setSelectedSquadTime(time);
                        }}
                        aria-pressed={isSelected}
                      >
                        {date} — {time}
                      </button>
                    );
                  })
                ))}
                {/* Load button below pills */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.2em', width: '100%' }}>
                  <button
                    className={styles.primaryBtn}
                    style={{ fontSize: '1.08em', padding: '10px 38px', borderRadius: 9, background: 'linear-gradient(90deg, #6ed0fa 60%, #4f8cff 100%)', color: '#fff', fontWeight: 700, boxShadow: '0 1px 4px #232b3608', border: 'none', cursor: selectedSquadDate && selectedSquadTime ? 'pointer' : 'not-allowed', opacity: selectedSquadDate && selectedSquadTime ? 1 : 0.6, width: '100%', maxWidth: 340 }}
                    disabled={!selectedSquadDate || !selectedSquadTime}
                    onClick={() => {
                      // TODO: Implement actual squad loading logic here
                      setConfirmMsg(`Squad loaded: ${selectedSquadDate} — ${selectedSquadTime}`);
                      setConfirmOpen(true);
                    }}
                  >
                    Load Selected Squad
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Load Tournament Modal */}
          {loadModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,34,44,0.45)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 32, minWidth: 340, boxShadow: '0 8px 40px #232b3640', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                <h2 style={{ marginBottom: 18 }}>{isAdmin ? 'All Tournaments' : 'Your Tournaments'}</h2>
                {isAdmin && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 15, color: '#4f8cff', fontWeight: 500 }}>Admin: Viewing all tournaments</span>
                  </div>
                )}
                <button style={{ position: 'absolute', top: 18, right: 18, fontSize: 22, background: 'none', border: 'none', color: '#b0b6c3', cursor: 'pointer' }} onClick={() => setLoadModalOpen(false)}>&times;</button>
                {allTournaments.length === 0 ? (
                  <div style={{ color: '#888', fontSize: 16 }}>No tournaments found.</div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {allTournaments.map(t => (
                      <li key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                        <span style={{ fontWeight: 500 }}>{t.name}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className={styles.primaryBtn} style={{ background: '#4f8cff', color: '#fff', fontSize: 14, padding: '6px 14px', borderRadius: 7 }} onClick={() => handleLoadTournament(t)}>Load</button>
                          <button className={styles.primaryBtn} style={{ background: '#e74c3c', color: '#fff', fontSize: 14, padding: '6px 14px', borderRadius: 7 }} onClick={() => setDeleteConfirm({id: t.id, name: t.name})}>Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </>
  );
}
