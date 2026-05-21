import { DelayedRouteFallback } from '../components/DelayedRouteFallback'

export default function DashboardLoading() {
  return (
    <DelayedRouteFallback>
      <div className="bw-sk-page">
        <div className="bw-sk-header">
          <div className="bw-sk bw-sk-w-xl bw-sk-h-title" />
          <div className="bw-sk-header-actions">
            <div className="bw-sk bw-sk-w-md bw-sk-h-input" />
            <div className="bw-sk bw-sk-w-md bw-sk-h-input" />
          </div>
        </div>

        <div className="bw-sk-grid-2">
          {[0, 1].map(i => (
            <div key={i} className="bw-sk-dash-card">
              <div className="bw-sk bw-sk-w-md bw-sk-h-title" />
              {[0, 1, 2, 3].map(j => (
                <div key={j} className="bw-sk bw-sk-w-full bw-sk-h-bracket" />
              ))}
              <div className="bw-sk-warm bw-sk-w-full bw-sk-h-action" />
            </div>
          ))}
        </div>
      </div>
    </DelayedRouteFallback>
  )
}
