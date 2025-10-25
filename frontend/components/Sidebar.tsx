"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { useAuth } from '../app/lib/auth-context';
import { logger } from '../app/lib/logger';

interface SidebarProps {
  firstName?: string;
  isMobile?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ firstName, isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logger.userAction('User logged out');
    logout();
    window.location.href = '/login';
  };
  
  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/players', label: 'Entries' },
    { href: '/scores', label: 'Scores' },
    { href: '/brackets', label: 'Brackets' },
    { href: '/payouts', label: 'Payouts' },
  ];
  return (
    <aside style={{
      width: isMobile ? '280px' : '260px',
      background: 'linear-gradient(180deg, #1a1f2e 0%, #2d3748 50%, #374151 100%)',
      backdropFilter: 'blur(16px)',
      height: '100vh',
      padding: '0',
      position: 'fixed',
      left: isMobile ? (isOpen ? '0' : '-280px') : '0',
      top: 0,
      boxShadow: '6px 0 32px rgba(0,0,0,0.2), 2px 0 12px rgba(0,0,0,0.15)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: 'none',
      borderRight: '2px solid rgba(240,165,0,0.1)',
      zIndex: 1000,
      transition: 'all 0.3s ease',
      display: 'flex',
      pointerEvents: 'auto',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ width: '100%', padding: '28px 0 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        {isMobile && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              fontSize: '18px',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            ×
          </button>
        )}
        <Link href="/" style={{ transition: 'transform 0.2s ease', display: 'inline-block' }} 
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
          <Image 
            src="/logo.png" 
            alt="BracketWorks Logo" 
            width={68}
            height={68}
            style={{ 
              marginBottom: '12px', 
              borderRadius: '18px', 
              boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 2px 8px rgba(240,165,0,0.1)',
              border: '2px solid rgba(240,165,0,0.2)'
            }} 
          />
        </Link>
        <span style={{ 
          color: '#fff', 
          fontWeight: 700, 
          fontSize: '1.35rem', 
          letterSpacing: '0.5px',
          background: 'linear-gradient(135deg, #fff 0%, #f0a500 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>BracketWorks</span>
      </div>
      <div style={{ 
        width: '85%', 
        textAlign: 'center', 
        marginTop: '24px', 
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'rgba(240,165,0,0.08)',
        borderRadius: '12px',
        border: '1px solid rgba(240,165,0,0.15)'
      }}>
        <span style={{ 
          color: 'rgba(255,255,255,0.9)', 
          fontWeight: 600, 
          fontSize: '0.95rem',
          letterSpacing: '0.3px'
        }}>
          Welcome, {firstName ? firstName : 'User'}
        </span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', width: '100%', alignItems: 'center', padding: '0 16px' }}>
        {links.map(link => {
          const isActive = pathname === link.href;
          return (
            <div key={link.href} style={{ width: '100%', marginBottom: '4px' }}>
              <Link
                href={link.href}
                onClick={(e) => {
                  logger.userAction('Sidebar link clicked', { href: link.href });
                }}
                style={{
                  color: isActive ? '#f0a500' : 'rgba(255,255,255,0.85)',
                  background: isActive 
                    ? 'linear-gradient(90deg, rgba(240,165,0,0.18) 0%, rgba(240,165,0,0.08) 100%)' 
                    : 'rgba(255,255,255,0.02)',
                  textDecoration: 'none',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.95rem',
                  padding: '16px 22px',
                  width: '100%',
                  display: 'block',
                  borderRadius: '14px',
                  border: isActive 
                    ? '1px solid rgba(240,165,0,0.3)' 
                    : '1px solid rgba(255,255,255,0.05)',
                  borderLeft: isActive ? '4px solid #f0a500' : '4px solid transparent',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  pointerEvents: 'auto'
                }}
              >
                {link.label}
              </Link>
            </div>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ width: '100%', padding: '20px 16px', display: 'flex', justifyContent: 'center', position: 'absolute', bottom: 0 }}>
        <button
          onClick={handleLogout}
          style={{
            background: 'linear-gradient(135deg, #f0a500 0%, #ff9800 100%)',
            color: '#1a1f2e',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: '1px solid rgba(240,165,0,0.3)',
            borderRadius: '12px',
            padding: '12px 28px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(240,165,0,0.2), 0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
            letterSpacing: '0.5px',
            width: '85%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(240,165,0,0.3), 0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(240,165,0,0.2), 0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

