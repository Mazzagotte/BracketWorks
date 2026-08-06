import { DelayedRouteFallback } from '../components/DelayedRouteFallback'
import { DashboardSkeleton } from '../components/LoadingComponents'

export default function DashboardLoading() {
  return (
    <DelayedRouteFallback>
      <DashboardSkeleton />
    </DelayedRouteFallback>
  )
}
