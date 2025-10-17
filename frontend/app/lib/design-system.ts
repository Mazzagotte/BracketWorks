/**
 * BracketWorks Design System
 * Consistent styling constants and utilities
 */

// Typography Scale
export const typography = {
  // Font families
  fontFamily: {
    primary: 'var(--font-family-primary)',
  },
  
  // Font sizes - mobile-first responsive
  fontSize: {
    xs: 'var(--font-size-xs)',     // 12px
    sm: 'var(--font-size-sm)',     // 14px  
    base: 'var(--font-size-base)', // 16px
    lg: 'var(--font-size-lg)',     // 18px
    xl: 'var(--font-size-xl)',     // 20px
    '2xl': 'var(--font-size-2xl)', // 24px
    '3xl': 'var(--font-size-3xl)', // 28px
    '4xl': 'var(--font-size-4xl)', // 32px
  },
  
  // Font weights
  fontWeight: {
    normal: 'var(--font-weight-normal)',     // 400
    medium: 'var(--font-weight-medium)',     // 500
    semibold: 'var(--font-weight-semibold)', // 600
    bold: 'var(--font-weight-bold)',         // 700
  },
  
  // Line heights
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  }
} as const

// Color palette
export const colors = {
  // Primary brand colors
  primary: 'var(--color-primary)',           // #4f8cff
  primaryLight: 'var(--color-primary-light)', // #6ed0fa
  primaryHover: '#2563eb',                   // Darker blue for hovers
  accent: 'var(--color-accent)',             // #ffd580
  
  // Background colors
  background: 'var(--color-background)',     // #f8fafc
  surface: 'var(--color-surface)',           // #ffffff
  surfaceHover: '#f9fafb',                   // Light gray hover
  
  // Text colors
  text: {
    primary: 'var(--color-text-primary)',   // #1a1f2e
    secondary: 'var(--color-text-secondary)', // #6b7280
    muted: '#888888',                        // Muted text
    light: '#aaaaaa',                        // Light text
    white: '#ffffff',                        // White text
  },
  
  // Border colors  
  border: 'var(--color-border)',             // #e5e7eb
  borderLight: 'var(--color-border-light)',  // rgba(240, 165, 0, 0.2)
  borderHover: '#9ca3af',                    // Darker border on hover
  
  // Status colors
  success: 'var(--color-success)',           // #10b981
  successHover: '#059669',                   // Darker green
  warning: 'var(--color-warning)',           // #f59e0b
  warningLight: '#ff9800',                   // Light orange
  error: 'var(--color-error)',               // #ef4444
  errorLight: '#e74c3c',                     // Light red
  info: '#3b82f6',                          // Blue info
  
  // State colors for backgrounds
  backgrounds: {
    error: '#fef2f2',                        // Light red background
    errorBorder: '#fecaca',                  // Red border
    success: '#f0fdf4',                      // Light green background
    warning: '#fef3c7',                      // Light yellow background
    info: '#f0f9ff',                        // Light blue background
    primary: '#dbeafe',                      // Light primary background
  },
  
  // Neutral grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6', 
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Specific component colors
  button: {
    primary: 'var(--color-primary)',
    primaryHover: '#2563eb',
    success: 'var(--color-success)', 
    successHover: '#059669',
    error: 'var(--color-error)',
    errorHover: '#dc2626',
    secondary: 'var(--color-surface)',
    secondaryHover: '#f3f4f6',
  },
  
  // Shadow colors
  shadow: {
    sm: 'rgba(35, 43, 54, 0.08)',
    md: 'rgba(35, 43, 54, 0.12)',
    lg: 'rgba(79, 140, 255, 0.2)',
    dark: 'rgba(35, 43, 54, 0.25)',
  }
} as const

// Spacing scale
export const spacing = {
  xs: 'var(--spacing-xs)',   // 4px
  sm: 'var(--spacing-sm)',   // 8px
  md: 'var(--spacing-md)',   // 16px
  lg: 'var(--spacing-lg)',   // 24px
  xl: 'var(--spacing-xl)',   // 32px
  '2xl': 'var(--spacing-2xl)', // 48px
} as const

// Border radius
export const borderRadius = {
  sm: 'var(--radius-sm)',   // 6px
  md: 'var(--radius-md)',   // 8px
  lg: 'var(--radius-lg)',   // 12px
  xl: 'var(--radius-xl)',   // 16px
  '2xl': 'var(--radius-2xl)', // 24px
  full: 'var(--radius-full)', // 9999px
} as const

// Shadows
export const shadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const

// Layout constants
export const layout = {
  containerMaxWidth: 'var(--container-max-width)', // 1200px
  contentMaxWidth: 'var(--content-max-width)',     // 1200px
  sidebarWidth: '280px',
  headerHeight: '64px',
  mobileBreakpoint: '768px',
  tabletBreakpoint: '1024px',
  desktopBreakpoint: '1280px',
} as const

// Component style presets
export const stylePresets = {
  // Page container
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: colors.background,
  },
  
  // Content wrapper
  contentWrapper: {
    maxWidth: layout.contentMaxWidth,
    margin: '0 auto',
    padding: spacing.lg,
  },
  
  // Page header
  pageHeader: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center' as const,
  },
  
  // Section header  
  sectionHeader: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  
  // Card container
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    boxShadow: shadows.sm,
    marginBottom: spacing.lg,
  },
  
  // Button styles
  button: {
    primary: {
      backgroundColor: colors.primary,
      color: colors.surface,
      padding: `${spacing.sm} ${spacing.lg}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    secondary: {
      backgroundColor: colors.surface,
      color: colors.text.primary,
      padding: `${spacing.sm} ${spacing.lg}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      border: `1px solid ${colors.border}`,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
  },
  
  // Form input
  input: {
    width: '100%',
    padding: spacing.sm,
    fontSize: typography.fontSize.base,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    color: colors.text.primary,
    transition: 'border-color 0.2s ease',
  },
  
  // Table styles
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    boxShadow: shadows.sm,
    border: `1px solid ${colors.border}`,
  },
  
  tableHeader: {
    backgroundColor: colors.gray[50],
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'left' as const,
    padding: `${spacing.md} ${spacing.lg}`,
    borderBottom: `2px solid ${colors.border}`,
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  
  tableCell: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    borderBottom: `1px solid ${colors.border}`,
    verticalAlign: 'middle' as const,
  },

  // Table variants
  tableVariants: {
    striped: {
      row: {
        '&:nth-child(even)': {
          backgroundColor: colors.gray[50],
        }
      }
    },
    bordered: {
      cell: {
        border: `1px solid ${colors.border}`,
      }
    },
    compact: {
      header: {
        padding: `${spacing.sm} ${spacing.md}`,
        fontSize: typography.fontSize.xs,
      },
      cell: {
        padding: `${spacing.sm} ${spacing.md}`,
        fontSize: typography.fontSize.xs,
      }
    },
    comfortable: {
      header: {
        padding: `${spacing.lg} ${spacing.xl}`,
        fontSize: typography.fontSize.base,
      },
      cell: {
        padding: `${spacing.lg} ${spacing.xl}`,
        fontSize: typography.fontSize.base,
      }
    }
  },

  // Table row states
  tableRowStates: {
    hover: {
      backgroundColor: colors.gray[50],
      transition: 'background-color 0.15s ease',
    },
    selected: {
      backgroundColor: colors.primary + '10', // 10% opacity
      borderLeft: `3px solid ${colors.primary}`,
    },
    success: {
      backgroundColor: colors.backgrounds.success,
      borderLeft: `3px solid ${colors.success}`,
    },
    warning: {
      backgroundColor: colors.backgrounds.warning,
      borderLeft: `3px solid ${colors.warning}`,
    },
    error: {
      backgroundColor: colors.backgrounds.error,
      borderLeft: `3px solid ${colors.error}`,
    }
  },
} as const

// Responsive utilities
export const responsive = {
  mobile: `@media (max-width: ${layout.mobileBreakpoint})`,
  tablet: `@media (min-width: ${layout.mobileBreakpoint}) and (max-width: ${layout.tabletBreakpoint})`,
  desktop: `@media (min-width: ${layout.desktopBreakpoint})`,
  
  // Grid templates
  grid: {
    autoFit: 'repeat(auto-fit, minmax(280px, 1fr))',
    columns2: 'repeat(2, 1fr)',
    columns3: 'repeat(3, 1fr)',
    columns4: 'repeat(4, 1fr)',
  },
  
  // Common breakpoint values
  breakpoints: {
    sm: '640px',
    md: '768px', 
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const

// Animation and transition presets
export const animations = {
  transition: {
    fast: '0.15s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },
  
  hover: {
    scale: 'transform: scale(1.02)',
    shadow: `box-shadow: ${shadows.md}`,
  },
} as const

// Utility functions
export const utils = {
  // Create consistent spacing
  spacing: (multiplier: number) => `calc(${spacing.md} * ${multiplier})`,
  
  // Center content
  centerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Flex utilities
  flexColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  flexRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  
  // Text utilities
  textCenter: {
    textAlign: 'center' as const,
  },
  
  textTruncate: {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  
  // Visual utilities
  visuallyHidden: {
    position: 'absolute' as const,
    left: '-9999px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  },
} as const

export default {
  typography,
  colors,
  spacing,
  borderRadius,
  shadows,
  layout,
  stylePresets,
  responsive,
  animations,
  utils,
}