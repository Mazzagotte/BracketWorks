'use client'
import { useState, useEffect, FC, ReactNode } from 'react'
import Link from 'next/link'
import { typography, colors, spacing, stylePresets, utils, borderRadius } from '../lib/design-system'

interface HeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: ReactNode
  centerContent?: boolean
  showBackButton?: boolean
  backHref?: string
  className?: string
}

const UniformHeader: FC<HeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  centerContent = false,
  showBackButton = false,
  backHref = '/',
  className = ''
}) => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <header 
      style={{
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: `${spacing.lg} 0`,
        marginBottom: spacing.xl,
      }}
      className={className}
    >
      <div style={{
        maxWidth: stylePresets.contentWrapper.maxWidth,
        margin: '0 auto',
        padding: `0 ${spacing.lg}`,
      }}>
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav 
            style={{
              marginBottom: spacing.md,
              fontSize: typography.fontSize.sm,
              color: colors.text.secondary,
            }}
            aria-label="Breadcrumb"
          >
            <ol style={{
              ...utils.flexRow,
              gap: spacing.xs,
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}>
              {breadcrumbs.map((crumb, index) => (
                <li key={index} style={utils.flexRow}>
                  {index > 0 && (
                    <span style={{ margin: `0 ${spacing.xs}` }}>
                      →
                    </span>
                  )}
                  {crumb.href ? (
                    <Link 
                      href={crumb.href}
                      style={{
                        color: colors.primary,
                        textDecoration: 'none',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span style={{ color: colors.text.primary, fontWeight: typography.fontWeight.medium }}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Main header content */}
        <div style={{
          display: 'flex',
          alignItems: centerContent ? 'center' : 'flex-start',
          justifyContent: 'space-between',
          flexDirection: centerContent ? 'column' : 'row',
          gap: spacing.lg,
          flexWrap: 'wrap',
        }}>
          {/* Title section */}
          <div style={{
            textAlign: centerContent ? 'center' : 'left',
            flex: '1',
          }}>
            {/* Back button */}
            {showBackButton && (
              <Link 
                href={backHref}
                style={{
                  ...utils.flexRow,
                  gap: spacing.xs,
                  color: colors.primary,
                  textDecoration: 'none',
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  marginBottom: spacing.md,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: `${spacing.xs} ${spacing.sm}`,
                  borderRadius: borderRadius.md,
                  transition: 'background-color 0.2s ease',
                }}
              >
                ← Back
              </Link>
            )}

            <h1 style={{
              fontSize: isMobile ? typography.fontSize['2xl'] : typography.fontSize['3xl'],
              fontWeight: typography.fontWeight.bold,
              color: colors.text.primary,
              margin: 0,
              lineHeight: typography.lineHeight.tight,
            }}>
              {title}
            </h1>
            
            {subtitle && (
              <p style={{
                fontSize: isMobile ? typography.fontSize.base : typography.fontSize.lg,
                color: colors.text.secondary,
                margin: `${spacing.sm} 0 0 0`,
                lineHeight: typography.lineHeight.normal,
              }}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Actions section */}
          {actions && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
              flexWrap: 'wrap',
              justifyContent: centerContent ? 'center' : 'flex-end',
            }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default UniformHeader