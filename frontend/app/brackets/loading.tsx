import { DelayedRouteFallback } from '../components/DelayedRouteFallback'
import { BracketSkeleton } from '../components/LoadingComponents'

export default function BracketsLoading() {
  return (
    <DelayedRouteFallback>
      <BracketSkeleton />
    </DelayedRouteFallback>
  )
}
