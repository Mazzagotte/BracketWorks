'use client'

import React, { memo, useMemo, useCallback } from 'react'
import Link from 'next/link'
import CloseControl from '../../components/CloseControl'
import hdr from './Header.module.css'




interface TournamentStats {
  totalPlayers?: number
  playersRegistered?: number
  gamesCompleted?: number
  totalGames?: number
  completionPercentage?: number
  prizePool?: number
  perfectGames?: number
}

interface NotificationItem {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: Date
  priority?: 'low' | 'medium' | 'high'
  autoDismiss?: boolean
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }>
}

interface HeaderProps {
  title: string
  subtitle?: string
  tournament?: {
    id?: number
    name?: string
    location?: string
    start_date?: string
    end_date?: string
    status?: 'draft' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled'
  }
  selectedSquad?: {
    id: number
    name: string
    start_time?: string
    time?: string
    date?: string
  }
  showTournamentInfo?: boolean
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
  pageContext?: 'dashboard' | 'scores' | 'players' | 'brackets' | 'payouts'
  stats?: TournamentStats
  notifications?: NotificationItem[]
  connectionStatus?: 'online' | 'offline' | 'syncing'
  lastUpdated?: Date
  isLoading?: boolean
  // Brackets-specific props
  playersCount?: number
  isLoadingPlayers?: boolean
  // Bracket controls
  onGenerateBracket?: () => void
  onRefreshPlayers?: () => void
  viewMode?: 'tree' | 'table'
  onViewModeChange?: (mode: 'tree' | 'table') => void
  isGenerating?: boolean
  hasPreview?: boolean
}

const Header = memo(function Header({ 
  title, 
  subtitle, 
  tournament, 
  selectedSquad, 
  showTournamentInfo = true,
  breadcrumbs,
  actions,
  pageContext,
  stats,
  notifications = [],
  connectionStatus = 'online',
  lastUpdated,
  isLoading = false,
  playersCount = 0,
  isLoadingPlayers = false,
  onGenerateBracket,
  onRefreshPlayers,
  viewMode,
  onViewModeChange,
  isGenerating = false,
  hasPreview = false
}: HeaderProps) {
  const [isMobile, setIsMobile] = React.useState(false)
  const [isVerySmall, setIsVerySmall] = React.useState(false)
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false)
  const [dismissedNotifications, setDismissedNotifications] = React.useState<Set<string>>(new Set())

  // Mobile detection effect with throttling for performance
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout
    
    const checkMobile = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const width = window.innerWidth
        setIsMobile(width <= 480) // Phone only - tablets get desktop experience
        setIsVerySmall(width < 360)
      }, 150) // Throttle resize events
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    return () => {
      window.removeEventListener('resize', checkMobile)
      clearTimeout(timeoutId)
    }
  }, [])

  // Scroll handling for mobile header collapse
  React.useEffect(() => {
    if (!isMobile) return

    let lastScrollY = window.scrollY
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          
          if (currentScrollY > 100) {
            setIsHeaderCollapsed(currentScrollY > lastScrollY)
          } else {
            setIsHeaderCollapsed(false)
          }
          
          lastScrollY = currentScrollY
          ticking = false
        })
        ticking = true
      }
    }

    // Throttled scroll handler
    let throttleTimer: NodeJS.Timeout | null = null
    const throttledScroll = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        handleScroll()
        throttleTimer = null
      }, 16) // ~60fps
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', throttledScroll)
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [isMobile])

  // Memoized values for performance
  const pageIcon = useMemo(() => {
    switch (pageContext) {
      case 'dashboard': return ''
      case 'scores': return '🎯'
      case 'players': return '👥'
      case 'brackets': return '🏆'
      case 'payouts': return '💰'
      default: return '📄'
    }
  }, [pageContext])

  const statusInfo = useMemo(() => {
    if (!tournament?.status) return { icon: '', label: '', statusClass: '' }
    
    switch (tournament.status) {
      case 'draft':              return { icon: '📝', label: 'Draft',             statusClass: hdr.statusDraft }
      case 'registration_open': return { icon: '📝', label: 'Registration Open', statusClass: hdr.statusRegistrationOpen }
      case 'in_progress':       return { icon: 'Squad', label: 'In Progress',   statusClass: hdr.statusInProgress }
      case 'completed':         return { icon: '', label: 'Completed',        statusClass: hdr.statusCompleted }
      case 'cancelled':         return { icon: '', label: 'Cancelled',        statusClass: hdr.statusCancelled }
      default:                  return { icon: '❓', label: 'Unknown',           statusClass: '' }
    }
  }, [tournament?.status])

  const lastUpdatedText = useMemo(() => {
    return lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : null
  }, [lastUpdated])

  // Memoized event handlers
  const handleNotificationToggle = useCallback(() => {
    setShowNotifications(prev => !prev)
  }, [])

  const handleNotificationClose = useCallback(() => {
    setShowNotifications(false)
  }, [])

  const handleDismissNotification = useCallback((notificationId: string) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]))
  }, [])

  // Auto-dismiss notifications
  React.useEffect(() => {
    if (!notifications?.length) return

    const timers: NodeJS.Timeout[] = []

    notifications.forEach(notification => {
      if (notification.autoDismiss && !dismissedNotifications.has(notification.id)) {
        const timer = setTimeout(() => {
          handleDismissNotification(notification.id)
        }, 5000) // Auto-dismiss after 5 seconds
        timers.push(timer)
      }
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [notifications, dismissedNotifications, handleDismissNotification])

  // Filter out dismissed notifications
  const visibleNotifications = useMemo(() => {
    return notifications.filter(notification => !dismissedNotifications.has(notification.id))
      .sort((firstItem, secondItem) => {
        // Sort by priority (high > medium > low) then by timestamp (newest first)
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const aPriority = priorityOrder[firstItem.priority || 'low']
        const bPriority = priorityOrder[secondItem.priority || 'low']
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority
        }
        
        return secondItem.timestamp.getTime() - firstItem.timestamp.getTime()
      })
  }, [notifications, dismissedNotifications])

  // Memoized stats card component
  const renderStatsCard = useCallback(({ 
    value, 
    label, 
    tooltip, 
    isLoading 
  }: { 
    value?: string | number
    label: string
    tooltip?: string
    isLoading?: boolean 
  }) => {
    if (isLoading) {
      return (
        <div className={`skeleton ${hdr.statsSkeleton}`}></div>
      )
    }
    
    return (
      <div 
        className={`stats-card ${tooltip ? 'tooltip' : ''}`}
        data-tooltip={tooltip}>
        <div className={hdr.statsCardValue}>{value}</div>
        <div className={hdr.statsCardLabel}>{label}</div>
      </div>
    )
  }, [])

  // Memoized breadcrumbs
  const breadcrumbElements = useMemo(() => {
    if (!breadcrumbs?.length) return null
    
    return breadcrumbs.map((crumb, index) => (
      <React.Fragment key={`${crumb.label}-${index}`}>
        {crumb.href ? (
          <Link href={crumb.href} className={`breadcrumb-link ${hdr.breadcrumbLink}`}>
            {crumb.label}
          </Link>
        ) : (
          <span className={hdr.breadcrumbCurrent}>{crumb.label}</span>
        )}
        {index < breadcrumbs.length - 1 && <span className={hdr.breadcrumbSep}>/</span>}
      </React.Fragment>
    ))
  }, [breadcrumbs])

  // Memoized notification list with enhanced features
  const notificationElements = useMemo(() => {
    if (!visibleNotifications?.length) return null
    
    return visibleNotifications.map((notification, index) => {
      const typeIcon = {
        info: 'ℹ️',
        success: '',
        warning: '',
        error: ''
      }[notification.type] || 'ℹ️'
      
      const priorityLabel = {
        high: 'HIGH',
        medium: 'MED',
        low: 'LOW'
      }[notification.priority || 'low']
      
      return (
        <div 
          key={notification.id} 
          className={`notification-item priority-${notification.priority || 'low'} type-${notification.type} ${index < visibleNotifications.length - 1 ? hdr.notifItemNotLast : ''}`}>
          <CloseControl
            className="notification-dismiss"
            onClick={() => handleDismissNotification(notification.id)}
            label="Dismiss notification"
            size="xs"
            title="Dismiss"
          />
          
          <div className={hdr.notifRow}>
            <span>{typeIcon}</span>
            <div className={hdr.notifContent}>
              <div className={hdr.notifMeta}>
                {notification.priority && notification.priority !== 'low' && (
                  <span className={`${hdr.notifPriorityBadge} ${notification.priority === 'high' ? hdr.notifPriorityHigh : hdr.notifPriorityMedium}`}>
                    {priorityLabel}
                  </span>
                )}
                <span className={hdr.notifTimestamp}>
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className={hdr.notifMessage}>
                {notification.message}
              </div>
              
              {notification.actions && notification.actions.length > 0 && (
                <div className="notification-actions">
                  {notification.actions.map((action, actionIndex) => (
                    <button
                      key={actionIndex}
                      className={`notification-action-btn ${action.variant || 'secondary'}`}
                      onClick={() => {
                        action.onClick()
                        handleDismissNotification(notification.id)
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    })
  }, [visibleNotifications, handleDismissNotification])

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        @keyframes slideDown {
          from { 
            opacity: 0; 
            transform: translateY(-10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes fadeInScale {
          from { 
            opacity: 0; 
            transform: scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: scale(1); 
          }
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
          40%, 43% { transform: translate3d(0,-8px,0); }
          70% { transform: translate3d(0,-4px,0); }
          90% { transform: translate3d(0,-2px,0); }
        }
        
        .header-container {
          background: var(--color-background);
          color: var(--color-text-primary);
          padding: ${isMobile ? (isHeaderCollapsed ? '0.75rem 1rem' : '1.5rem 1rem') : '2rem'};
          border-radius: 0 0 16px 16px;
          margin: 0 auto 2rem;
          max-width: 1200px;
          box-shadow: var(--shadow-md);
          border: 1px solid var(--color-border);
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: ${isMobile && isHeaderCollapsed ? 'translateY(-10px)' : 'translateY(0)'};
          animation: slideDown 0.5s ease-out;
        }
        
        .header-container:hover {
          box-shadow: var(--shadow-card-hover);
          transform: ${isMobile && isHeaderCollapsed ? 'translateY(-12px)' : 'translateY(-2px)'};
        }

        .header-container nav {
          background: var(--color-background);
        }
        
        .interactive-button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .interactive-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        
        .interactive-button:active {
          transform: translateY(0);
          box-shadow: var(--shadow-sm);
        }
        
        .notification-badge {
          animation: bounce 2s infinite;
        }
        
        .stats-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .stats-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: var(--shadow-card-hover);
        }
        
        .progress-bar {
          overflow: hidden;
          position: relative;
          width: 100%;
          height: 10px;
          background-color: var(--color-border);
          border-radius: 5px;
        }
        
        .progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, 
            transparent, 
            var(--color-brand-ivory-light), 
            transparent
          );
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .tournament-info {
          animation: fadeInScale 0.6s ease-out 0.2s both;
        }
        
        .breadcrumb-link:hover {
          color: var(--color-primary) !important;
          text-decoration: underline !important;
        }
        
        /* Enhanced Responsive Design */
        @media (max-width: 480px) {
          .mobile-stack {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          
          .touch-target {
            min-height: 44px;
            min-width: 44px;
            padding: 12px;
          }
          
          .mobile-hidden {
            display: none;
          }
          
          .mobile-text-sm {
            font-size: 0.875rem;
          }
          
          .mobile-spacing {
            margin: 0.5rem 0;
          }
        }
        
        @media (max-width: 480px) {
          .mobile-mini {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
          }
          
          .mobile-grid-single {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (min-width: 769px) {
          .desktop-only {
            display: block;
          }
        }
        
        /* Touch-friendly interactions */
        @media (hover: none) and (pointer: coarse) {
          .stats-card:hover {
            transform: none;
            box-shadow: var(--shadow-sm);
          }
          
          .interactive-button:hover {
            transform: none;
          }
          
          .interactive-button:active {
            transform: scale(0.95);
          }
        }
        
        /* Enhanced Visual Feedback */
        .skeleton {
          background: var(--gradient-gray);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
        }
        
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .success-indicator {
          border-left: 4px solid var(--color-success);
          background: var(--color-hc-success-bg);
          transition: all 0.3s ease;
        }
        
        .warning-indicator {
          border-left: 4px solid var(--color-warning-amber);
          background: var(--color-yellow-light);
          transition: all 0.3s ease;
        }
        
        .error-indicator {
          border-left: 4px solid var(--color-error);
          background: var(--color-hc-error-bg);
          transition: all 0.3s ease;
        }
        
        .connection-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 0.5rem;
        }
        
        .status-online { background-color: var(--color-success); }
        .status-offline { background-color: var(--color-error); }
        .status-syncing { 
          background-color: var(--color-warning-amber);
          animation: pulse 1s ease-in-out infinite alternate;
        }
        
        .loading-spinner {
          animation: spin 1s linear infinite;
          display: inline-block;
        }

        .connection-indicator {
          opacity: 0.9;
          transform: scale(0.95);
        }
        
        .connection-indicator:hover {
          opacity: 1;
          transform: scale(1);
          box-shadow: var(--shadow-md);
        }
        
        .connection-indicator.connection-pulse {
          animation: connectionPulse 2s ease-in-out infinite;
        }
        
        @keyframes connectionPulse {
          0%, 100% { 
            opacity: 0.9;
            box-shadow: var(--shadow-sm);
          }
          50% { 
            opacity: 1;
            box-shadow: var(--shadow-brand-glow);
          }
        }
        
        .tooltip {
          position: relative;
          cursor: help;
        }
        
        .tooltip::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-dark-base);
          color: var(--color-white);
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 1000;
        }
        
        .tooltip:hover::after {
          opacity: 1;
        }
        
        /* Enhanced Notification Styles */
        .notification-dropdown {
          animation: slideDown 0.3s ease-out;
        }
        
        .notification-item {
          transition: all 0.2s ease;
          border-left: 4px solid transparent;
        }
        
        .notification-item:hover {
          background-color: var(--color-gray-50);
          transform: translateX(2px);
        }
        
        .notification-item.priority-high {
          border-left-color: var(--color-error);
          background-color: var(--color-hc-error-bg);
        }
        
        .notification-item.priority-medium {
          border-left-color: var(--color-warning-amber);
          background-color: var(--color-yellow-light);
        }
        
        .notification-item.priority-low {
          border-left-color: var(--color-blue-primary);
          background-color: var(--color-blue-light);
        }
        
        .notification-item.type-success {
          border-left-color: var(--color-success);
          background-color: var(--color-hc-success-bg);
        }
        
        .notification-item.type-error {
          border-left-color: var(--color-error);
          background-color: var(--color-hc-error-bg);
        }
        
        .notification-item.type-warning {
          border-left-color: var(--color-warning-amber);
          background-color: var(--color-yellow-light);
        }
        
        .notification-item.type-info {
          border-left-color: var(--color-blue-primary);
          background-color: var(--color-blue-light);
        }
        
        .notification-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        
        .notification-action-btn {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        
        .notification-action-btn.primary {
          background-color: var(--color-primary);
          color: var(--color-white);
        }
        
        .notification-action-btn.primary:hover {
          background-color: var(--color-primary-hover);
        }
        
        .notification-action-btn.secondary {
          background-color: var(--color-gray-100);
          color: var(--color-gray-700);
        }
        
        .notification-action-btn.secondary:hover {
          background-color: var(--color-gray-200);
        }
        
        .notification-dismiss {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0;
        }
      `}</style>
      
      <div className="header-container">
      {/* Background Pattern */}
      <div className={hdr.bgPattern} />

      <div className={hdr.innerWrapper}>
        {/* Breadcrumbs */}
        {breadcrumbElements && !isHeaderCollapsed && (
          <nav className={`${hdr.breadcrumbNav} ${isMobile ? 'mobile-text-sm mobile-spacing' : ''}`}>
            {breadcrumbElements}
          </nav>
        )}

        {/* Main Header Content */}
        <div className={`${hdr.mainRow} ${isMobile && !isHeaderCollapsed ? hdr.mainRowMobile : ''}`}>
          {/* Left Section - Title and Info */}
          <div className={hdr.leftSection}>
            {/* Title Section */}
            <div className={`${hdr.titleRow} ${isHeaderCollapsed ? hdr.titleRowCollapsed : ''}`}>
              {pageIcon && (
                <span className={isMobile ? hdr.pageIconMobile : hdr.pageIcon}>
                  {pageIcon}
                </span>
              )}
              <h1 className={`${hdr.h1} ${isMobile ? (isHeaderCollapsed ? hdr.h1MobileCollapsed : hdr.h1Mobile) : ''}`}>
                {title}
              </h1>
              
              {isLoading && (
                <div 
                  className={`tooltip loading-spinner ${hdr.headerLoadingSpinner}`}
                  data-tooltip="Loading...">
                </div>
              )}
            </div>

            {/* Subtitle */}
            {subtitle && !isHeaderCollapsed && (
              <p className={`${hdr.subtitle} ${isMobile ? hdr.subtitleMobile : ''}`}>
                {subtitle}
              </p>
            )}

            {/* Tournament Info & Actions Section */}
            {showTournamentInfo && !isHeaderCollapsed && (
              <div className={`${hdr.tournamentSection} ${isMobile ? hdr.tournamentSectionMobile : ''}`}>
                {/* Tournament Info Box */}
                <div 
                  className={`tournament-info ${hdr.tournamentBox} ${isMobile ? hdr.tournamentBoxMobile : ''}`}>
                {tournament ? (
                  <>
                    {/* Tournament Header */}
                    <div className={hdr.tournamentHeader}>
                      {/* Tournament Name and Location */}
                      <div className={hdr.tournamentNameCol}>
                        <h3 className={`${hdr.tournamentName} ${isMobile ? hdr.tournamentNameMobile : ''}`}>
                          {tournament.name}
                        </h3>
                        {tournament.location && (
                          <div className={hdr.locationRow}>
                            <span className={hdr.locationPin}>📍</span>
                            <span className={hdr.locationText}>{tournament.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Tournament Status Badge */}
                      {tournament.status && (
                        <div className={`${hdr.statusBadge} ${statusInfo.statusClass}`}>
                          <span>{statusInfo.icon}</span>
                          {statusInfo.label}
                        </div>
                      )}
                    </div>

                    {/* Tournament Dates */}
                    {(tournament.start_date || tournament.end_date) && (
                      <div className={`${hdr.datesSection} ${isMobile ? hdr.datesSectionMobile : ''}`}>
                        {tournament.start_date && (
                          <div className={hdr.dateItem}>
                            <span className={hdr.dateLabel}>Start Date</span>
                            <span className={hdr.dateValue}>{new Date(tournament.start_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {tournament.end_date && (
                          <div className={hdr.dateItem}>
                            <span className={hdr.dateLabel}>End Date</span>
                            <span className={hdr.dateValue}>{new Date(tournament.end_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Loading/No Tournament State */
                  <div className={hdr.noTournament}>
                    <div className={hdr.noTournamentInner}>
                      <div className={hdr.noTournamentIcon}>🏆</div>
                      <div>No tournament loaded</div>
                    </div>
                  </div>
                )}

                {/* Bottom Section - Always reserve space for consistent sizing */}
                <div className={`${hdr.bottomSection} ${(selectedSquad || (pageContext === 'brackets' || pageContext === 'players' || pageContext === 'scores')) ? hdr.bottomSectionWithContent : ''}`}>
                  {/* Squad and Players Info */}
                  {(pageContext === 'brackets' || pageContext === 'dashboard' || pageContext === 'players' || pageContext === 'scores') && (
                    <div className={hdr.squadRow}>
                      {/* Selected Squad Badge */}
                      {selectedSquad && (
                        <div className={hdr.squadBadge}>
                          <span className={hdr.squadLabel}>Squad:</span>
                          <span className={hdr.squadTime}>{selectedSquad.time}</span>
                        </div>
                      )}

                      {/* Players Count - Only show on pages that manage players */}
                      {(pageContext === 'brackets' || pageContext === 'players' || pageContext === 'scores') && (
                        <div className={`${hdr.playersBadge} ${playersCount > 0 ? hdr.playersBadgeHas : hdr.playersBadgeNone}`}>
                          {isLoadingPlayers ? '⏳ Loading...' : 
                           playersCount > 0 ? `👥 ${playersCount} Players` : 
                           'No Players'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>

                {/* Actions Box */}
                {actions && (
                  <div 
                    className={`actions-box ${hdr.actionsBox} ${isMobile ? hdr.actionsBoxMobile : ''}`}
                  >
                    <div className={hdr.actionsLabel}>Quick Actions</div>
                    <div className={hdr.actionsInner}>
                      {actions}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tournament Progress - Separate section for consistent sizing */}
            {showTournamentInfo && stats?.completionPercentage !== undefined && !isHeaderCollapsed && (
              <div className={`${hdr.progressSection} ${isMobile ? hdr.progressSectionMobile : ''}`}>
                <div className={hdr.progressHeader}>
                  <span className={hdr.progressLabel}>Tournament Progress</span>
                  <span className={hdr.progressValue}>{Math.round(stats.completionPercentage)}%</span>
                </div>
                <div 
                  className="progress-bar"
                >
                  <div
                    className={hdr.progressFill}
                    style={{ width: `${stats.completionPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tournament Stats */}
            {stats && !isHeaderCollapsed && (
              <div className={`${hdr.statsGrid} ${isMobile ? (isVerySmall ? hdr.statsGridVerySmall : hdr.statsGridMobile) : ''} ${isVerySmall ? 'mobile-grid-single' : ''}`}>
                {stats?.totalPlayers && renderStatsCard({
                  value: `${stats.playersRegistered || 0}/${stats.totalPlayers}`,
                  label: "Players",
                  tooltip: `${stats.playersRegistered || 0} of ${stats.totalPlayers} players registered`,
                  isLoading
                })}
                
                {stats?.gamesCompleted !== undefined && stats?.totalGames && renderStatsCard({
                  value: `${stats.gamesCompleted}/${stats.totalGames}`,
                  label: "Games",
                  tooltip: `${stats.gamesCompleted} of ${stats.totalGames} games completed`,
                  isLoading
                })}
                
                {stats?.prizePool && renderStatsCard({
                  value: `$${stats.prizePool.toLocaleString()}`,
                  label: "Prize Pool",
                  tooltip: `Total prize pool: $${stats.prizePool.toLocaleString()}`,
                  isLoading
                })}
                
                {stats?.perfectGames !== undefined && renderStatsCard({
                  value: stats.perfectGames,
                  label: "Perfect Games",
                  tooltip: `${stats.perfectGames} perfect games bowled`,
                  isLoading
                })}
              </div>
            )}
          </div>

          {/* Right Section - Actions and Status */}
          <div className={`${hdr.rightSection} ${isMobile ? hdr.rightSectionMobile : ''}`}>
            {/* Notifications */}
            {visibleNotifications.length > 0 && (
              <div className={hdr.notifBtnWrap}>
                <button
                  onClick={handleNotificationToggle}
                  className={`interactive-button ${hdr.notifBtn} ${isMobile ? `touch-target ${hdr.notifBtnMobile}` : ''}`}
                >
                  🔔
                  {visibleNotifications.length > 0 && (
                    <span className={`notification-badge ${hdr.notifBadge} ${
                      visibleNotifications.some(n => n.priority === 'high') ? hdr.notifBadgeHigh :
                      visibleNotifications.some(n => n.priority === 'medium') ? hdr.notifBadgeMedium : hdr.notifBadgeLow
                    }`}>
                      {visibleNotifications.length > 9 ? '9+' : visibleNotifications.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Actions */}
            {(actions || (pageContext === 'brackets' && (onGenerateBracket || onRefreshPlayers || onViewModeChange))) && !isHeaderCollapsed && (
              <div className={hdr.bracketControls}>
                {/* Bracket-specific controls */}
                {pageContext === 'brackets' && (
                  <>
                    {/* View Mode Selector */}
                    {onViewModeChange && (
                      <div className={hdr.vmBtnGroup}>
                        <button
                          onClick={() => onViewModeChange('tree')}
                          className={`${hdr.vmBtn} ${hdr.vmBtnLeft} ${viewMode === 'tree' ? hdr.vmBtnActive : hdr.vmBtnInactive}`}
                        >
                          🌳
                        </button>
                        <button
                          onClick={() => onViewModeChange('table')}
                          className={`${hdr.vmBtn} ${hdr.vmBtnRight} ${viewMode === 'table' ? hdr.vmBtnActive : hdr.vmBtnInactive}`}
                        >
                          
                        </button>
                      </div>
                    )}

                    {/* Refresh Players */}
                    {onRefreshPlayers && tournament && (
                      <button
                        onClick={onRefreshPlayers}
                        disabled={isLoadingPlayers}
                        className={`${hdr.refreshBtn} ${isLoadingPlayers ? hdr.refreshBtnDisabled : ''}`}
                      >
                        {isLoadingPlayers ? (
                          <><span className={hdr.refreshSpinner}></span>Loading</>
                        ) : (
                          <>Refresh</>
                        )}
                      </button>
                    )}

                    {/* Generate Bracket */}
                    {onGenerateBracket && (
                      <button
                        onClick={onGenerateBracket}
                        disabled={isGenerating || !tournament || playersCount === 0}
                        className={`${hdr.generateBtn} ${hasPreview ? hdr.generateBtnPreview : ''} ${(isGenerating || !tournament || playersCount === 0) ? hdr.generateBtnDisabled : ''}`}
                      >
                        {isGenerating ? (
                          <><span className={hdr.generateSpinner}></span>Generating...</>
                        ) : hasPreview ? (
                          <>Regenerate</>
                        ) : (
                          <>🏆 Generate</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Status Info */}
            <div className={`${hdr.statusInfo} ${isMobile ? hdr.statusInfoMobile : ''}`}>
              {/* Last Updated */}
              {lastUpdatedText && (
                <span>
                  Updated {lastUpdatedText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Connection Status Indicator - Bottom Right */}
        <div 
          className={`connection-indicator ${connectionStatus === 'syncing' ? 'connection-pulse' : ''} ${hdr.connIndicator} ${connectionStatus === 'online' ? hdr.connOnline : connectionStatus === 'syncing' ? hdr.connSyncing : hdr.connOffline}`}
          title={
            connectionStatus === 'online' ? 'Connected to server' :
            connectionStatus === 'syncing' ? 'Syncing data...' :
            'Connection lost - Check your internet connection'
          }
        >
          {/* Status Icon */}
          <span>
            {connectionStatus === 'online' ? '🟢' : 
             connectionStatus === 'syncing' ? '🟡' : 
             '🔴'}
          </span>
          
          {/* Status Text */}
          <span className={hdr.connText}>
            {connectionStatus}
          </span>
          
          {/* Syncing Animation */}
          {connectionStatus === 'syncing' && (
            <span className="loading-spinner">
              
            </span>
          )}
        </div>
      </div>

      {/* Notification Dropdown */}
      {showNotifications && visibleNotifications.length > 0 && (
        <div 
          className={`notification-dropdown ${hdr.notifDropdown} ${isMobile ? hdr.notifDropdownMobile : ''}`}>
          <div className={hdr.notifDropdownHeader}>
            <div className={hdr.notifDropdownTitleRow}>
              <h3 className={hdr.notifDropdownTitle}>
                Notifications ({visibleNotifications.length})
              </h3>
              <CloseControl onClick={handleNotificationClose} label="Close notifications" size="sm" />
            </div>
            
            {visibleNotifications.length > 1 && (
              <button
                onClick={() => {
                  visibleNotifications.forEach(notification => {
                    handleDismissNotification(notification.id)
                  })
                }}
                className={hdr.clearAllBtn}
              >
                Clear All
              </button>
            )}
          </div>
          <div className={hdr.notifList}>
            {notificationElements}
          </div>
        </div>
      )}
    </div>
    </>
  )
})

Header.displayName = 'Header'

export default Header


