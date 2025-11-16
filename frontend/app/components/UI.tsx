import React from 'react'
import { stylePresets, colors, spacing, typography, borderRadius, shadows, utils } from '../lib/design-system'

// Page Container Component
interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => (
  <div 
    style={stylePresets.pageContainer}
    className={className}
  >
    {children}
  </div>
)

// Content Wrapper Component
interface ContentWrapperProps {
  children: React.ReactNode
  maxWidth?: string
  padding?: string
  className?: string
}

export const ContentWrapper: React.FC<ContentWrapperProps> = ({ 
  children, 
  maxWidth = stylePresets.contentWrapper.maxWidth,
  padding = stylePresets.contentWrapper.padding,
  className = '' 
}) => (
  <div 
    style={{
      ...stylePresets.contentWrapper,
      maxWidth,
      padding,
    }}
    className={className}
  >
    {children}
  </div>
)

// Page Header Component
interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  centered?: boolean
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  actions, 
  centered = true,
  className = '' 
}) => (
  <div 
    style={{
      marginBottom: spacing.xl,
      textAlign: centered ? 'center' : 'left',
    }}
    className={className}
  >
    <h1 style={stylePresets.pageHeader}>
      {title}
    </h1>
    {subtitle && (
      <p style={{
        fontSize: typography.fontSize.lg,
        color: colors.text.secondary,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        lineHeight: typography.lineHeight.normal,
      }}>
        {subtitle}
      </p>
    )}
    {actions && (
      <div style={{
        marginTop: spacing.lg,
        ...utils.flexRow,
        justifyContent: centered ? 'center' : 'flex-start',
        gap: spacing.md,
        flexWrap: 'wrap',
      }}>
        {actions}
      </div>
    )}
  </div>
)

// Section Header Component
interface SectionHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
  title, 
  subtitle, 
  actions,
  className = '' 
}) => (
  <div 
    style={{
      ...utils.flexRow,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
      flexWrap: 'wrap',
      gap: spacing.md,
    }}
    className={className}
  >
    <div>
      <h2 style={stylePresets.sectionHeader}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          fontSize: typography.fontSize.base,
          color: colors.text.secondary,
          marginTop: spacing.xs,
          lineHeight: typography.lineHeight.normal,
        }}>
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div style={{
        ...utils.flexRow,
        gap: spacing.sm,
        flexWrap: 'wrap',
      }}>
        {actions}
      </div>
    )}
  </div>
)

// Card Component
interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
  padding?: string
  noPadding?: boolean
}

export const Card: React.FC<CardProps> = React.memo(({ 
  children, 
  title,
  className = '',
  padding = stylePresets.card.padding,
  noPadding = false
}) => (
  <div 
    style={{
      ...stylePresets.card,
      padding: noPadding ? '0' : padding,
    }}
    className={className}
  >
    {title && (
      <h3 style={{
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.semibold,
        color: colors.text.primary,
        marginBottom: spacing.lg,
        marginTop: '0',
      }}>
        {title}
      </h3>
    )}
    {children}
  </div>
))

// Grid Container Component
interface GridProps {
  children: React.ReactNode
  columns?: 'auto-fit' | '2' | '3' | '4' | string
  gap?: string
  className?: string
}

export const Grid: React.FC<GridProps> = ({ 
  children, 
  columns = 'auto-fit',
  gap = spacing.lg,
  className = '' 
}) => {
  const getGridTemplate = () => {
    switch (columns) {
      case 'auto-fit': return 'repeat(auto-fit, minmax(280px, 1fr))'
      case '2': return 'repeat(2, 1fr)'
      case '3': return 'repeat(3, 1fr)'  
      case '4': return 'repeat(4, 1fr)'
      default: return columns
    }
  }

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: getGridTemplate(),
        gap,
      }}
      className={className}
    >
      {children}
    </div>
  )
}

// Stat Card Component
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'primary' | 'success' | 'warning' | 'error' | 'default'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = React.memo(({ 
  title, 
  value, 
  subtitle,
  icon,
  color = 'default',
  className = '' 
}) => {
  const getColorStyles = () => {
    switch (color) {
      case 'primary':
        return {
          backgroundColor: '#dbeafe',
          borderLeft: `4px solid ${colors.primary}`,
          valueColor: colors.primary,
        }
      case 'success':
        return {
          backgroundColor: '#d1fae5',
          borderLeft: `4px solid ${colors.success}`,
          valueColor: colors.success,
        }
      case 'warning':
        return {
          backgroundColor: '#fef3c7',
          borderLeft: `4px solid ${colors.warning}`,
          valueColor: colors.warning,
        }
      case 'error':
        return {
          backgroundColor: '#fee2e2',
          borderLeft: `4px solid ${colors.error}`,
          valueColor: colors.error,
        }
      default:
        return {
          backgroundColor: colors.surface,
          borderLeft: `4px solid ${colors.border}`,
          valueColor: colors.text.primary,
        }
    }
  }

  const colorStyles = getColorStyles()

  return (
    <div 
      style={{
        ...stylePresets.card,
        ...colorStyles,
        textAlign: 'center',
      }}
      className={className}
    >
      {icon && (
        <div style={{
          fontSize: typography.fontSize['2xl'],
          marginBottom: spacing.sm,
        }}>
          {icon}
        </div>
      )}
      <div style={{
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.bold,
        color: colorStyles.valueColor,
        marginBottom: spacing.xs,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        fontWeight: typography.fontWeight.medium,
        marginBottom: subtitle ? spacing.xs : 0,
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: typography.fontSize.xs,
          color: colors.text.secondary,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
})

// Button Component (enhanced)
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  fullWidth?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export const Button: React.FC<ButtonProps> = ({ 
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return stylePresets.button.primary
      case 'secondary':
        return stylePresets.button.secondary
      case 'success':
        return {
          ...stylePresets.button.primary,
          backgroundColor: colors.success,
        }
      case 'warning':
        return {
          ...stylePresets.button.primary,
          backgroundColor: colors.warning,
        }
      case 'error':
        return {
          ...stylePresets.button.primary,
          backgroundColor: colors.error,
        }
      default:
        return stylePresets.button.primary
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          padding: `${spacing.xs} ${spacing.md}`,
          fontSize: typography.fontSize.sm,
        }
      case 'lg':
        return {
          padding: `${spacing.md} ${spacing.xl}`,
          fontSize: typography.fontSize.lg,
        }
      default:
        return {}
    }
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      className={className}
    >
      {children}
    </button>
  )
}

// Table Component
// Table Components with enhanced styling
interface TableProps {
  children: React.ReactNode
  variant?: 'default' | 'striped' | 'bordered' | 'compact' | 'comfortable'
  className?: string
  hoverable?: boolean
}

export const Table: React.FC<TableProps> = ({ 
  children, 
  variant = 'default',
  className = '',
  hoverable = true
}) => (
  <div style={{ overflowX: 'auto', borderRadius: borderRadius.lg }}>
    <table 
      style={{
        ...stylePresets.table,
        ...(variant === 'bordered' && { border: `1px solid ${colors.border}` })
      }} 
      className={`${className} ${hoverable ? 'table-hoverable' : ''}`}
      data-variant={variant}
    >
      {children}
    </table>
  </div>
)

interface TableHeaderProps {
  children: React.ReactNode
  className?: string
  sticky?: boolean
}

export const TableHeader: React.FC<TableHeaderProps> = ({ 
  children, 
  className = '',
  sticky = true 
}) => (
  <thead className={className}>
    {children}
  </thead>
)

interface TableBodyProps {
  children: React.ReactNode
  className?: string
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => (
  <tbody className={className}>
    {children}
  </tbody>
)

interface TableRowProps {
  children: React.ReactNode
  className?: string
  state?: 'default' | 'selected' | 'success' | 'warning' | 'error'
  onClick?: () => void
}

export const TableRow: React.FC<TableRowProps> = ({ 
  children, 
  className = '',
  state = 'default',
  onClick
}) => {
  const rowStyle: React.CSSProperties = {
    cursor: onClick ? 'pointer' : 'default',
    transition: 'background-color 0.15s ease',
    ...(state !== 'default' && stylePresets.tableRowStates[state])
  }

  return (
    <tr 
      style={rowStyle}
      className={className}
      onClick={onClick}
      onMouseEnter={onClick ? (changeEvent) => { changeEvent.currentTarget.style.backgroundColor = colors.gray[50]
      } : undefined}
      onMouseLeave={onClick ? (changeEvent) => { changeEvent.currentTarget.style.backgroundColor = state !== 'default' ? stylePresets.tableRowStates[state].backgroundColor : 'transparent'
      } : undefined}
    >
      {children}
    </tr>
  )
}

interface TableCellProps {
  children: React.ReactNode
  header?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
  style?: React.CSSProperties
  variant?: 'default' | 'compact' | 'comfortable'
  sortable?: boolean
  onSort?: () => void
  sortDirection?: 'asc' | 'desc' | null
}

export const TableCell: React.FC<TableCellProps> = ({ 
  children, 
  header = false,
  align = 'left',
  className = '',
  style: customStyle = {},
  variant = 'default',
  sortable = false,
  onSort,
  sortDirection = null
}) => {
  const Component = header ? 'th' : 'td'
  
  const baseStyle = header ? stylePresets.tableHeader : stylePresets.tableCell
  
  // Create variant overrides
  let variantOverrides: React.CSSProperties = {}
  if (variant === 'compact') {
    const compactStyle = stylePresets.tableVariants.compact[header ? 'header' : 'cell']
    variantOverrides = {
      padding: compactStyle.padding,
      fontSize: compactStyle.fontSize
    }
  } else if (variant === 'comfortable') {
    const comfortableStyle = stylePresets.tableVariants.comfortable[header ? 'header' : 'cell']
    variantOverrides = {
      padding: comfortableStyle.padding,
      fontSize: comfortableStyle.fontSize
    }
  }

  const style: React.CSSProperties = { 
    ...baseStyle, 
    ...variantOverrides,
    textAlign: align,
    cursor: sortable ? 'pointer' : 'default',
    userSelect: sortable ? 'none' : 'auto',
    ...customStyle, // Apply custom styles last to override defaults
  }

  const handleClick = sortable && onSort ? onSort : undefined

  return (
    <Component 
      style={style} 
      className={className}
      onClick={handleClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
        {children}
        {sortable && (
          <span style={{ 
            fontSize: typography.fontSize.xs,
            color: colors.text.secondary,
            marginLeft: 'auto'
          }}>
            {sortDirection === 'asc' ? ' (Low-High)' : sortDirection === 'desc' ? ' (High-Low)' : ''}
          </span>
        )}
      </div>
    </Component>
  )
}

// Form Components
interface FormFieldProps {
  label?: string
  children: React.ReactNode
  error?: string
  required?: boolean
  className?: string
}

export const FormField: React.FC<FormFieldProps> = ({ 
  label, 
  children, 
  error, 
  required = false, 
  className = '' 
}) => (
  <div className={`form-field ${className}`} style={{ marginBottom: spacing.md }}>
    {label && (
      <label 
        className="form-label"
        style={{
          display: 'block',
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: colors.text.primary,
          marginBottom: spacing.xs
        }}
      >
        {label}
        {required && <span style={{ color: colors.error, marginLeft: '2px' }}>*</span>}
      </label>
    )}
    {children}
    {error && (
      <div 
        className="form-error"
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.error,
          marginTop: spacing.xs
        }}
      >
        {error}
      </div>
    )}
  </div>
)

interface InputProps {
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'datetime-local' | 'time'
  disabled?: boolean
  required?: boolean
  className?: string
  icon?: string
  iconPosition?: 'left' | 'right'
  error?: boolean
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  required = false,
  className = '',
  icon,
  iconPosition = 'left',
  error = false
}) => {
  const inputStyle = {
    width: '100%',
    padding: icon ? 
      (iconPosition === 'left' ? `${spacing.sm} ${spacing.md} ${spacing.sm} ${spacing.xl}` : `${spacing.sm} ${spacing.xl} ${spacing.sm} ${spacing.md}`) :
      `${spacing.sm} ${spacing.md}`,
    border: `1px solid ${error ? colors.error : colors.border}`,
    borderRadius: '8px',
    fontSize: typography.fontSize.base,
    backgroundColor: disabled ? colors.gray[50] : colors.surface,
    color: colors.text.primary,
    transition: 'all 0.2s ease',
    outline: 'none'
  }

  const containerStyle = {
    position: 'relative' as const,
    display: 'inline-block',
    width: '100%'
  }

  const iconStyle = {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    [iconPosition]: spacing.md,
    color: colors.text.secondary,
    pointerEvents: 'none' as const,
    fontSize: typography.fontSize.base
  }

  return (
    <div style={containerStyle}>
      {icon && <span style={iconStyle}>{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`enhanced-input ${className}`}
        style={inputStyle}
        onFocus={(changeEvent) => { 
          changeEvent.target.style.borderColor = colors.primary;
          changeEvent.target.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
        }}
        onBlur={(changeEvent) => { 
          changeEvent.target.style.borderColor = error ? colors.error : colors.border;
          changeEvent.target.style.boxShadow = 'none';
        }}
      />
    </div>
  )
}

interface SelectProps {
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: Array<{ value: string | number; label: string }>
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  error?: boolean
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  className = '',
  error = false
}) => {
  const selectStyle = {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    border: `1px solid ${error ? colors.error : colors.border}`,
    borderRadius: '8px',
    fontSize: typography.fontSize.base,
    backgroundColor: disabled ? colors.gray[50] : colors.surface,
    color: colors.text.primary,
    transition: 'all 0.2s ease',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer'
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={`enhanced-select ${className}`}
      style={selectStyle}
      onFocus={(changeEvent) => { 
        changeEvent.target.style.borderColor = colors.primary;
        changeEvent.target.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
      }}
      onBlur={(changeEvent) => { 
        changeEvent.target.style.borderColor = error ? colors.error : colors.border;
        changeEvent.target.style.boxShadow = 'none';
      }}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

