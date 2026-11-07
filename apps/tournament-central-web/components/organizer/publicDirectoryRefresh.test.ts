import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/publicDirectory', () => ({ refreshPublicDirectory: refresh }));

import { requestPublicDirectoryRefresh } from './publicDirectoryRefresh';

afterEach(() => {
  vi.useRealTimers();
  refresh.mockReset();
});

describe('homepage directory refresh', () => {
  it('collapses a burst of organizer saves into one refresh', () => {
    vi.useFakeTimers();
    refresh.mockResolvedValue(undefined);
    requestPublicDirectoryRefresh();
    requestPublicDirectoryRefresh();
    requestPublicDirectoryRefresh();
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never throws when the refresh fails', async () => {
    vi.useFakeTimers();
    refresh.mockRejectedValue(new Error('offline'));
    requestPublicDirectoryRefresh();
    vi.advanceTimersByTime(1500);
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
