import { colors, spacing } from '../../lib/design-system'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div style={{
      display: 'flex',
      gap: spacing.xs,
      borderBottom: `2px solid ${colors.border}`,
      marginBottom: spacing.lg
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              fontSize: '16px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? colors.primary : colors.text.secondary,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: `3px solid ${isActive ? colors.primary : 'transparent'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                marginLeft: spacing.xs,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: isActive ? colors.backgrounds.primary : colors.gray[200],
                fontSize: '13px',
                fontWeight: 600
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
