'use client'

import React, { useState, useRef, useEffect } from 'react'
import styles from '../styles/player-tooltip.module.css'

interface PlayerTooltipProps {
  children: React.ReactNode
  playerName: string
  fullName?: string
  usbcNumber?: string
  average?: number
  handicap?: number
  qualifyingScore?: number
  tournamentRecord?: string
  seed?: number
  isWinner?: boolean
}

/**
 * PlayerTooltip - Hover tooltip showing detailed player information
 * Shows: full name, USBC number, average, handicap, qualifying score, tournament record
 */
export function PlayerTooltip({
  children,
  playerName,
  fullName,
  usbcNumber,
  average,
  handicap,
  qualifyingScore,
  tournamentRecord,
  seed,
  isWinner
}: PlayerTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showTooltip = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Show tooltip after a short delay
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setPosition({
          top: rect.top + window.scrollY,
          left: rect.left + rect.width / 2 + window.scrollX
        })
        setIsVisible(true)
      }
    }, 300) // 300ms delay before showing
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Adjust tooltip position to stay within viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const tooltip = tooltipRef.current
      const rect = tooltip.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedLeft = position.left
      let adjustedTop = position.top

      // Adjust horizontal position
      if (rect.right > viewportWidth - 20) {
        adjustedLeft = position.left - (rect.right - viewportWidth + 20)
      }
      if (rect.left < 20) {
        adjustedLeft = position.left + (20 - rect.left)
      }

      // Adjust vertical position
      if (rect.bottom > viewportHeight - 20) {
        adjustedTop = position.top - rect.height - 40
      }

      if (adjustedLeft !== position.left || adjustedTop !== position.top) {
        setPosition({ top: adjustedTop, left: adjustedLeft })
      }
    }
  }, [isVisible, position])

  // Don't show tooltip if no additional info is available
  const hasAdditionalInfo = fullName || usbcNumber || average !== undefined || 
                            handicap !== undefined || qualifyingScore !== undefined || 
                            tournamentRecord || seed !== undefined

  if (!hasAdditionalInfo) {
    return <>{children}</>
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={styles.tooltipTrigger}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        tabIndex={0}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
          role="tooltip"
        >
          {/* Arrow */}
          <div className={styles.tooltipArrow} />

          {/* Header */}
          <div className={styles.tooltipHeader}>
            {isWinner && <span className={styles.winnerIcon}>🏆</span>}
            <h4 className={styles.playerNameHeader}>
              {fullName || playerName}
            </h4>
            {seed !== undefined && (
              <span className={styles.seedBadge}>#{seed}</span>
            )}
          </div>

          {/* Player Details */}
          <div className={styles.tooltipBody}>
            {usbcNumber && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>USBC:</span>
                <span className={styles.detailValue}>{usbcNumber}</span>
              </div>
            )}

            {average !== undefined && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Average:</span>
                <span className={styles.detailValue}>{average}</span>
              </div>
            )}

            {handicap !== undefined && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Handicap:</span>
                <span className={styles.detailValue}>{handicap}</span>
              </div>
            )}

            {qualifyingScore !== undefined && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Qualifying:</span>
                <span className={`${styles.detailValue} ${styles.highlight}`}>
                  {qualifyingScore}
                </span>
              </div>
            )}

            {tournamentRecord && (
              <div className={styles.recordRow}>
                <span className={styles.detailLabel}>Tournament Record:</span>
                <span className={styles.detailValue}>{tournamentRecord}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
