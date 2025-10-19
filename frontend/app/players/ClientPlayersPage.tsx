'use client'

import { useState, useEffect } from 'react'

export default function ClientPlayersPage() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    // Dynamically import the full players page only on client
    import('./page').then(module => {
      // This will load the players page content
    })
  }, [isClient])

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
          <div style={{ marginBottom: '1rem' }}>🎳</div>
          <div>Loading player management...</div>
        </div>
      </div>
    )
  }

  // Once client is ready, we can safely render
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
        <div style={{ marginBottom: '1rem' }}>🎳</div>
        <div>Initializing player management system...</div>
      </div>
    </div>
  )
}