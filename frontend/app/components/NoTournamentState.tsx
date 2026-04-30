'use client'

import { useState, useEffect } from 'react'

interface InfoCard {
  title: string
  text: string
}

interface NoTournamentStateProps {
  description?: string
  cards?: InfoCard[]
}

export default function NoTournamentState({ description, cards }: NoTournamentStateProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'auto',
      width: '100%',
      boxSizing: 'border-box',
      padding: '16px',
    }}>
    <div style={{
      background: 'var(--color-brand-ivory-light)',
      borderRadius: '16px',
      textAlign: 'center',
      boxShadow: 'var(--shadow-soft)',
      border: '1px solid var(--color-border-light)',
      maxWidth: '800px',
      width: '100%',
      padding: '14px 20px 18px',
    }}>
      <h2 style={{
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        marginBottom: '12px',
        letterSpacing: '-0.02em',
        marginTop: '0',
        fontSize: isMobile ? '22px' : '28px',
      }}>
        No Tournament Loaded
      </h2>

      <p style={{
        color: 'var(--color-text-secondary)',
        margin: '0 auto 16px',
        lineHeight: 1.6,
        maxWidth: '560px',
        fontSize: isMobile ? '15px' : '16px',
      }}>
        {description ?? 'Select a tournament from the dashboard to get started.'}
      </p>

      <a
        href="/dashboard"
        style={{
          display: 'inline-block',
          background: 'var(--gradient-brand)',
          color: 'var(--color-white)',
          border: 'none',
          borderRadius: '12px',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: 'var(--shadow-brand-md)',
          transition: 'all 0.2s ease',
          padding: isMobile ? '12px 24px' : '14px 28px',
          fontSize: isMobile ? '15px' : '16px',
        }}
      >
        Go to Dashboard
      </a>

      {cards && cards.length > 0 && (
        <div style={{
          gap: '16px',
          marginTop: '20px',
          maxWidth: '800px',
          margin: '20px auto 0',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        }}>
          {cards.map((card, i) => (
            <div key={i} style={{
              background: 'var(--color-brand-ivory-light)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              border: '1px solid var(--color-border-light)',
            }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: '4px',
                margin: '0 0 4px',
              }}>
                {card.title}
              </h3>
              <p style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
                margin: 0,
              }}>
                {card.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
