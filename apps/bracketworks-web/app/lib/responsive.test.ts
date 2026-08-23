import { describe, expect, it } from 'vitest'

import {
  BW_BREAKPOINTS,
  COMPACT_CONTENT_VIEWPORT_QUERY,
  MOBILE_VIEWPORT_QUERY,
  NAVIGATION_DRAWER_VIEWPORT_QUERY,
  isCompactContentWidth,
  isPhoneWidth,
} from './responsive'

describe('responsive breakpoints', () => {
  it('keeps phone, tablet, and desktop tiers contiguous', () => {
    expect(BW_BREAKPOINTS.tabletMin).toBe(BW_BREAKPOINTS.mobileMax + 1)
    expect(BW_BREAKPOINTS.desktopMin).toBe(BW_BREAKPOINTS.tabletMax + 1)
  })

  it('keeps compact content distinct from the phone tier', () => {
    expect(isPhoneWidth(767)).toBe(true)
    expect(isPhoneWidth(768)).toBe(false)
    expect(isCompactContentWidth(900)).toBe(true)
    expect(isCompactContentWidth(901)).toBe(false)
  })

  it('builds media queries from the canonical values', () => {
    expect(MOBILE_VIEWPORT_QUERY).toBe('(max-width: 767px)')
    expect(COMPACT_CONTENT_VIEWPORT_QUERY).toBe('(max-width: 900px)')
    expect(NAVIGATION_DRAWER_VIEWPORT_QUERY).toBe('(max-width: 1023px)')
  })
})
