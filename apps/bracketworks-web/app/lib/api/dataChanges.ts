import { clearApiRequestCache, clearAuthFetchCache } from './cache'

export type DataDomain =
  | 'tournaments'
  | 'squads'
  | 'settings'
  | 'bowlers'
  | 'scores'
  | 'brackets'
  | 'payouts'
  | 'admin'
  | 'other'

export type DataChange = {
  domain: DataDomain
  endpoint: string
  method: string
  sourceId: string
}

const EVENT_NAME = 'bw:data-changed'
const CHANNEL_NAME = 'bracketworks:data-changed'
let sourceId: string | null = null
let channel: BroadcastChannel | null = null
let pendingChanges = new Map<DataDomain, DataChange>()
let publishTimer: ReturnType<typeof setTimeout> | null = null

function getSourceId(): string {
  if (!sourceId) sourceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  return sourceId
}

function getDomain(endpoint: string): DataDomain {
  const path = endpoint.split('?')[0]?.toLowerCase() ?? endpoint.toLowerCase()
  if (path.includes('/api/v1/tournaments') || path.includes('/api/v1/admin/tournaments')) return 'tournaments'
  if (path.includes('/api/v1/squads')) return 'squads'
  if (path.includes('/api/v1/bracket-settings')) return 'settings'
  if (path.includes('/api/v1/bowlers') || path.includes('/api/v1/admin/bowlers')) return 'bowlers'
  if (path.includes('/api/v1/scores')) return 'scores'
  if (path.includes('/api/v1/brackets')) return 'brackets'
  if (path.includes('/api/v1/payouts')) return 'payouts'
  if (path.includes('/api/v1/admin')) return 'admin'
  return 'other'
}

function dispatchLocal(change: DataChange): void {
  if (typeof window === 'undefined') return
  clearApiRequestCache()
  clearAuthFetchCache()
  window.dispatchEvent(new CustomEvent<DataChange>(EVENT_NAME, { detail: change }))
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.addEventListener('message', (event: MessageEvent<DataChange>) => {
      if (event.data?.sourceId && event.data.sourceId !== getSourceId()) dispatchLocal(event.data)
    })
  }
  return channel
}

export function publishDataChange(method: string, endpoint: string): void {
  if (typeof window === 'undefined' || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return
  const path = endpoint.split('?')[0]?.toLowerCase() ?? endpoint.toLowerCase()
  if (path.includes('/users/login') || path.includes('/users/refresh') || path.endsWith('/parse-workbook')) return
  const change: DataChange = { domain: getDomain(endpoint), endpoint, method: method.toUpperCase(), sourceId: getSourceId() }
  pendingChanges.set(change.domain, change)
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = setTimeout(() => {
    const changes = Array.from(pendingChanges.values())
    pendingChanges = new Map()
    publishTimer = null
    for (const pendingChange of changes) {
      dispatchLocal(pendingChange)
      getChannel()?.postMessage(pendingChange)
    }
  }, 100)
}

export function subscribeToDataChanges(domains: DataDomain[], callback: (change: DataChange) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event) => {
    const change = (event as CustomEvent<DataChange>).detail
    if (change && domains.includes(change.domain)) callback(change)
  }
  window.addEventListener(EVENT_NAME, listener)
  getChannel()
  return () => window.removeEventListener(EVENT_NAME, listener)
}