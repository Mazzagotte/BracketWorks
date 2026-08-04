import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import { API, apiFetch } from '../../lib/api'
import { PendingScoreSave } from '../../lib/types'

type AddToast = (args: { message: string; type: 'success' | 'warning' | 'error'; duration?: number }) => void

type UseOfflineScoreSyncArgs = {
  addToast: AddToast
}

type UseOfflineScoreSyncResult = {
  isOnline: boolean
  pendingSaves: PendingScoreSave[]
  setPendingSaves: Dispatch<SetStateAction<PendingScoreSave[]>>
  processPendingSaves: () => Promise<void>
}

export function useOfflineScoreSync({ addToast }: UseOfflineScoreSyncArgs): UseOfflineScoreSyncResult {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSaves, setPendingSaves] = useState<PendingScoreSave[]>([])

  const processPendingSaves = useCallback(async () => {
    const saves = [...pendingSaves]
    if (saves.length === 0) return

    setPendingSaves([])
    let failedCount = 0

    for (const saveData of saves) {
      try {
        const response = await apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(saveData.data),
        })

        if (!response.ok) {
          failedCount += 1
          setPendingSaves(prev => [...prev, saveData])
        }
      } catch {
        failedCount += 1
        setPendingSaves(prev => [...prev, saveData])
      }
    }

    if (failedCount === 0) {
      addToast({
        message: 'All offline scores have been synchronized!',
        type: 'success',
        duration: 3000,
      })
    }
  }, [addToast, pendingSaves])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (pendingSaves.length > 0) {
        void processPendingSaves()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      addToast({
        message: 'You are offline. Scores will be saved when connection is restored.',
        type: 'warning',
        duration: 5000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [addToast, pendingSaves.length, processPendingSaves])

  return {
    isOnline,
    pendingSaves,
    setPendingSaves,
    processPendingSaves,
  }
}
