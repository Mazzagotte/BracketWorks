"use client";

import { useState, useEffect } from 'react';

import { useAuth } from '../lib/auth-context';
import { API } from '../lib/api';
import { getErrorMessage } from '../lib/error-utils';
import styles from './DevAuthStatus.module.css';



interface ApiStatus {
  status: 'online' | 'offline' | 'checking';
  responseTime?: number;
  lastChecked?: Date;
  error?: string;
  url?: string;
}

const statusDotClass = (s: string, stylesObj: typeof styles) =>
  s === 'online' ? stylesObj.dotOnline : s === 'offline' ? stylesObj.dotOffline : s === 'checking' ? stylesObj.dotChecking : stylesObj.dotDefault;

const statusText = (s: string) =>
  s === 'online' ? 'API Online' : s === 'offline' ? 'API Offline' : s === 'checking' ? 'Checking...' : 'Unknown';

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

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className={`${styles.panel} ${isExpanded ? styles.panelExpanded : ''}`}>
      {/* Compact header */}
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.headerLeft}>
          {/* API Status dot */}
          <div
            suppressHydrationWarning
            className={`${styles.dot} ${mounted ? statusDotClass(apiStatus.status, styles) : styles.dotDefault}`}
          />
          {/* Auth Status dot */}
          <div
            suppressHydrationWarning
            className={`${styles.dot} ${mounted ? (auth.isAuthenticated ? styles.dotOnline : styles.dotOffline) : styles.dotDefault}`}
          />
          <span className={styles.label}>{isExpanded ? 'Dev Status' : 'Dev'}</span>
        </div>
        <span className={styles.chevron}>{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className={styles.body}>
          {/* API Status section */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>API Status</div>
            <div className={styles.row}>
              <div className={`${styles.dotSm} ${statusDotClass(apiStatus.status, styles)}`} />
              <span className={styles.text}>{statusText(apiStatus.status)}</span>
            </div>
            {apiStatus.url && (
              <div className={styles.url}>URL: {apiStatus.url}</div>
            )}
            {apiStatus.responseTime != null && (
              <div className={styles.meta}>Response: {apiStatus.responseTime}ms</div>
            )}
            {apiStatus.error && (
              <div className={styles.error}>Error: {apiStatus.error}</div>
            )}
            {apiStatus.lastChecked && (
              <div className={styles.meta}>Last: {apiStatus.lastChecked.toLocaleTimeString()}</div>
            )}
            <button
              className={styles.refreshBtn}
              onClick={(e) => { e.stopPropagation(); checkApiStatus(); }}
            >
              Refresh
            </button>
          </div>

          {/* Auth Status section */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Authentication</div>
            <div className={styles.row}>
              <div className={`${styles.dotSm} ${auth.isAuthenticated ? styles.dotOnline : styles.dotOffline}`} />
              <span className={styles.text}>
                {auth.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
              </span>
            </div>
            {auth.user && (
              <div className={styles.meta}>User: {auth.user.name || auth.user.id}</div>
            )}
            <div className={styles.meta}>Token: {auth.token ? 'Present' : 'Missing'}</div>
          </div>

          {/* Local Storage section */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Local Storage</div>
            <div className={styles.meta}>
              token: {typeof window !== 'undefined' && localStorage.getItem('token') ? 'Present' : 'Missing'}
            </div>
            <div className={styles.meta}>
              user_id: {typeof window !== 'undefined' && localStorage.getItem('user_id') ? 'Present' : 'Missing'}
            </div>
            <div className={styles.meta}>
              first_name: {typeof window !== 'undefined' && localStorage.getItem('first_name') ? 'Present' : 'Missing'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

