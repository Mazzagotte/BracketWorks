export const BW_BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  desktopMin: 1024,
  desktopMax: 1279,
  largeDesktopMin: 1280,
  extraLargeDesktopMin: 1440,
  navigationDrawerMax: 1023,
} as const

export const MOBILE_VIEWPORT_QUERY = `(max-width: ${BW_BREAKPOINTS.mobileMax}px)`

export function isPhoneWidth(width: number): boolean {
  return width <= BW_BREAKPOINTS.mobileMax
}

export function isHandheldWidth(width: number): boolean {
  return isPhoneWidth(width)
}

export function isPhoneViewport(): boolean {
  return typeof window !== 'undefined' && isPhoneWidth(window.innerWidth)
}

export function isHandheldViewport(): boolean {
  return typeof window !== 'undefined' && isHandheldWidth(window.innerWidth)
}

export function matchesMaxWidth(width: number): boolean {
  return typeof window !== 'undefined' && window.matchMedia(`(max-width: ${width}px)`).matches
}

export function usesNavigationDrawerViewport(): boolean {
  return typeof window !== 'undefined' && matchesMaxWidth(BW_BREAKPOINTS.navigationDrawerMax)
}
