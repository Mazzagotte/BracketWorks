export const TC_BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  desktopMin: 1024,
  desktopMax: 1279,
  largeDesktopMin: 1280,
  extraLargeDesktopMin: 1440,
  navigationDrawerMax: 1023,
  compactContentMax: 900,
} as const

export const MOBILE_VIEWPORT_QUERY = `(max-width: ${TC_BREAKPOINTS.mobileMax}px)`
export const COMPACT_CONTENT_VIEWPORT_QUERY = `(max-width: ${TC_BREAKPOINTS.compactContentMax}px)`
export const NAVIGATION_DRAWER_VIEWPORT_QUERY = `(max-width: ${TC_BREAKPOINTS.navigationDrawerMax}px)`

export function isPhoneWidth(width: number): boolean {
  return width <= TC_BREAKPOINTS.mobileMax
}

export function isCompactContentWidth(width: number): boolean {
  return width <= TC_BREAKPOINTS.compactContentMax
}
