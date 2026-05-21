import { DelayedRouteFallback } from '../components/DelayedRouteFallback'

export default function BracketsLoading() {
  return (
    <DelayedRouteFallback>
      <div className="bw-sk-page">
        <div className="bw-sk-header">
          <div className="bw-sk bw-sk-w-lg bw-sk-h-title" />
          <div className="bw-sk-header-actions">
            <div className="bw-sk bw-sk-w-lg bw-sk-h-input" />
            <div className="bw-sk bw-sk-w-lg bw-sk-h-input" />
            <div className="bw-sk bw-sk-w-md bw-sk-h-input" />
          </div>
        </div>

        <div className="bw-sk-filters-lg">
          <div className="bw-sk bw-sk-w-xl bw-sk-h-input" />
          <div className="bw-sk bw-sk-w-lg bw-sk-h-input" />
          <div className="bw-sk bw-sk-w-flex bw-sk-h-input" />
        </div>

        <div className="bw-sk-tabs-pill">
          <div className="bw-sk bw-sk-w-xs bw-sk-h-tab bw-sk-r-pill" />
          <div className="bw-sk bw-sk-w-sm bw-sk-h-tab bw-sk-r-pill" />
          <div className="bw-sk bw-sk-w-xs bw-sk-h-tab bw-sk-r-pill" />
        </div>

        <div className="bw-sk-bracket-tree">
          <div className="bw-sk-bracket-rounds">
            <div className="bw-sk-bracket-round bw-sk-bracket-round-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bw-sk bw-sk-w-md bw-sk-h-bracket bw-sk-r-card" />
              ))}
            </div>
            <div className="bw-sk-bracket-round bw-sk-bracket-round-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bw-sk bw-sk-w-md bw-sk-h-bracket bw-sk-r-card" />
              ))}
            </div>
            <div className="bw-sk-bracket-round bw-sk-bracket-round-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bw-sk bw-sk-w-md bw-sk-h-bracket bw-sk-r-card" />
              ))}
            </div>
            <div className="bw-sk-bracket-round bw-sk-bracket-round-1">
              <div className="bw-sk-warm bw-sk-w-md bw-sk-h-bracket bw-sk-r-card" />
            </div>
          </div>
        </div>
      </div>
    </DelayedRouteFallback>
  )
}
