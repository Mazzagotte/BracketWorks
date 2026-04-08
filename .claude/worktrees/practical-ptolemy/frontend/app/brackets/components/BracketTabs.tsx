'use client'

import React from 'react'
import styles from '../styles/bracket-tabs.module.css'

interface BracketTabsProps {
  activeTab: 'scratch' | 'handicap' | 'all'
  onTabChange: (tab: 'scratch' | 'handicap' | 'all') => void
  scratchCount?: number
  handicapCount?: number
  showAllOption?: boolean
}

/**
 * BracketTabs - Clean tab navigation for bracket types
 * Features: Scratch vs Handicap tabs, counts, view all option
 */
export function BracketTabs({
  activeTab,
  onTabChange,
  scratchCount = 0,
  handicapCount = 0,
  showAllOption = true
}: BracketTabsProps) {
  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsList} role="tablist">
        {/* Scratch Tab */}
        <button
          className={`${styles.tab} ${activeTab === 'scratch' ? styles.active : ''}`}
          onClick={() => onTabChange('scratch')}
          role="tab"
          aria-selected={activeTab === 'scratch'}
          aria-controls="scratch-panel"
        >
          <span className={styles.tabLabel}>Scratch Brackets</span>
          {scratchCount > 0 && (
            <span className={styles.tabCount}>{scratchCount}</span>
          )}
        </button>

        {/* Handicap Tab */}
        <button
          className={`${styles.tab} ${activeTab === 'handicap' ? styles.active : ''}`}
          onClick={() => onTabChange('handicap')}
          role="tab"
          aria-selected={activeTab === 'handicap'}
          aria-controls="handicap-panel"
        >
          <span className={styles.tabLabel}>Handicap Brackets</span>
          {handicapCount > 0 && (
            <span className={styles.tabCount}>{handicapCount}</span>
          )}
        </button>

        {/* All Tab */}
        {showAllOption && (
          <button
            className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
            onClick={() => onTabChange('all')}
            role="tab"
            aria-selected={activeTab === 'all'}
            aria-controls="all-panel"
          >
            <span className={styles.tabLabel}>View All</span>
            {(scratchCount + handicapCount) > 0 && (
              <span className={styles.tabCount}>{scratchCount + handicapCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Active Indicator */}
      <div 
        className={styles.activeIndicator}
        style={{
          transform: `translateX(${
            activeTab === 'scratch' ? '0%' : 
            activeTab === 'handicap' ? '100%' : 
            '200%'
          })`
        }}
      />
    </div>
  )
}
