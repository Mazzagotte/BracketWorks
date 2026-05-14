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
      case 'scores': return '=�Ļ'
      case 'players': return '=���'
      case 'brackets': return '=���'
      case 'payouts': return '=�Ʀ'
      default: return '=���'
    }
  }, [pageContext])

  const statusInfo = useMemo(() => {
    if (!tournament?.status) return { icon: '', label: '', statusClass: '' }
    
    switch (tournament.status) {
      case 'draft':              return { icon: '=���', label: 'Draft',             statusClass: hdr.statusDraft }
      case 'registration_open': return { icon: '=���', label: 'Registration Open', statusClass: hdr.statusRegistrationOpen }
      case 'in_progress':       return { icon: 'Squad', label: 'In Progress',   statusClass: hdr.statusInProgress }
      case 'completed':         return { icon: '', label: 'Completed',        statusClass: hdr.statusCompleted }
      case 'cancelled':         return { icon: '', label: 'Cancelled',        statusClass: hdr.statusCancelled }
      default:                  return { icon: 'G��', label: 'Unknown',           statusClass: '' }
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
        <div className={`${hdr.skeleton} ${hdr.statsSkeleton}`}></div>
      )
    }
    
    return (
      <div 
        className={`${hdr.statsCard} ${tooltip ? hdr.tooltip : ''}`}
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
          <Link href={crumb.href} className={hdr.breadcrumbLink}>
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
        info: 'G�n+�',
        success: '',
        warning: '',
        error: ''
      }[notification.type] || 'G�n+�'
      
      const priorityLabel = {
        high: 'HIGH',
        medium: 'MED',
        low: 'LOW'
      }[notification.priority || 'low']
      
      return (
        <div 
          key={notification.id} 
          className={`${hdr.notificationItem} ${notification.priority === 'high' ? hdr.priorityHigh : notification.priority === 'medium' ? hdr.priorityMedium : hdr.priorityLow} ${notification.type === 'success' ? hdr.typeSuccess : notification.type === 'error' ? hdr.typeError : notification.type === 'warning' ? hdr.typeWarning : hdr.typeInfo} ${index < visibleNotifications.length - 1 ? hdr.notifItemNotLast : ''}`}>
          <CloseControl
            className={hdr.notificationDismiss}
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
                <div className={hdr.notificationActions}>
                  {notification.actions.map((action, actionIndex) => (
                    <button
                      key={actionIndex}
                      className={`${hdr.notificationActionBtn} ${action.variant === 'primary' ? hdr.notificationActionBtnPrimary : hdr.notificationActionBtnSecondary}`}
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
      <div className={`${hdr.headerContainer} ${isMobile ? hdr.headerContainerMobile : ''} ${isMobile && isHeaderCollapsed ? hdr.headerContainerCollapsed : ''}`}>
      {/* Background Pattern */}
      <div className={hdr.bgPattern} />

      <div className={hdr.innerWrapper}>
        {/* Breadcrumbs */}
        {breadcrumbElements && !isHeaderCollapsed && (
          <nav className={`${hdr.breadcrumbNav} ${isMobile ? `${hdr.mobileTextSm} ${hdr.mobileSpacing}` : ''}`}>
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
                  className={`${hdr.tooltip} ${hdr.loadingSpinner} ${hdr.headerLoadingSpinner}`}
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
                  className={`${hdr.tournamentInfo} ${hdr.tournamentBox} ${isMobile ? hdr.tournamentBoxMobile : ''}`}>
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
                            <span className={hdr.locationPin}>=���</span>
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
                      <div className={hdr.noTournamentIcon}>=���</div>
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
                          {isLoadingPlayers ? 'GŦ Loading...' : 
                           playersCount > 0 ? `=��� ${playersCount} Players` : 
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
                    className={`${hdr.actionsBox} ${isMobile ? hdr.actionsBoxMobile : ''}`}
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
                <div className={hdr.progressBar}>
                  <progress className={hdr.progressMeter} value={Math.round(stats.completionPercentage)} max={100} />
                </div>
              </div>
            )}

            {/* Tournament Stats */}
            {stats && !isHeaderCollapsed && (
              <div className={`${hdr.statsGrid} ${isMobile ? (isVerySmall ? hdr.statsGridVerySmall : hdr.statsGridMobile) : ''} ${isVerySmall ? hdr.mobileGridSingle : ''}`}>
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
                  className={`${hdr.interactiveButton} ${hdr.notifBtn} ${isMobile ? `${hdr.touchTarget} ${hdr.notifBtnMobile}` : ''}`}
                >
                  =���
                  {visibleNotifications.length > 0 && (
                    <span className={`${hdr.notificationBadge} ${hdr.notifBadge} ${
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
                          =��
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
                          <>=��� Generate</>
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
          className={`${hdr.connectionIndicator} ${connectionStatus === 'syncing' ? hdr.connectionPulse : ''} ${hdr.connIndicator} ${connectionStatus === 'online' ? hdr.connOnline : connectionStatus === 'syncing' ? hdr.connSyncing : hdr.connOffline}`}
          title={
            connectionStatus === 'online' ? 'Connected to server' :
            connectionStatus === 'syncing' ? 'Syncing data...' :
            'Connection lost - Check your internet connection'
          }
        >
          {/* Status Icon */}
          <span>
            {connectionStatus === 'online' ? '=���' : 
             connectionStatus === 'syncing' ? '=���' : 
             '=���'}
          </span>
          
          {/* Status Text */}
          <span className={hdr.connText}>
            {connectionStatus}
          </span>
          
          {/* Syncing Animation */}
          {connectionStatus === 'syncing' && (
            <span className={hdr.loadingSpinner}>
              
            </span>
          )}
        </div>
      </div>

      {/* Notification Dropdown */}
      {showNotifications && visibleNotifications.length > 0 && (
        <div 
          className={`${hdr.notificationDropdown} ${hdr.notifDropdown} ${isMobile ? hdr.notifDropdownMobile : ''}`}>
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


