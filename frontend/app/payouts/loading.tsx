import { DelayedRouteFallback } from '../components/DelayedRouteFallback'
import { PayoutsSkeleton } from '../components/LoadingComponents'

export default function PayoutsLoading() {
  return (
    <DelayedRouteFallback>
      <PayoutsSkeleton />
    </DelayedRouteFallback>
  )
}
