
'use client'
import { useState } from 'react'

type Line = { lane: number, game1?: number, game2?: number, game3?: number }

export default function ScoresPage() {
  const [rows, setRows] = useState<Line[]>([{ lane: 1 }, { lane: 2 }, { lane: 3 }])

  const setScore = (i: number, key: keyof Line, value: number | undefined) => {
    const copy = [...rows]
    ;(copy[i] as any)[key] = value
    setRows(copy)
  }

  const total = (r: Line) => (r.game1 ?? 0) + (r.game2 ?? 0) + (r.game3 ?? 0)

  return (
    <main>
      <h1>Scores</h1>
      <div className="card">
        <p>Simple entry grid (demo). Hook this to your backend later.</p>
      </div>
      <table className="table">
        <thead>
          <tr><th>Lane</th><th>Game 1</th><th>Game 2</th><th>Game 3</th><th>Total</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.lane}>
              <td>{r.lane}</td>
              {(['game1', 'game2', 'game3'] as const).map(k => (
                <td key={k}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={300}
                    placeholder="—"
                    value={r[k] ?? ''}
                    onChange={e => setScore(i, k, e.target.value ? Number(e.target.value) : undefined)}
                    style={{ maxWidth: 100 }}
                  />
                </td>
              ))}
              <td>{total(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
