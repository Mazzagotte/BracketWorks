import { DelayedRouteFallback } from '../components/DelayedRouteFallback'

export default function PlayersLoading() {
  return (
    <DelayedRouteFallback>
      <div className="bw-sk-page">
        <div className="bw-sk-header">
          <div className="bw-sk bw-sk-w-lg bw-sk-h-title" />
          <div className="bw-sk-header-actions">
            <div className="bw-sk bw-sk-w-lg bw-sk-h-input" />
            <div className="bw-sk bw-sk-w-md bw-sk-h-input" />
          </div>
        </div>

        <div className="bw-sk-filters-lg">
          <div className="bw-sk bw-sk-w-xl bw-sk-h-input" />
          <div className="bw-sk bw-sk-w-lg bw-sk-h-input" />
          <div className="bw-sk bw-sk-w-flex bw-sk-h-input" />
        </div>

        <div className="bw-sk-card">
          <div className="bw-sk-table-header bw-sk-cols-2x1x1x1x1 bw-sk-gap-lg">
            <div className="bw-sk bw-sk-w-xl bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-sm bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-sm bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-sm bw-sk-h-line" />
            <div className="bw-sk bw-sk-w-md bw-sk-h-line" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bw-sk-table-row bw-sk-cols-2x1x1x1x1 bw-sk-gap-lg">
              <div className="bw-sk bw-sk-w-md bw-sk-h-line" />
              <div className="bw-sk bw-sk-w-xs bw-sk-h-line" />
              <div className="bw-sk bw-sk-w-xs bw-sk-h-line" />
              <div className="bw-sk bw-sk-w-sm bw-sk-h-line" />
              <div className="bw-sk bw-sk-w-sm bw-sk-h-val bw-sk-r-card" />
            </div>
          ))}
        </div>
      </div>
    </DelayedRouteFallback>
  )
}
