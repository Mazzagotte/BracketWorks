'use client'

import React, { memo, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { colors } from '../styles/colors'




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
        return { icon: '📝', label: 'Draft', bg: colors.gray[100], color: colors.gray[700] }
      case 'registration_open':
        return { icon: '📝', label: 'Registration Open', bg: colors.blue.light, color: colors.blue.deeper }
      case 'in_progress':
        return { icon: 'Squad', label: 'In Progress', bg: colors.yellow.light, color: colors.yellow.dark }
      case 'completed':
        return { icon: '', label: 'Completed', bg: colors.green.light, color: colors.green.deeper }
      case 'cancelled':
        return { icon: '', label: 'Cancelled', bg: '#fee2e2', color: '#dc2626' }
      default:
        return { icon: '❓', label: 'Unknown', bg: colors.gray[100], color: colors.gray[500] }
    }
  }, [tournament?.status])

  const connectionStyles = useMemo(() => ({
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    backgroundColor: connectionStatus === 'online' ? '#ecfdf5' : 
                   connectionStatus === 'syncing' ? '#fef3c7' : '#fef2f2',
    color: connectionStatus === 'online' ? '#065f46' : 
           connectionStatus === 'syncing' ? '#92400e' : '#991b1b'
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
            border: '1px solid #e2e8f0'
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
          background: '#ffffff',
          padding: '0.5rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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
          <Link href={crumb.href} className="breadcrumb-link" style={{ color: colors.gray[600], textDecoration: 'none' }}>
            {crumb.label}
          </Link>
        ) : (
          <span style={{ color: colors.gray[700] }}>{crumb.label}</span>
        )}
        {index < breadcrumbs.length - 1 && <span style={{ margin: '0 0.5rem', color: colors.gray[400] }}>/</span>}
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
            borderBottom: index < visibleNotifications.length - 1 ? '1px solid #f3f4f6' : 'none',
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
                    backgroundColor: notification.priority === 'high' ? '#ef4444' : '#f59e0b',
                    color: 'white',
                    textTransform: 'uppercase'
                  }}>
                    {priorityLabel}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: colors.gray[500] }}>
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
              
              <div style={{ 
                fontWeight: '500',
                color: colors.gray[900],
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
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          color: #1e293b;
          padding: ${isMobile ? (isHeaderCollapsed ? '0.75rem 1rem' : '1.5rem 1rem') : '2rem'};
          border-radius: 0 0 16px 16px;
          margin: 0 auto 2rem;
          max-width: 1200px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid #e2e8f0;
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: ${isMobile && isHeaderCollapsed ? 'translateY(-10px)' : 'translateY(0)'};
          animation: slideDown 0.5s ease-out;
        }
        
        .header-container:hover {
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          transform: ${isMobile && isHeaderCollapsed ? 'translateY(-12px)' : 'translateY(-2px)'};
        }
        
        .interactive-button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .interactive-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .interactive-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .notification-badge {
          animation: bounce 2s infinite;
        }
        
        .stats-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .stats-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
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
            rgba(255, 255, 255, 0.4), 
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
          color: #1e40af !important;
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
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
        }
        
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .success-indicator {
          border-left: 4px solid #10b981;
          background: #f0fdf4;
          transition: all 0.3s ease;
        }
        
        .warning-indicator {
          border-left: 4px solid #f59e0b;
          background: #fffbeb;
          transition: all 0.3s ease;
        }
        
        .error-indicator {
          border-left: 4px solid #ef4444;
          background: #fef2f2;
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
        
        .status-online { background-color: #10b981; }
        .status-offline { background-color: #ef4444; }
        .status-syncing { 
          background-color: #f59e0b;
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
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        
        .connection-indicator.connection-pulse {
          animation: connectionPulse 2s ease-in-out infinite;
        }
        
        @keyframes connectionPulse {
          0%, 100% { 
            opacity: 0.9;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          50% { 
            opacity: 1;
            box-shadow: 0 4px 20px rgba(245, 158, 11, 0.3);
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
          background: rgba(0, 0, 0, 0.8);
          color: white;
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
          background-color: #f9fafb;
          transform: translateX(2px);
        }
        
        .notification-item.priority-high {
          border-left-color: #ef4444;
          background-color: #fef2f2;
        }
        
        .notification-item.priority-medium {
          border-left-color: #f59e0b;
          background-color: #fffbeb;
        }
        
        .notification-item.priority-low {
          border-left-color: #3b82f6;
          background-color: #eff6ff;
        }
        
        .notification-item.type-success {
          border-left-color: #10b981;
          background-color: #f0fdf4;
        }
        
        .notification-item.type-error {
          border-left-color: #ef4444;
          background-color: #fef2f2;
        }
        
        .notification-item.type-warning {
          border-left-color: #f59e0b;
          background-color: #fffbeb;
        }
        
        .notification-item.type-info {
          border-left-color: #3b82f6;
          background-color: #eff6ff;
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
          background-color: #3b82f6;
          color: white;
        }
        
        .notification-action-btn.primary:hover {
          background-color: #2563eb;
        }
        
        .notification-action-btn.secondary {
          background-color: #f3f4f6;
          color: #374151;
        }
        
        .notification-action-btn.secondary:hover {
          background-color: #e5e7eb;
        }
        
        .notification-dismiss {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: none;
          border: none;
          color: #9ca3af;
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
          background-color: #f3f4f6;
          color: #374151;
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
                color: '#1e293b',
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
                    border: '2px solid rgba(30, 41, 59, 0.2)',
                    borderTop: '2px solid #1e293b',
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
                color: '#64748b',
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
                    background: '#ffffff',
                    padding: isMobile ? '1rem' : '1.5rem',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
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
                          color: '#0f172a',
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
                            color: '#64748b',
                            fontSize: '0.95rem'
                          }}>
                            <span style={{ color: '#e11d48' }}>📍</span>
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
                          border: `1px solid ${statusInfo.color}20`,
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
                        color: '#64748b',
                        flexWrap: 'wrap',
                        padding: '0.75rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {tournament.start_date && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '600', color: colors.gray[700], fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Date</span>
                            <span style={{ fontWeight: '500', color: colors.dark.base }}>{new Date(tournament.start_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {tournament.end_date && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '600', color: colors.gray[700], fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End Date</span>
                            <span style={{ fontWeight: '500', color: colors.dark.base }}>{new Date(tournament.end_date).toLocaleDateString()}</span>
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
                    color: colors.gray[600],
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
                          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                          padding: '0.625rem 1rem',
                          borderRadius: '24px',
                          border: '1px solid #3b82f6',
                          boxShadow: '0 2px 4px rgba(59, 130, 246, 0.1)'
                        }}>
                          <span style={{ 
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: '#1e40af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.025em'
                          }}>Squad:</span>
                          <span style={{ 
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            color: '#1e40af'
                          }}>
                            {selectedSquad.time}
                          </span>
                        </div>
                      )}

                      {/* Players Count - Only show on pages that manage players */}
                      {(pageContext === 'brackets' || pageContext === 'players' || pageContext === 'scores') && (
                        <div style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: playersCount > 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          border: `1px solid ${playersCount > 0 ? '#10b981' : '#f59e0b'}`,
                          borderRadius: '24px',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          color: playersCount > 0 ? '#059669' : '#92400e',
                          minWidth: '130px',
                          textAlign: 'center',
                          boxShadow: `0 2px 4px ${playersCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
                          textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
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
                      background: '#ffffff',
                      padding: isMobile ? '1rem' : '1.5rem',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      border: '1px solid #e2e8f0',
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
                      color: '#475569',
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
                background: '#ffffff',
                padding: isMobile ? '1rem' : '1.5rem',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e2e8f0',
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
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em'
                  }}>Tournament Progress</span>
                  <span style={{ 
                    fontSize: '1.125rem', 
                    fontWeight: '700',
                    color: '#0f172a'
                  }}>
                    {Math.round(stats.completionPercentage)}%
                  </span>
                </div>
                <div 
                  className="progress-bar"
                  style={{ 
                    width: '100%', 
                    height: '10px', 
                    backgroundColor: '#e2e8f0', 
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                  <div style={{ 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                    width: `${stats.completionPercentage}%`,
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    borderRadius: '5px',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)'
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
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '50%',
                    width: isMobile ? '48px' : '40px',
                    height: isMobile ? '48px' : '40px',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
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
                        background: visibleNotifications.some(nItem => nItem.priority === 'high') ? '#ef4444' :
                                   visibleNotifications.some(nItem => nItem.priority === 'medium') ? '#f59e0b' : '#3b82f6',
                        color: 'white',
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
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px 0 0 6px',
                            backgroundColor: viewMode === 'tree' ? '#3b82f6' : '#f9fafb',
                            color: viewMode === 'tree' ? 'white' : '#374151',
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
                            border: '1px solid #e5e7eb',
                            borderRadius: '0 6px 6px 0',
                            backgroundColor: viewMode === 'table' ? '#3b82f6' : '#f9fafb',
                            color: viewMode === 'table' ? 'white' : '#374151',
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
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
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
                              border: '1px solid #d1d5db',
                              borderTop: '1px solid #374151',
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
                          backgroundColor: hasPreview ? '#059669' : '#3b82f6',
                          color: 'white',
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
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              borderTop: '2px solid white',
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
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            background: connectionStatus === 'online' 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.9) 100%)' 
              : connectionStatus === 'syncing'
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%)',
            color: 'white'
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
            textTransform: 'capitalize',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
          }}>
            {connectionStatus}
          </span>
          
          {/* Syncing Animation */}
          {connectionStatus === 'syncing' && (
            <span 
              className="loading-spinner" 
              style={{ 
                fontSize: '0.75rem',
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
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
            background: 'white',
            color: '#1f2937',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 1000,
            minWidth: '350px',
            maxWidth: isMobile ? '90vw' : '450px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <h3 style={{ margin: '0', fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Notifications ({visibleNotifications.length})
              </h3>
              <button
                onClick={handleNotificationClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6'
                  changeEvent.currentTarget.style.color = '#374151'
                }}
                onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent'
                  changeEvent.currentTarget.style.color = '#6b7280'
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
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = '#f3f4f6'
                  changeEvent.currentTarget.style.borderColor = '#9ca3af'
                }}
                onMouseLeave={(changeEvent) => { changeEvent.currentTarget.style.backgroundColor = 'transparent'
                  changeEvent.currentTarget.style.borderColor = '#d1d5db'
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


