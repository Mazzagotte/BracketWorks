'use client'

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { useState, useEffect } from 'react'

export default function PlayersPage() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🎳</div>
          <div>Loading player management...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(240, 165, 0, 0.12)',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          color: '#f0a500', 
          marginBottom: '1rem',
          fontSize: '2rem'
        }}>
          🎳 Player Management
        </h1>
        <p style={{ 
          color: '#6b7280', 
          marginBottom: '2rem' 
        }}>
          The player management system is being updated to resolve deployment issues.
        </p>
        <div style={{
          background: 'rgba(240, 165, 0, 0.1)',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid rgba(240, 165, 0, 0.2)'
        }}>
          <p style={{ color: '#d97706', margin: 0 }}>
            ⚠️ Temporarily simplified for deployment stability
          </p>
        </div>
      </div>
    </div>
  );
}