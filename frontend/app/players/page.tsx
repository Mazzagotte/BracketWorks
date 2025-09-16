
'use client'
import { useState } from 'react'

type Player = { id: number, name: string, average?: number }

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Alex Carter', average: 195 },
    { id: 2, name: 'Sam Lee', average: 172 }
  ])
  const [name, setName] = useState('')
  const [avg, setAvg] = useState<number | ''>('')

  const add = () => {
    if (!name.trim()) return
    const id = Math.max(0, ...players.map(p => p.id)) + 1
    setPlayers([...players, { id, name: name.trim(), average: typeof avg === 'number' ? avg : undefined }])
    setName('')
    setAvg('')
  }

  return (
    <main>
      <h1>Players</h1>

      <div className="card">
        <div className="row">
          <input className="input" placeholder="Player name" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="Average (opt.)" value={avg} onChange={e => setAvg(e.target.value ? Number(e.target.value) : '')} />
          <button className="btn" onClick={add}>Add Player</button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr><th>ID</th><th>Name</th><th>Average</th></tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.average ?? '—'}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
