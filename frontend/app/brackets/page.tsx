
'use client'
import { useEffect, useState } from 'react'

type Match = { seedA: number, seedB: number }
type Preview = { size: number, rounds: { name: string, matches: Match[] }[] }

export default function BracketsPage() {
  const [size, setSize] = useState(8)
  const [preview, setPreview] = useState<Preview | null>(null)

  const load = async () => {
    try {
      const url = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000') + `/api/v1/brackets/preview?bracket_size=${size}`
      const data = await fetch(url).then(r => r.json())
      setPreview(data)
    } catch (e) {
      console.error(e)
      setPreview(null)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <main>
      <h1>Brackets</h1>
      <div className="card">
        <div className="row">
          <input className="input" type="number" min={2} step={2} value={size} onChange={e => setSize(Number(e.target.value))} />
          <button className="btn" onClick={load}>Preview</button>
        </div>
      </div>
      {!preview && <p>No preview loaded.</p>}
      {preview && (
        <div className="card">
          <h3>{preview.rounds[0]?.name} — size {preview.size}</h3>
          <table className="table">
            <thead><tr><th>Match</th><th>Seed A</th><th>Seed B</th></tr></thead>
            <tbody>
              {preview.rounds[0].matches.map((m, i) => (
                <tr key={i}><td>#{i+1}</td><td>{m.seedA}</td><td>{m.seedB}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
