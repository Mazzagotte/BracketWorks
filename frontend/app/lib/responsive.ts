export const BW_BREAKPOINTS = {
  phoneMax: 480,
  handheldMax: 768,
  laptopMin: 769,
  desktopWideMin: 1280,
} as const

export function isPhoneWidth(width: number): boolean {
  return width <= BW_BREAKPOINTS.phoneMax
}

export function isHandheldWidth(width: number): boolean {
  return width <= BW_BREAKPOINTS.handheldMax
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