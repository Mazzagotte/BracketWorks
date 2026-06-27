'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { disableScroll, enableScroll } from '../utils/modalUtils'
import buttonStyles from '../styles/buttons.module.css'
import cardStyles from '../styles/cards.module.css'
import shellStyles from '../styles/page-shell.module.css'
import styles from './NoTournamentState.module.css'

interface InfoCard {
  title: string
  text: string
}

interface EmptyAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

interface NoTournamentStateProps {
  title?: string
  description?: string
  cards?: InfoCard[]
  actionHref?: string
  actionLabel?: string
  actions?: EmptyAction[]
}

export default function NoTournamentState({
  title,
  description,
  cards,
  actionHref = '/dashboard',
  actionLabel = 'Go to Dashboard',
  actions,
}: NoTournamentStateProps) {
  useEffect(() => {
    disableScroll()
    return () => {
      enableScroll()
    }
  }, [])

  const renderedActions = actions ?? [{ label: actionLabel, href: actionHref, variant: 'primary' as const }]

  return (
    <div className={`${shellStyles.page} ${styles.wrap}`}>
      <section className={`${cardStyles.card} ${cardStyles.accentCard} ${styles.card}`}>
        <p className={styles.kicker}>Tournament workspace</p>
        <h2 className={styles.title}>
          {title ?? 'No Tournament Loaded'}
        </h2>

        <p className={styles.description}>
          {description ?? 'Load or create a tournament from the dashboard to unlock this workspace.'}
        </p>

        <div className={styles.actions}>
          {renderedActions.map((action) => {
            const variantClass = action.variant === 'secondary' ? buttonStyles.secondary : buttonStyles.primary
            const className = `${buttonStyles.button} ${buttonStyles.medium} ${variantClass} ${styles.action}`

            if (action.href) {
              return (
                <Link key={action.label} href={action.href} className={className}>
                  {action.label}
                </Link>
              )
            }

            return (
              <button key={action.label} type="button" onClick={action.onClick} className={className}>
                {action.label}
              </button>
            )
          })}
        </div>

        {cards && cards.length > 0 && (
          <div className={styles.grid}>
            {cards.map((card, i) => (
              <div key={i} className={`${cardStyles.panel} ${styles.gridCard}`}>
                <h3 className={styles.gridCardTitle}>
                  {card.title}
                </h3>
                <p className={styles.gridCardText}>
                  {card.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
