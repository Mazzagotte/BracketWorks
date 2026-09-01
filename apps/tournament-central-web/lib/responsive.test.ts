import { describe, expect, it } from 'vitest'

import {
  COMPACT_CONTENT_VIEWPORT_QUERY,
  MOBILE_VIEWPORT_QUERY,
  NAVIGATION_DRAWER_VIEWPORT_QUERY,
  TC_BREAKPOINTS,
  isCompactContentWidth,
  isPhoneWidth,
} from './responsive'

describe('responsive breakpoints', () => {
  it('keeps phone, tablet, and desktop tiers contiguous', () => {
    expect(TC_BREAKPOINTS.tabletMin).toBe(TC_BREAKPOINTS.mobileMax + 1)
    expect(TC_BREAKPOINTS.desktopMin).toBe(TC_BREAKPOINTS.tabletMax + 1)
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
