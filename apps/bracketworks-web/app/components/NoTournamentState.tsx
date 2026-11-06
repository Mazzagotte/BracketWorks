'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, LayoutDashboard, Network, Trophy, Users, WalletCards, type LucideIcon } from 'lucide-react'
import { Card, EmptyState, ICON_SIZE, Page, buttonClassName } from '@bracketworks/ui'

interface EmptyAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

interface NoTournamentStateProps {
  title?: string
  description?: string
  actionHref?: string
  actionLabel?: string
  actions?: EmptyAction[]
}

function getWorkspaceIcon(pathname: string): LucideIcon {
  if (pathname.startsWith('/dashboard')) return LayoutDashboard
  if (pathname.startsWith('/players')) return Users
  if (pathname.startsWith('/scores')) return ClipboardList
  if (pathname.startsWith('/brackets')) return Network
  if (pathname.startsWith('/payouts')) return WalletCards
  return Trophy
}

/** Shown when a workspace needs a tournament or squad first: one card with the shared EmptyState. */
export default function NoTournamentState({
  title,
  description,
  actionHref = '/dashboard',
  actionLabel = 'Open dashboard',
  actions,
}: NoTournamentStateProps) {
  const pathname = usePathname()
  const WorkspaceIcon = getWorkspaceIcon(pathname)
  const renderedActions = actions ?? [{ label: actionLabel, href: actionHref, variant: 'primary' as const }]

  return (
    <Page>
      <Card>
        <EmptyState
          icon={<WorkspaceIcon size={ICON_SIZE['2xl']} aria-hidden="true" />}
          title={title ?? 'No tournament loaded'}
          description={description ?? 'Load or create a tournament from the dashboard to unlock this workspace.'}
          action={(
            <>
              {renderedActions.map(action => {
                const className = buttonClassName({ variant: action.variant === 'secondary' ? 'secondary' : 'primary' })
                return action.href ? (
                  <Link key={action.label} href={action.href} className={className}>{action.label}</Link>
                ) : (
                  <button key={action.label} type="button" onClick={action.onClick} className={className}>{action.label}</button>
                )
              })}
            </>
          )}
        />
      </Card>
    </Page>
  )
}
