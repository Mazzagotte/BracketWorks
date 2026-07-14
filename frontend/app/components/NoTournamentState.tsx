'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { disableScroll, enableScroll } from '../utils/modalUtils'
import buttonStyles from '../styles/buttons.module.css'
import shellStyles from '../styles/page-shell.module.css'
import styles from './NoTournamentState.module.css'
import { Card, CardBody } from './primitives'

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

interface WorkspaceMeta {
  label: string
  helper: string
}

function getWorkspaceMeta(pathname: string): WorkspaceMeta {
  if (pathname.startsWith('/dashboard')) {
    return {
      label: 'Dashboard Workspace',
      helper: 'Set up tournament details, squads, and system-wide settings before play starts.',
    }
  }

  if (pathname.startsWith('/players')) {
    return {
      label: 'Entries Workspace',
      helper: 'Manage bowlers, entry types, and registration details for each squad.',
    }
  }

  if (pathname.startsWith('/scores')) {
    return {
      label: 'Scores Workspace',
      helper: 'Capture game scores quickly and keep standings ready for bracket progression.',
    }
  }

  if (pathname.startsWith('/brackets')) {
    return {
      label: 'Brackets Workspace',
      helper: 'Generate bracket trees and track winners with clear round-by-round progress.',
    }
  }

  if (pathname.startsWith('/payouts')) {
    return {
      label: 'Payouts Workspace',
      helper: 'Review winners, prize pools, and payout completion in one organized view.',
    }
  }

  return {
    label: 'Tournament Workspace',
    helper: 'Load a tournament to unlock all operational tools in this workspace.',
  }
}

export default function NoTournamentState({
  title,
  description,
  cards,
  actionHref = '/dashboard',
  actionLabel = 'Open Dashboard',
  actions,
}: NoTournamentStateProps) {
  const pathname = usePathname()

  useEffect(() => {
    disableScroll()
    return () => {
      enableScroll()
    }
  }, [])

  const workspaceMeta = getWorkspaceMeta(pathname)
  const renderedActions = actions ?? [{ label: actionLabel, href: actionHref, variant: 'primary' as const }]

  return (
    <div className={`${shellStyles.page} ${styles.wrap}`}>
      <Card variant="primary" className={styles.card}>
        <CardBody>
          <div className={styles.topRow}>
            <p className={styles.workspaceLabel}>{workspaceMeta.label}</p>
            <span className={styles.statusPill}>Awaiting tournament</span>
          </div>

          <div className={styles.heroRow}>
            <div className={styles.heroText}>
              <h2 className={styles.title}>{title ?? 'No Tournament Loaded'}</h2>
              <p className={styles.description}>
                {description ?? 'Load or create a tournament from the dashboard to unlock this workspace.'}
              </p>
              <p className={styles.helper}>{workspaceMeta.helper}</p>
            </div>

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
          </div>

          {cards && cards.length > 0 && (
            <div className={styles.grid}>
              {cards.map((card, i) => (
                <div key={i} className={styles.gridCard}>
                  <span className={styles.gridCardStep}>Step {i + 1}</span>
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
        </CardBody>
      </Card>
    </div>
  )
}
