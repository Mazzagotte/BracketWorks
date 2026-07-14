import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'
import { BracketPreview } from '../../hooks/useBrackets'
import { Squad, Tournament } from '../../lib/types'

type UseBracketLoaderArgs = {
  selectedTournament: Tournament | null
  selectedSquad: Squad | null
  loadSavedBrackets: (tournamentId: number, squadId: number) => Promise<BracketPreview | null>
  setLoadedBrackets: Dispatch<SetStateAction<BracketPreview | null>>
}

export function useBracketLoader({
  selectedTournament,
  selectedSquad,
  loadSavedBrackets,
  setLoadedBrackets,
}: UseBracketLoaderArgs) {
  const loadingRef = useRef(false)
  const lastLoadedRef = useRef<{ tournamentId: number; squadId: number } | null>(null)

  useEffect(() => {
    if (!selectedSquad || !selectedTournament) return

    let isMounted = true

    const loadBrackets = (skipIfSame = false) => {
      if (!isMounted) return
      if (loadingRef.current) return
      if (
        skipIfSame &&
        lastLoadedRef.current?.tournamentId === selectedTournament.id &&
        lastLoadedRef.current?.squadId === selectedSquad.id
      ) {
        return
      }

      loadingRef.current = true
      loadSavedBrackets(selectedTournament.id, selectedSquad.id)
        .then(brackets => {
          if (!isMounted) {
            loadingRef.current = false
            return
          }
          if (brackets !== null) {
            setLoadedBrackets(brackets)
          }
          lastLoadedRef.current = { tournamentId: selectedTournament.id, squadId: selectedSquad.id }
          loadingRef.current = false
        })
        .catch(() => {
          if (isMounted) loadingRef.current = false
        })
    }

    loadBrackets(true)

    const getRefreshInterval = () => (document.hidden ? 60000 : 15000)
    let intervalId = setInterval(() => {
      if (isMounted) loadBrackets(false)
    }, getRefreshInterval())

    const handleVisibilityChange = () => {
      if (!isMounted) return
      clearInterval(intervalId)
      if (!document.hidden) loadBrackets(false)
      intervalId = setInterval(() => {
        if (isMounted) loadBrackets(false)
      }, getRefreshInterval())
    }

    const handleFocus = () => {
      if (!isMounted) return
      if (!document.hidden) loadBrackets(false)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      loadingRef.current = false
    }
  }, [loadSavedBrackets, selectedSquad, selectedTournament, setLoadedBrackets])

  const reloadAfterGeneration = useCallback(() => {
    if (!selectedSquad || !selectedTournament) return
    loadingRef.current = false
    lastLoadedRef.current = null
    loadSavedBrackets(selectedTournament.id, selectedSquad.id).then(brackets => {
      if (brackets) {
        setLoadedBrackets(brackets)
        lastLoadedRef.current = { tournamentId: selectedTournament.id, squadId: selectedSquad.id }
      }
    })
  }, [loadSavedBrackets, selectedSquad, selectedTournament, setLoadedBrackets])

  return { reloadAfterGeneration }
}
