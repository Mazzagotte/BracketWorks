
'use client'
import { useState } from 'react'

type Player = { id: number, usbc?: string, firstName: string, lastName: string, average: number, lane: string, division: string }

export default function EntriesPage() {
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, firstName: 'Alex', lastName: 'Carter', average: 195, lane: '5A', division: 'Open' },
    { id: 2, firstName: 'Sam', lastName: 'Lee', average: 172, lane: '7B', division: 'Women' }
  ])
  const [usbc, setUsbc] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avg, setAvg] = useState<number | ''>('')
  const [lane, setLane] = useState('')
  const [division, setDivision] = useState('Open')

  const add = () => {
    if (!firstName.trim() || !lastName.trim() || typeof avg !== 'number' || !lane.trim()) return
    const id = Math.max(0, ...players.map(p => p.id)) + 1
    setPlayers([
      ...players,
      {
        id,
        usbc: usbc.trim() || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        average: avg,
        lane: lane.trim(),
        division
      }
    ])
    setUsbc('')
    setFirstName('')
    setLastName('')
    setAvg('')
    setLane('')
    setDivision('Open')
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8f9fb', fontFamily: 'Inter, Arial, sans-serif', padding: 0 }}>
      <div style={{
        minWidth: 480,
        width: 'fit-content',
        margin: '2.2rem auto 2.7rem auto',
        background: 'linear-gradient(135deg, #fff 80%, #f8f9fb 100%)',
        borderRadius: 20,
        boxShadow: '0 8px 40px #232b3640, 0 1.5px 8px #f0a50020',
        padding: '2.2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
  <h1 style={{ fontSize: '2rem', color: '#232b36', marginBottom: '1.2rem', fontWeight: 700 }}>Entries</h1>
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: 22,
          justifyContent: 'center',
          flexWrap: 'nowrap',
          alignItems: 'center',
          width: '100%',
          background: '#f8fafd',
          borderRadius: 14,
          boxShadow: '0 2px 8px #232b3608',
          padding: '18px 28px',
          border: '1.5px solid #dbe2ea',
        }}>
          <input style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: 120 }} placeholder="USBC # (opt.)" value={usbc} onChange={e => setUsbc(e.target.value)} />
          <input style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: 140 }} placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} />
          <input style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: 140 }} placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} />
          <input style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: 120 }} placeholder="Average" value={avg} onChange={e => setAvg(e.target.value ? Number(e.target.value) : '')} />
          <input style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: 100 }} placeholder="Lane" value={lane} onChange={e => setLane(e.target.value)} />
          <select style={{ fontSize: 16, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #dbe2ea', background: '#f8fafd', width: 120 }} value={division} onChange={e => setDivision(e.target.value)}>
            <option value="Open">Open</option>
            <option value="Women">Women</option>
            <option value="Youth">Youth</option>
            <option value="Senior">Senior</option>
          </select>
          <button style={{ fontSize: 16, padding: '10px 24px', borderRadius: 8, background: 'linear-gradient(90deg, #6ed0fa 60%, #4f8cff 100%)', color: '#fff', fontWeight: 700, border: 'none', boxShadow: '0 1px 4px #232b3608', cursor: 'pointer', transition: 'background 0.18s', marginLeft: 10 }} onClick={add}>Add Player</button>
        </div>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <table style={{ minWidth: 480, width: 'auto', borderCollapse: 'collapse', background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px #232b3608', fontSize: 16, margin: '0 auto' }} aria-label="Entries">
            <thead>
              <tr style={{ background: '#f8f9fb', color: '#232b36', fontWeight: 700 }}>
                <th style={{ padding: '12px 8px', borderBottom: '2px solid #dbe2ea' }}>USBC #</th>
                <th style={{ padding: '12px 8px', borderBottom: '2px solid #dbe2ea' }}>First Name</th>
                <th style={{ padding: '12px 8px', borderBottom: '2px solid #dbe2ea' }}>Last Name</th>
                <th style={{ padding: '12px 8px', borderBottom: '2px solid #dbe2ea' }}>Average</th>
                <th style={{ padding: '12px 8px', borderBottom: '2px solid #dbe2ea' }}>Lane</th>
                <th style={{ padding: '12px 8px', borderBottom: '2px solid #dbe2ea' }}>Division</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f0f4fa', background: '#fff' }}>
                  <td style={{ padding: '10px 8px', color: '#232b36', fontWeight: 500 }}>{p.usbc ?? '—'}</td>
                  <td style={{ padding: '10px 8px', color: '#232b36', fontWeight: 500 }}>{p.firstName}</td>
                  <td style={{ padding: '10px 8px', color: '#232b36', fontWeight: 500 }}>{p.lastName}</td>
                  <td style={{ padding: '10px 8px', color: '#232b36', fontWeight: 500 }}>{p.average}</td>
                  <td style={{ padding: '10px 8px', color: '#232b36', fontWeight: 500 }}>{p.lane}</td>
                  <td style={{ padding: '10px 8px', color: '#232b36', fontWeight: 500 }}>{p.division}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
