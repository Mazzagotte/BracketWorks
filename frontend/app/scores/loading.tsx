import { DelayedRouteFallback } from '../components/DelayedRouteFallback'
import { ScoresSkeleton } from '../components/LoadingComponents'

export default function ScoresLoading() {
  return (
    <DelayedRouteFallback>
      <ScoresSkeleton />
    </DelayedRouteFallback>
  )
}
