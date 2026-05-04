export default function PayoutsLoading() {
  return (
    <div className="bw-sk-page">
      <div className="bw-sk-header">
        <div className="bw-sk bw-sk-w-md bw-sk-h-title" />
        <div className="bw-sk-header-actions">
          <div className="bw-sk bw-sk-w-xl bw-sk-h-input" />
          <div className="bw-sk bw-sk-w-lg bw-sk-h-input" />
        </div>
      </div>

      <div className="bw-sk-grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bw-sk-stat-card">
            <div className="bw-sk bw-sk-w-sm bw-sk-h-label" />
            <div className="bw-sk bw-sk-w-md bw-sk-h-val" />
          </div>
        ))}
      </div>

      <div className="bw-sk-tabs">
        <div className="bw-sk bw-sk-w-sm bw-sk-h-tab bw-sk-r-tab" />
        <div className="bw-sk bw-sk-w-xs bw-sk-h-tab bw-sk-r-tab" />
      </div>

      <div className="bw-sk-card">
        <div className="bw-sk-card-head">
          <div className="bw-sk bw-sk-w-xl bw-sk-h-tab" />
          <div className="bw-sk bw-sk-w-flex bw-sk-h-tab" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bw-sk-table-row bw-sk-cols-2x1x1x1 bw-sk-gap-lg">
            <div className="bw-sk bw-sk-w-md bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-xs bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-sm bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-sm bw-sk-h-chip bw-sk-r-pill" />
          </div>
        ))}
      </div>
    </div>
  )
}
