import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishDataChange, subscribeToDataChanges } from './dataChanges'

describe('API data change notifications', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.dispatchEvent(new Event('bw:data-change-test-cleanup'))
  })

  it('notifies matching subscribers after writes and routes admin domain writes by resource', async () => {
    vi.useFakeTimers()
    const bowlersListener = vi.fn()
    const adminListener = vi.fn()
    const unsubscribeBowlers = subscribeToDataChanges(['bowlers'], bowlersListener)
    const unsubscribeAdmin = subscribeToDataChanges(['admin'], adminListener)

    publishDataChange('PATCH', '/api/v1/admin/bowlers/123')
    publishDataChange('POST', '/api/v1/admin/feedback/456')
    await vi.advanceTimersByTimeAsync(100)

    expect(bowlersListener).toHaveBeenCalledTimes(1)
    expect(bowlersListener.mock.calls[0]?.[0].domain).toBe('bowlers')
    expect(adminListener).toHaveBeenCalledTimes(1)
    expect(adminListener.mock.calls[0]?.[0].domain).toBe('admin')

    unsubscribeBowlers()
    unsubscribeAdmin()
  })

  it('ignores reads and the non-mutating workbook parse endpoint', async () => {
    vi.useFakeTimers()
    const listener = vi.fn()
    const unsubscribe = subscribeToDataChanges(['bowlers', 'admin'], listener)

    publishDataChange('GET', '/api/v1/bowlers')
    publishDataChange('POST', '/api/v1/admin/bowlers/parse-workbook')
    await vi.advanceTimersByTimeAsync(100)

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})