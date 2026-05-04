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
  
  const getStatusIcon = () => {
    switch (status) {
      case 'checking': return '⏳'
      case 'connected': return ''
      case 'failed': return ''
      default: return '❓'
    }
  }
  
  return (
    <div className={`bw-api-status bw-api-status-${status}`}>
      <div className="bw-api-status-header">
        <span className="bw-api-status-icon">{getStatusIcon()}</span>
        <strong>
          API Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </strong>
      </div>
      
      <div className="bw-api-status-url">
        Backend: {backendUrl}
      </div>
      
      {error && (
        <div className="bw-api-status-error">
          Error: {error}
        </div>
      )}
      
      {status === 'failed' && (
        <button
          onClick={() => window.location.reload()}
          className="ds-btn ds-btn-primary bw-api-status-retry"
        >
          Retry
        </button>
      )}
    </div>
  )
}
