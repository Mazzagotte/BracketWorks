'use client'

import React, { memo, useMemo, useCallback } from 'react'
import Link from 'next/link'




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
    if (!tournament?.status) return { icon: '', label: '', bg: '', color: '' }
    
    switch (tournament.status) {
      case 'draft':
        return { icon: '📝', label: 'Draft', bg: 'var(--color-gray-100)', color: 'var(--color-gray-700)' }
      case 'registration_open':
        return { icon: '📝', label: 'Registration Open', bg: 'var(--color-blue-light)', color: 'var(--color-blue-deeper)' }
      case 'in_progress':
        return { icon: 'Squad', label: 'In Progress', bg: 'var(--color-yellow-light)', color: 'var(--color-warning-text-deep)' }
      case 'completed':
        return { icon: '', label: 'Completed', bg: 'var(--color-green-light)', color: 'var(--color-success-text-deep)' }
      case 'cancelled':
        return { icon: '', label: 'Cancelled', bg: 'var(--color-hc-error-bg)', color: 'var(--color-red-dark)' }
      default:
        return { icon: '❓', label: 'Unknown', bg: 'var(--color-gray-100)', color: 'var(--color-text-secondary)' }
    }
  }, [tournament?.status])

  const connectionStyles = useMemo(() => ({
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
      backgroundColor: connectionStatus === 'online' ? 'var(--color-hc-success-bg)' : 
           connectionStatus === 'syncing' ? 'var(--color-yellow-light)' : 'var(--color-hc-error-bg)',
      color: connectionStatus === 'online' ? 'var(--color-success-text-deep)' : 
        connectionStatus === 'syncing' ? 'var(--color-warning-text-deep)' : 'var(--color-error-text-deep)'
  }), [connectionStatus])

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
        <div 
          className="skeleton"
          style={{ 
            height: '60px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)'
          }}>
        </div>
      )
    }
    
    return (
      <div 
        className={`stats-card ${tooltip ? 'tooltip' : ''}`}
        data-tooltip={tooltip}
        style={{ 
          textAlign: 'center',
          background: 'var(--color-surface)',
          padding: '0.5rem',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-soft)',
          cursor: 'pointer'
        }}>
        <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
          {value}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{label}</div>
      </div>
    )
  }, [])

  // Memoized breadcrumbs
  const breadcrumbElements = useMemo(() => {
    if (!breadcrumbs?.length) return null
    
    return breadcrumbs.map((crumb, index) => (
      <React.Fragment key={`${crumb.label}-${index}`}>
        {crumb.href ? (
          <Link href={crumb.href} className="breadcrumb-link" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
            {crumb.label}
          </Link>
        ) : (
          <span style={{ color: 'var(--color-text-primary)' }}>{crumb.label}</span>
        )}
        {index < breadcrumbs.length - 1 && <span style={{ margin: '0 0.5rem', color: 'var(--color-text-secondary)' }}>/</span>}
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
          className={`notification-item priority-${notification.priority || 'low'} type-${notification.type}`}
          style={{ 
            padding: '1rem',
            borderBottom: index < visibleNotifications.length - 1 ? '1px solid var(--color-gray-100)' : 'none',
            position: 'relative'
          }}>
          <button
            className="notification-dismiss"
            onClick={() => handleDismissNotification(notification.id)}
            title="Dismiss"
          >
            ×
          </button>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>{typeIcon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                {notification.priority && notification.priority !== 'low' && (
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: '700',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    backgroundColor: notification.priority === 'high' ? 'var(--color-error)' : 'var(--color-warning-amber)',
                    color: 'var(--color-white)',
                    textTransform: 'uppercase'
                  }}>
                    {priorityLabel}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>

              <div style={{
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                lineHeight: '1.4'
              }}>
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
          background: none;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: 1rem;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }
        
        .notification-dismiss:hover {
          background-color: var(--color-gray-100);
          color: var(--color-gray-700);
        }
      `}</style>
      
      <div className="header-container">
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23475569' fill-opacity='0.4'%3E%3Ccircle cx='7' cy='7' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        borderRadius: '0 0 16px 16px'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Breadcrumbs */}
        {breadcrumbElements && !isHeaderCollapsed && (
          <nav className={isMobile ? "mobile-text-sm mobile-spacing" : ""} style={{ marginBottom: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
            {breadcrumbElements}
          </nav>
        )}

        {/* Main Header Content */}
        <div className={isMobile && !isHeaderCollapsed ? "mobile-stack" : ""} style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'center' : 'flex-start',
          flexDirection: isMobile && !isHeaderCollapsed ? 'column' : 'row',
          gap: isMobile ? '1rem' : '2rem'
        }}>
          {/* Left Section - Title and Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title Section */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: isHeaderCollapsed ? 0 : '0.5rem'
            }}>
              {pageIcon && (
                <span style={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>
                  {pageIcon}
                </span>
              )}
              <h1 style={{ 
                margin: 0, 
                fontSize: isMobile ? (isHeaderCollapsed ? '1.25rem' : '1.75rem') : '2.25rem',
                fontWeight: '700',
                color: 'var(--color-text-primary)',
                wordBreak: 'break-word',
                textAlign: 'center'
              }}>
                {title}
              </h1>
              
              {isLoading && (
                <div 
                  className="tooltip loading-spinner"
                  data-tooltip="Loading..."
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--color-border)',
                    borderTop: '2px solid var(--color-text-primary)',
                    borderRadius: '50%'
                  }}>
                </div>
              )}
            </div>

            {/* Subtitle */}
            {subtitle && !isHeaderCollapsed && (
              <p style={{ 
                margin: '0 0 1rem 0', 
                fontSize: isMobile ? '1rem' : '1.125rem', 
                color: 'var(--color-text-secondary)',
                fontWeight: '400',
                textAlign: 'center'
              }}>
                {subtitle}
              </p>
            )}

            {/* Tournament Info & Actions Section */}
            {showTournamentInfo && !isHeaderCollapsed && (
              <div style={{
                display: 'flex',
                gap: '1rem',
                marginTop: '1rem',
                alignItems: 'flex-start',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'center',
                maxWidth: '1200px',
                margin: '1rem auto 0',
                width: '100%'
              }}>
                {/* Tournament Info Box */}
                <div 
                  className="tournament-info"
                  style={{ 
                    background: 'var(--color-surface)',
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-soft)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: isMobile ? '1' : 'none',
                    maxWidth: isMobile ? '100%' : '500px',
                    width: isMobile ? '100%' : 'fit-content'
                  }}>
                {tournament ? (
                  <>
                    {/* Tournament Header */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1.25rem',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      {/* Tournament Name and Location */}
                      <div style={{ flex: 1, minWidth: '250px' }}>
                        <h3 style={{ 
                          margin: '0 0 0.5rem 0', 
                          fontSize: isMobile ? '1.125rem' : '1.375rem',
                          fontWeight: '700',
                          color: 'var(--color-text-primary)',
                          lineHeight: '1.2',
                          textAlign: 'center'
                        }}>
                          {tournament.name}
                        </h3>
                        {tournament.location && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.95rem'
                          }}>
                            <span style={{ color: 'var(--color-error)' }}>📍</span>
                            <span style={{ fontWeight: '500' }}>{tournament.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Tournament Status Badge */}
                      {tournament.status && (
                        <div style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.color,
                          border: '1px solid var(--color-border-light)',
                          whiteSpace: 'nowrap'
                        }}>
                          <span>{statusInfo.icon}</span>
                          {statusInfo.label}
                        </div>
                      )}
                    </div>

                    {/* Tournament Dates */}
                    {(tournament.start_date || tournament.end_date) && (
                      <div style={{ 
                        display: 'flex',
                        gap: isMobile ? '1rem' : '2rem',
                        marginBottom: '1.25rem',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                        flexWrap: 'wrap',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-gray-50)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)'
                      }}>
                        {tournament.start_date && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '600', color: 'var(--color-gray-700)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</span>
                            <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{new Date(tournament.start_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {tournament.end_date && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '600', color: 'var(--color-gray-700)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</span>
                            <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{new Date(tournament.end_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Loading/No Tournament State */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '80px',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.95rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>🏆</div>
                      <div>No tournament loaded</div>
                    </div>
                  </div>
                )}

                {/* Bottom Section - Always reserve space for consistent sizing */}
                <div style={{ 
                  marginTop: 'auto',
                  paddingTop: (selectedSquad || (pageContext === 'brackets' || pageContext === 'players' || pageContext === 'scores')) ? '0.75rem' : '0'
                }}>
                  {/* Squad and Players Info */}
                  {(pageContext === 'brackets' || pageContext === 'dashboard' || pageContext === 'players' || pageContext === 'scores') && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      minHeight: '40px' // Reserve consistent space
                    }}>
                      {/* Selected Squad Badge */}
                      {selectedSquad && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: 'var(--gradient-blue-light)',
                          padding: '0.625rem 1rem',
                          borderRadius: '24px',
                          border: '1px solid var(--color-blue-primary)',
                          boxShadow: 'var(--shadow-blue-sm)'
                        }}>
                          <span style={{ 
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: 'var(--color-blue-deeper)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.025em'
                          }}>Squad:</span>
                          <span style={{ 
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            color: 'var(--color-blue-deeper)'
                          }}>
                            {selectedSquad.time}
                          </span>
                        </div>
                      )}

                      {/* Players Count - Only show on pages that manage players */}
                      {(pageContext === 'brackets' || pageContext === 'players' || pageContext === 'scores') && (
                        <div style={{
                          padding: '0.625rem 1rem',
                          background: playersCount > 0 ? 'var(--color-green-light)' : 'var(--color-yellow-light)',
                          border: `1px solid ${playersCount > 0 ? 'var(--color-success)' : 'var(--color-warning-amber)'}`,
                          borderRadius: '24px',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          color: playersCount > 0 ? 'var(--color-green-dark)' : 'var(--color-warning-text-deep)',
                          minWidth: '130px',
                          textAlign: 'center',
                          boxShadow: playersCount > 0 ? 'var(--shadow-green-sm)' : 'var(--shadow-brand-sm)'
                        }}>
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
                    className="actions-box"
                    style={{
                      background: 'var(--color-surface)',
                      padding: isMobile ? '1rem' : '1.5rem',
                      borderRadius: '16px',
                      boxShadow: 'var(--shadow-soft)',
                      border: '1px solid var(--color-border)',
                      minHeight: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      minWidth: isMobile ? '100%' : '200px',
                      maxWidth: isMobile ? '100%' : '300px'
                    }}
                  >
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.025em',
                      marginBottom: '0.5rem'
                    }}>
                      Quick Actions
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {actions}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tournament Progress - Separate section for consistent sizing */}
            {showTournamentInfo && stats?.completionPercentage !== undefined && !isHeaderCollapsed && (
              <div style={{ 
                background: 'var(--color-surface)',
                padding: isMobile ? '1rem' : '1.5rem',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-soft)',
                border: '1px solid var(--color-border)',
                marginTop: '1rem',
                maxWidth: isMobile ? '100%' : '600px',
                width: 'fit-content'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{ 
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em'
                  }}>Tournament Progress</span>
                  <span style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '700',
                    color: 'var(--color-text-primary)'
                  }}>
                    {Math.round(stats.completionPercentage)}%
                  </span>
                </div>
                <div 
                  className="progress-bar"
                  style={{ 
                    width: '100%', 
                    height: '10px', 
                    backgroundColor: 'var(--color-border)', 
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                  <div style={{ 
                    height: '100%', 
                    background: 'var(--gradient-green-progress)',
                    width: `${stats.completionPercentage}%`,
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    borderRadius: '5px',
                    boxShadow: 'var(--shadow-inset)'
                  }} />
                </div>
              </div>
            )}

            {/* Tournament Stats */}
            {stats && !isHeaderCollapsed && (
              <div className={isVerySmall ? "mobile-grid-single" : ""} style={{ 
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: isMobile ? (isVerySmall ? '1fr' : '1fr 1fr') : 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.75rem',
                maxWidth: isMobile ? '100%' : '600px'
              }}>
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
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem',
            flexDirection: isMobile ? 'row' : 'column',
            alignSelf: isMobile ? 'stretch' : 'flex-start'
          }}>
            {/* Notifications */}
            {visibleNotifications.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={handleNotificationToggle}
                  className={`interactive-button ${isMobile ? 'touch-target' : ''}`}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '50%',
                    width: isMobile ? '48px' : '40px',
                    height: isMobile ? '48px' : '40px',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  🔔
                  {visibleNotifications.length > 0 && (
                    <span 
                      className="notification-badge"
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        background: visibleNotifications.some(nItem => nItem.priority === 'high') ? 'var(--color-error)' :
                                   visibleNotifications.some(nItem => nItem.priority === 'medium') ? 'var(--color-warning-amber)' : 'var(--color-blue-primary)',
                        color: 'var(--color-white)',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                      {visibleNotifications.length > 9 ? '9+' : visibleNotifications.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Actions */}
            {(actions || (pageContext === 'brackets' && (onGenerateBracket || onRefreshPlayers || onViewModeChange))) && !isHeaderCollapsed && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Bracket-specific controls */}
                {pageContext === 'brackets' && (
                  <>
                    {/* View Mode Selector */}
                    {onViewModeChange && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => onViewModeChange('tree')}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px 0 0 6px',
                            backgroundColor: viewMode === 'tree' ? 'var(--color-primary)' : 'var(--color-gray-50)',
                            color: viewMode === 'tree' ? 'var(--color-white)' : 'var(--color-gray-700)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🌳
                        </button>
                        <button
                          onClick={() => onViewModeChange('table')}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: '0 6px 6px 0',
                            backgroundColor: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-gray-50)',
                            color: viewMode === 'table' ? 'var(--color-white)' : 'var(--color-gray-700)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          
                        </button>
                      </div>
                    )}

                    {/* Refresh Players */}
                    {onRefreshPlayers && tournament && (
                      <button
                        onClick={onRefreshPlayers}
                        disabled={isLoadingPlayers}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          backgroundColor: 'var(--color-gray-100)',
                          color: 'var(--color-gray-700)',
                          border: '1px solid var(--color-gray-300)',
                          borderRadius: '6px',
                          cursor: isLoadingPlayers ? 'not-allowed' : 'pointer',
                          opacity: isLoadingPlayers ? 0.6 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isLoadingPlayers ? (
                          <>
                            <span style={{ 
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              border: '1px solid var(--color-gray-300)',
                              borderTop: '1px solid var(--color-gray-700)',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}></span>
                            Loading
                          </>
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
                        style={{
                          padding: '6px 16px',
                          fontSize: '0.75rem',
                          backgroundColor: hasPreview ? 'var(--color-green-dark)' : 'var(--color-primary)',
                          color: 'var(--color-white)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: (isGenerating || !tournament || playersCount === 0) ? 'not-allowed' : 'pointer',
                          opacity: (isGenerating || !tournament || playersCount === 0) ? 0.6 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: '500'
                        }}
                      >
                        {isGenerating ? (
                          <>
                            <span style={{ 
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              border: '2px solid var(--color-border-light)',
                              borderTop: '2px solid var(--color-white)',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}></span>
                            Generating...
                          </>
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
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'row' : 'column',
              alignItems: isMobile ? 'center' : 'flex-end',
              gap: '0.5rem',
              fontSize: '0.75rem',
              opacity: 0.9
            }}>
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
          className={`connection-indicator ${connectionStatus === 'syncing' ? 'connection-pulse' : ''}`}
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '500',
            zIndex: 10,
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--color-border-light)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            background: connectionStatus === 'online' 
              ? 'var(--gradient-success-btn)' 
              : connectionStatus === 'syncing'
              ? 'var(--gradient-warning-base)'
              : 'var(--gradient-error-btn)',
            color: 'var(--color-white)'
          }}
          title={
            connectionStatus === 'online' ? 'Connected to server' :
            connectionStatus === 'syncing' ? 'Syncing data...' :
            'Connection lost - Check your internet connection'
          }
        >
          {/* Status Icon */}
          <span style={{ fontSize: '0.875rem' }}>
            {connectionStatus === 'online' ? '🟢' : 
             connectionStatus === 'syncing' ? '🟡' : 
             '🔴'}
          </span>
          
          {/* Status Text */}
          <span style={{ 
            textTransform: 'capitalize'
          }}>
            {connectionStatus}
          </span>
          
          {/* Syncing Animation */}
          {connectionStatus === 'syncing' && (
            <span 
              className="loading-spinner" 
              style={{ 
                fontSize: '0.75rem'
              }}
            >
              
            </span>
          )}
        </div>
      </div>

      {/* Notification Dropdown */}
      {showNotifications && visibleNotifications.length > 0 && (
        <div 
          className="notification-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: isMobile ? '1rem' : '2rem',
            marginTop: '0.5rem',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-modal)',
            border: '1px solid var(--color-border)',
            zIndex: 1000,
            minWidth: '350px',
            maxWidth: isMobile ? '90vw' : '450px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-gray-100)', background: 'var(--color-gray-50)' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <h3 style={{ margin: '0', fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                Notifications ({visibleNotifications.length})
              </h3>
              <button
                onClick={handleNotificationClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  padding: '0.25rem',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'var(--color-gray-100)'
                  changeEvent.currentTarget.style.color = 'var(--color-gray-700)'
                }}
                onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent'
                  changeEvent.currentTarget.style.color = 'var(--color-text-secondary)'
                }}
              >
                ×
              </button>
            </div>
            
            {visibleNotifications.length > 1 && (
              <button
                onClick={() => {
                  visibleNotifications.forEach(notification => {
                    handleDismissNotification(notification.id)
                  })
                }}
                style={{
                  background: 'none',
                  border: '1px solid var(--color-gray-300)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'var(--color-gray-100)'
                  changeEvent.currentTarget.style.borderColor = 'var(--color-gray-400)'
                }}
                onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent'
                  changeEvent.currentTarget.style.borderColor = 'var(--color-gray-300)'
                }}
              >
                Clear All
              </button>
            )}
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
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


