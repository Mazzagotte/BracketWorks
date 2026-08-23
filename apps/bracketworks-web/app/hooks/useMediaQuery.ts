'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const syncMatches = () => setMatches(mediaQuery.matches)

    syncMatches()
    mediaQuery.addEventListener('change', syncMatches)
    return () => mediaQuery.removeEventListener('change', syncMatches)
  }, [query])

  return matches
}
