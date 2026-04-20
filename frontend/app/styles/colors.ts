/**
 * BracketWorks Color Palette
 * Central color system for consistent theming across the application
 */

export const colors = {
  // Primary Brand Colors
  brand: {
    gold: '#F97316',
    goldDark: '#FB823C',
    goldLight: '#F97316',
    goldLighter: '#fed7aa',
    goldPale: '#fdba74',
  },

  // Blue - Interactive Elements
  blue: {
    primary: '#3b82f6',
    dark: '#2563eb',
    deeper: '#1e40af',
    light: '#dbeafe',
    lighter: '#bfdbfe',
    pale: '#93c5fd',
  },

  // Purple - Accent & Tie Indicators
  purple: {
    primary: '#8b5cf6',
    dark: '#7c3aed',
    light: '#667eea',
    accent: '#764ba2',
  },

  // Green - Success & Complete States
  green: {
    primary: '#10b981',
    secondary: '#22c55e',
    dark: '#059669',
    deeper: '#065f46',
    light: '#d1fae5',
    lighter: '#a7f3d0',
    pale: '#6ee7b7',
  },

  // Pink - Accent
  pink: {
    primary: '#ec4899',
  },

  // Red - Error States
  red: {
    primary: '#ef4444',
  },

  // Yellow - Warning & Handicap
  yellow: {
    primary: '#eab308',
    light: '#fef3c7',
    dark: '#92400e',
  },

  // Grays - Backgrounds & Text
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#475569',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Dark Mode Backgrounds
  dark: {
    base: '#1F2937',
    surface: '#2F2F2F',
    elevated: '#374151',
    lighter: '#4b5563',
    accent: '#6b7280',
  },

  // Utility Colors
  white: '#FAFAF9',
  black: '#000000',
  transparent: 'transparent',
} as const

/**
 * Semantic color mappings for specific UI elements
 */
export const semantic = {
  // Button States
  button: {
    primary: colors.brand.gold,
    primaryHover: colors.brand.goldDark,
    secondary: colors.blue.primary,
    secondaryHover: colors.blue.dark,
  },

  // Badge Colors
  badge: {
    tie: {
      from: colors.purple.primary,
      to: colors.purple.dark,
    },
    split: {
      from: colors.brand.goldLight,
      to: colors.brand.goldDark,
    },
    scratch: {
      bg: colors.blue.light,
      border: colors.blue.pale,
      text: colors.blue.deeper,
    },
    handicap: {
      bg: colors.yellow.light,
      border: colors.brand.goldLighter,
      text: colors.yellow.dark,
    },
    complete: {
      bg: colors.green.light,
      border: colors.green.pale,
      text: colors.green.deeper,
    },
  },

  // Status Colors
  status: {
    success: colors.green.primary,
    error: colors.red.primary,
    warning: colors.yellow.primary,
    info: colors.blue.primary,
  },

  // Text Colors
  text: {
    primary: colors.gray[900],
    secondary: colors.gray[700],
    tertiary: colors.gray[500],
    disabled: colors.gray[400],
    inverse: colors.white,
  },

  // Background Colors
  background: {
    primary: colors.white,
    secondary: colors.gray[50],
    tertiary: colors.gray[100],
    dark: colors.dark.base,
    darkSurface: colors.dark.surface,
  },

  // Border Colors
  border: {
    light: colors.gray[200],
    medium: colors.gray[300],
    dark: colors.gray[400],
  },
} as const

/**
 * Gradient definitions for consistent gradient usage
 */
export const gradients = {
  brand: `linear-gradient(135deg, ${colors.brand.gold} 0%, ${colors.brand.goldDark} 100%)`,
  brandSubtle: `linear-gradient(135deg, ${colors.brand.goldLight} 0%, ${colors.brand.goldDark} 100%)`,
  
  blue: `linear-gradient(135deg, ${colors.blue.primary} 0%, ${colors.blue.dark} 100%)`,
  blueLight: `linear-gradient(135deg, ${colors.blue.light} 0%, ${colors.blue.lighter} 100%)`,
  
  purple: `linear-gradient(135deg, ${colors.purple.primary} 0%, ${colors.purple.dark} 100%)`,
  purpleTie: `linear-gradient(135deg, ${colors.purple.primary} 0%, ${colors.purple.dark} 100%)`,
  
  green: `linear-gradient(135deg, ${colors.green.light} 0%, ${colors.green.lighter} 100%)`,
  greenProgress: `linear-gradient(90deg, ${colors.green.primary} 0%, ${colors.green.dark} 100%)`,
  
  gray: `linear-gradient(135deg, ${colors.gray[100]} 0%, ${colors.gray[200]} 100%)`,
  grayLight: `linear-gradient(135deg, ${colors.white} 0%, ${colors.gray[50]} 100%)`,
  
  dark: `linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)`,
  darkComplex: `linear-gradient(135deg, ${colors.dark.base} 0%, ${colors.dark.surface} 25%, ${colors.dark.elevated} 50%, ${colors.dark.lighter} 75%, ${colors.dark.accent} 100%)`,
  
  rainbow: `linear-gradient(90deg, ${colors.blue.primary}, ${colors.purple.primary}, ${colors.pink.primary}, ${colors.brand.goldLight})`,
  
  yellowLight: `linear-gradient(135deg, ${colors.yellow.light} 0%, ${colors.brand.goldLighter} 100%)`,
} as const

/**
 * Shadow definitions with color-specific shadows
 */
export const shadows = {
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  md: '0 4px 16px rgba(0, 0, 0, 0.08)',
  lg: '0 20px 60px rgba(0, 0, 0, 0.5)',
  
  blue: {
    sm: '0 2px 8px rgba(59, 130, 246, 0.3)',
    md: '0 4px 12px rgba(59, 130, 246, 0.4)',
  },
  
  brand: {
    sm: '0 2px 8px rgba(240, 165, 0, 0.3)',
    md: '0 4px 12px rgba(240, 165, 0, 0.4)',
    glow: '0 0 20px rgba(240, 165, 0, 0.4)',
  },
  
  purple: {
    sm: '0 2px 8px rgba(139, 92, 246, 0.3)',
  },
  
  green: {
    sm: '0 2px 4px rgba(16, 185, 129, 0.3)',
  },
  
  inset: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
} as const

/**
 * Opacity values for consistent transparency
 */
export const opacity = {
  transparent: 0,
  subtle: 0.05,
  light: 0.1,
  medium: 0.2,
  strong: 0.3,
  veryStrong: 0.5,
  mostlyOpaque: 0.75,
  almostSolid: 0.9,
  solid: 1,
} as const

/**
 * Helper function to create rgba colors with opacity
 */
export const rgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default colors
