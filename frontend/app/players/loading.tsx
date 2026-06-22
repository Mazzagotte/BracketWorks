import { DelayedRouteFallback } from '../components/DelayedRouteFallback'
import { PlayersSkeleton } from '../components/LoadingComponents'

export default function PlayersLoading() {
  return (
    <DelayedRouteFallback>
      <PlayersSkeleton />
    </DelayedRouteFallback>
  )
}
