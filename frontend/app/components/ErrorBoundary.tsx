'use client'
import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Log to your error tracking service here
    // Example: Sentry, LogRocket, etc.
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          color: '#dc2626'
        }}>
          <h2>Something went wrong</h2>
          <details style={{ marginTop: '1rem' }}>
            <summary>Error details</summary>
            <pre style={{ 
              textAlign: 'left', 
              padding: '1rem',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '0.875rem',
              overflow: 'auto'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}