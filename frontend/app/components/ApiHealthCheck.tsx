'use client'

import { useState, useEffect } from 'react'

import { API } from '../lib/api'
import { getErrorMessage } from '../lib/error-utils'



export function ApiHealthCheck() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'failed'>('checking')
  const [backendUrl, setBackendUrl] = useState('')
  const [error, setError] = useState('')
  
  useEffect(() => {
    const checkHealth = async () => {
      const url = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      setBackendUrl(url)
      
      try {
        const response = await fetch(API('/api/v1/health'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          setStatus('connected')
        } else {
          setStatus('failed')
          setError(`HTTP ${response.status}: ${response.statusText}`)
        }
            } catch (err: unknown) {
        setStatus('failed')
        setError(getErrorMessage(err) || 'Network error')
      }
    }
    
    checkHealth()
  }, [])
  
  const getStatusColor = () => {
    switch (status) {
      case 'checking': return 'var(--color-warning-amber)'
      case 'connected': return 'var(--color-success)'
      case 'failed': return 'var(--color-error)'
      default: return 'var(--color-text-secondary)'
    }
  }
  
  const getStatusIcon = () => {
    switch (status) {
      case 'checking': return '⏳'
      case 'connected': return ''
      case 'failed': return ''
      default: return '❓'
    }
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'var(--color-surface)',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: 'var(--shadow-md)',
      border: `2px solid ${getStatusColor()}`,
      fontSize: '12px',
      minWidth: '200px',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ marginRight: '8px' }}>{getStatusIcon()}</span>
        <strong style={{ color: getStatusColor() }}>
          API Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </strong>
      </div>
      
      <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
        Backend: {backendUrl}
      </div>
      
      {error && (
        <div style={{ 
          color: 'var(--color-error)', 
          fontSize: '11px',
          marginTop: '4px',
          wordBreak: 'break-word'
        }}>
          Error: {error}
        </div>
      )}
      
      {status === 'failed' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: 'var(--gradient-brand)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
