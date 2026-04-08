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
    const check = () => setIsMobile(window.innerWidth <= 480)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      borderRadius: '20px',
      textAlign: 'center',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
      border: '2px solid #e2e8f0',
      maxWidth: '800px',
      padding: isMobile ? '40px 24px' : '60px 40px',
      margin: isMobile ? '20px 0' : '40px auto',
    }}>
      <h2 style={{
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: '12px',
        letterSpacing: '-0.02em',
        marginTop: '24px',
        fontSize: isMobile ? '22px' : '28px',
      }}>
        No Tournament Loaded
      </h2>

      <p style={{
        color: '#64748b',
        margin: '0 auto 32px',
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
          background: 'linear-gradient(135deg, #F47C20 0%, #D9651A 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(244, 124, 32, 0.3)',
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
          marginTop: '48px',
          maxWidth: '800px',
          margin: '48px auto 0',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        }}>
          {cards.map((card, i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              border: '1px solid #e2e8f0',
            }}>
              <h3 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '4px',
                margin: '0 0 4px',
              }}>
                {card.title}
              </h3>
              <p style={{
                fontSize: '13px',
                color: '#64748b',
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
  )
}
