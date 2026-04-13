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
Card.displayName = 'Card'

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
          backgroundColor: 'rgba(244, 124, 32, 0.08)',
          borderLeft: `4px solid var(--color-primary)`,
          valueColor: 'var(--color-primary)',
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

StatCard.displayName = 'StatCard'

// Button Component
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  fullWidth?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button',
  icon,
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{ width: fullWidth ? '100%' : undefined }}
    className={`ds-btn ds-btn-${variant} ds-btn-${size} ${className}`}
  >
    {icon}
    {children}
  </button>
)

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
  name?: string
  className?: string
  icon?: string
  iconPosition?: 'left' | 'right'
  error?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  required = false,
  name,
  className = '',
  icon,
  iconPosition = 'left',
  error = false,
  size = 'md',
}) => {
  const heights = { sm: 'var(--input-height-sm)', md: 'var(--input-height)', lg: 'var(--input-height-lg)' }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: heights[size],
    padding: icon
      ? (iconPosition === 'left' ? '0 var(--spacing-md) 0 var(--spacing-xl)' : '0 var(--spacing-xl) 0 var(--spacing-md)')
      : '0 var(--spacing-md)',
    border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-gray-200)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-base)',
    backgroundColor: disabled ? 'var(--color-gray-50)' : '#ffffff',
    color: 'var(--color-text-primary)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      {icon && (
        <span style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          [iconPosition]: 'var(--spacing-md)',
          color: 'var(--color-text-secondary)',
          pointerEvents: 'none',
          fontSize: 'var(--font-size-base)',
        }}>{icon}</span>
      )}
      <input
        type={type}
        value={value}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`enhanced-input ${className}`}
        style={inputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--color-primary)';
          e.target.style.boxShadow = '0 0 0 3px rgba(244, 124, 32, 0.15)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'var(--color-error)' : 'var(--color-gray-200)';
          e.target.style.boxShadow = 'none';
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
  name?: string
  className?: string
  error?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  name,
  className = '',
  error = false,
  size = 'md',
}) => {
  const heights = { sm: 'var(--input-height-sm)', md: 'var(--input-height)', lg: 'var(--input-height-lg)' }
  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: heights[size],
    padding: '0 var(--spacing-md)',
    border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-gray-200)'}`,
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-base)',
    backgroundColor: disabled ? 'var(--color-gray-50)' : '#ffffff',
    color: 'var(--color-text-primary)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxSizing: 'border-box',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235E6B75' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px',
  }

  return (
    <select
      value={value}
      name={name}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={`enhanced-select ${className}`}
      style={selectStyle}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--color-primary)';
        e.target.style.boxShadow = '0 0 0 3px rgba(244, 124, 32, 0.15)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error ? 'var(--color-error)' : 'var(--color-gray-200)';
        e.target.style.boxShadow = 'none';
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

