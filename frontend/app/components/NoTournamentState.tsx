'use client'

import { useEffect } from 'react'
import { disableScroll, enableScroll } from '../utils/modalUtils'

interface InfoCard {
  title: string
  text: string
}

interface NoTournamentStateProps {
  title?: string
  description?: string
  cards?: InfoCard[]
  actionHref?: string
  actionLabel?: string
}

export default function NoTournamentState({
  title,
  description,
  cards,
  actionHref = '/dashboard',
  actionLabel = 'Go to Dashboard',
}: NoTournamentStateProps) {
  useEffect(() => {
    disableScroll()
    return () => {
      enableScroll()
    }
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
        href={actionHref}
        className="bw-empty-dashboard-link"
      >
        {actionLabel}
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
