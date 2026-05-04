import React from 'react'
import { handleTableArrowNavigation } from '../lib/tableKeyboard'

// Page Container Component
interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => (
  <div 
    className={`bw-ui-page-container ${className}`}
  >
    {children}
  </div>
)

// Content Wrapper Component
interface ContentWrapperProps {
  children: React.ReactNode
  className?: string
}

export const ContentWrapper: React.FC<ContentWrapperProps> = ({ 
  children, 
  className = '' 
}) => (
  <div 
    className={`bw-ui-content-wrapper ${className}`}
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
    className={`bw-ui-ph-wrap ${centered ? 'bw-ui-ph-center' : ''} ${className}`}
  >
    <h1 className="bw-ui-ph-title">
      {title}
    </h1>
    {subtitle && (
      <p className="bw-ui-ph-subtitle">
        {subtitle}
      </p>
    )}
    {actions && (
      <div className={`bw-ui-ph-actions ${centered ? 'bw-ui-ph-actions-center' : ''}`}>
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
    className={`bw-ui-sh-wrap ${className}`}
  >
    <div>
      <h2 className="bw-ui-sh-title">
        {title}
      </h2>
      {subtitle && (
        <p className="bw-ui-sh-subtitle">
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div className="bw-ui-sh-actions">
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
  noPadding?: boolean
}

export const Card: React.FC<CardProps> = React.memo(({ 
  children, 
  title,
  className = '',
  noPadding = false
}) => (
  <div 
    className={`bw-ui-card ${noPadding ? 'bw-ui-card-no-padding' : ''} ${className}`}
  >
    {title && (
      <h3 className="bw-ui-card-title">
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
  className?: string
}

export const Grid: React.FC<GridProps> = ({ 
  children, 
  columns = 'auto-fit',
  className = '' 
}) => (
  <div 
    className={`bw-grid bw-grid-cols-${columns} ${className}`}
  >
    {children}
  </div>
)

// Stat Card Component
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'primary' | 'success' | 'warning' | 'error' | 'default'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = React.memo(function StatCard({ 
  title, 
  value, 
  subtitle,
  icon,
  color = 'default',
  className = '' 
}) {
  return (
    <div 
      className={`bw-stat-card bw-stat-card-${color} ${className}`}
    >
      {icon && (
        <div className="bw-stat-card-icon">
          {icon}
        </div>
      )}
      <div className="bw-stat-card-value">
        {value}
      </div>
      <div className="bw-stat-card-label">
        {title}
      </div>
      {subtitle && (
        <div className="bw-stat-card-subtitle">
          {subtitle}
        </div>
      )}
    </div>
  )
})

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
    className={`ds-btn ds-btn-${variant} ds-btn-${size} ${fullWidth ? 'bw-btn-full' : ''} ${className}`}
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
  <div className="bw-ui-table-wrap">
    <table 
      className={`bw-ui-table ${variant === 'bordered' ? 'bw-ui-table-bordered' : ''} ${className} ${hoverable ? 'table-hoverable' : ''}`}
      onKeyDownCapture={handleTableArrowNavigation}
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
}) => (
  <tr 
    className={`bw-ui-tr ${state !== 'default' ? `bw-ui-tr-${state}` : ''} ${onClick ? 'bw-ui-tr-clickable' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
)

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
  const baseClass = header ? 'bw-ui-th' : 'bw-ui-td'
  const variantClass = variant !== 'default' ? `bw-ui-tc-${variant}` : ''
  const sortableClass = sortable ? 'bw-ui-tc-sortable' : ''
  const handleClick = sortable && onSort ? onSort : undefined

  return (
    <Component 
      style={Object.keys(customStyle).length > 0 ? customStyle : undefined}
      className={`${baseClass} bw-ui-tc-${align} ${variantClass} ${sortableClass} ${className}`}
      onClick={handleClick}
    >
      <div className="bw-ui-tc-inner">
        {children}
        {sortable && (
          <span className="bw-ui-tc-sort-hint">
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
  <div className={`form-field ${className}`}>
    {label && (
      <label className="form-label">
        {label}
        {required && <span className="form-required">*</span>}
      </label>
    )}
    {children}
    {error && (
      <div className="form-error">
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
  const sizeClass = size !== 'md' ? `size-${size}` : ''
  const iconClass = icon ? `has-icon-${iconPosition}` : ''
  const errorClass = error ? 'is-error' : ''

  return (
    <div className="input-wrapper">
      {icon && (
        <span className={`input-icon ${iconPosition}`}>{icon}</span>
      )}
      <input
        type={type}
        value={value}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`enhanced-input ${sizeClass} ${iconClass} ${errorClass} ${className}`.trim()}
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
  const sizeClass = size !== 'md' ? `size-${size}` : ''
  const errorClass = error ? 'is-error' : ''

  return (
    <select
      value={value}
      name={name}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={`enhanced-select ${sizeClass} ${errorClass} ${className}`.trim()}
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

