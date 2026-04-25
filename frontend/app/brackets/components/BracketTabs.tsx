'use client'

import React from 'react'
import styles from '../styles/bracket-tabs.module.css'

interface BracketTabItem {
  id: string
  label: string
  count?: number
}

interface BracketTabsProps {
  tabs: BracketTabItem[]
  activeTab: string
  onTabChange: (tab: string) => void
}

/**
 * BracketTabs - Clean tab navigation for bracket types
 * Features: Scratch vs Handicap tabs, counts, view all option
 */
export function BracketTabs({
  tabs,
  activeTab,
  onTabChange
}: BracketTabsProps) {
  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.id === activeTab))

  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsList} role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
          >
            <span className={styles.tabLabel}>{tab.label}</span>
            {(tab.count || 0) > 0 && (
              <span className={styles.tabCount}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Active Indicator */}
      <div 
        className={styles.activeIndicator}
        style={{
          width: tabs.length > 0 ? `calc((100% - 1rem) / ${tabs.length})` : undefined,
          transform: `translateX(${activeIndex * 100}%)`
        }}
      />
    </div>
  )
}
