// Payouts page constants

export const PAYOUTS_API = {
  CALCULATE:    '/api/v1/payouts/calculate',
  WINNERS:      '/api/v1/payouts/winners',
  LIVE_ENTRIES: '/api/v1/payouts/live-entries',
  ENTRIES:      '/api/v1/payouts/entries',
  SAVE:         '/api/v1/payouts/save',
  HISTORY:      '/api/v1/payouts/history',
} as const

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2
} as const

export const LOAD_DEBOUNCE_MS = 500

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_ITEMS_PER_PAGE: 100
} as const
