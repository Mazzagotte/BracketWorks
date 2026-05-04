'use client'

import { useEffect } from 'react'

interface InfoCard {
  title: string
  text: string
}

interface NoTournamentStateProps {
  title?: string
  description?: string
  cards?: InfoCard[]
}

export default function NoTournamentState({ title, description, cards }: NoTournamentStateProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="bw-empty-wrap">
    <div className="bw-empty-card">
      <h2 className="bw-empty-title">
        {title ?? 'No Tournament Loaded'}
      </h2>

      <p className="bw-empty-description">
        {description ?? 'Select a tournament from the dashboard to get started.'}
      </p>

      <a
        href="/dashboard"
        className="bw-empty-dashboard-link"
      >
        Go to Dashboard
      </a>

      {cards && cards.length > 0 && (
        <div className="bw-empty-grid">
          {cards.map((card, i) => (
            <div key={i} className="bw-empty-grid-card">
              <h3 className="bw-empty-grid-card-title">
                {card.title}
              </h3>
              <p className="bw-empty-grid-card-text">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
