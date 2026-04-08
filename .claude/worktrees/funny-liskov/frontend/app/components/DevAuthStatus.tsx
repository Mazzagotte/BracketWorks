"use client";

import { useState, useEffect } from 'react';

import { useAuth } from '../lib/auth-context';
import { API } from '../lib/api';
import { getErrorMessage } from '../lib/error-utils';



interface ApiStatus {
  status: 'online' | 'offline' | 'checking';
  responseTime?: number;
  lastChecked?: Date;
  error?: string;
  url?: string;
}

export function DevAuthStatus() {
  const auth = useAuth();
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'checking' });
  const [isExpanded, setIsExpanded] = useState(false);

  // Check API status
  const checkApiStatus = async () => {
    const startTime = Date.now();
    setApiStatus({ status: 'checking' });
    
    const apiUrl = API('/api/v1/health');
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        setApiStatus({
          status: 'online',
          responseTime,
          lastChecked: new Date(),
          url: apiUrl
        });
      } else {
        setApiStatus({
          status: 'offline',
          responseTime,
          lastChecked: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`,
          url: apiUrl
        });
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      setApiStatus({
        status: 'offline',
        responseTime,
        lastChecked: new Date(),
        error: getErrorMessage(error) || 'Network error',
        url: apiUrl
      });
    }
  };

  // Check API status on mount and every 30 seconds
  useEffect(() => {
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#ef4444';
      case 'checking': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'API Online';
      case 'offline': return 'API Offline';
      case 'checking': return 'Checking...';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      fontSize: '12px',
      fontFamily: 'Inter, sans-serif',
      minWidth: isExpanded ? '300px' : '120px',
      transition: 'all 0.3s ease'
    }}>
      {/* Compact View */}
      <div 
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* API Status Dot */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(apiStatus.status),
            animation: apiStatus.status === 'checking' ? 'pulse 2s infinite' : 'none'
          }} />
          
          {/* Auth Status Dot */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: auth.isAuthenticated ? '#10b981' : '#ef4444'
          }} />
          
          <span style={{ fontWeight: '500' }}>
            {isExpanded ? 'Dev Status' : 'Dev'}
          </span>
        </div>
        
        <span style={{ fontSize: '10px', color: '#6b7280' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div style={{
          padding: '0 12px 12px 12px',
          borderTop: '1px solid #f3f4f6'
        }}>
          {/* API Status */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
              API Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(apiStatus.status)
              }} />
              <span style={{ color: '#6b7280' }}>
                {getStatusText(apiStatus.status)}
              </span>
            </div>
            {apiStatus.url && (
              <div style={{ color: '#6b7280', fontSize: '11px', wordBreak: 'break-all' }}>
                URL: {apiStatus.url}
              </div>
            )}
            {apiStatus.responseTime && (
              <div style={{ color: '#6b7280', fontSize: '11px' }}>
                Response: {apiStatus.responseTime}ms
              </div>
            )}
            {apiStatus.error && (
              <div style={{ color: '#ef4444', fontSize: '11px', wordBreak: 'break-all' }}>
                Error: {apiStatus.error}
              </div>
            )}
            {apiStatus.lastChecked && (
              <div style={{ color: '#6b7280', fontSize: '11px' }}>
                Last: {apiStatus.lastChecked.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={(changeEvent) => { changeEvent.stopPropagation();
                checkApiStatus();
              }}
              style={{
                marginTop: '4px',
                padding: '2px 6px',
                fontSize: '10px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          </div>

          {/* Auth Status */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
              Authentication
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: auth.isAuthenticated ? '#10b981' : '#ef4444'
              }} />
              <span style={{ color: '#6b7280' }}>
                {auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
              </span>
            </div>
            {auth.user && (
              <div style={{ color: '#6b7280', fontSize: '11px' }}>
                User: {auth.user.name || auth.user.id}
              </div>
            )}
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              Token: {auth.token ? 'Present' : 'Missing'}
            </div>
          </div>

          {/* Local Storage */}
          <div>
            <div style={{ fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
              Local Storage
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              token: {typeof window !== 'undefined' && localStorage.getItem('token') ? 'Present' : 'Missing'}
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              user_id: {typeof window !== 'undefined' && localStorage.getItem('user_id') ? 'Present' : 'Missing'}
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px' }}>
              first_name: {typeof window !== 'undefined' && localStorage.getItem('first_name') ? 'Present' : 'Missing'}
            </div>
          </div>
        </div>
      )}
      
      {/* Add pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

