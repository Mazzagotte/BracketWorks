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
    <div className="bw-tabs-bar">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`bw-tabs-btn ${isActive ? 'bw-tabs-btn-active' : ''}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`bw-tabs-count ${isActive ? 'bw-tabs-count-active' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
