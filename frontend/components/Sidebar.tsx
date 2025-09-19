"use client";
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  firstName?: string;
}

export default function Sidebar({ firstName }: SidebarProps) {
  const pathname = usePathname();
  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/players', label: 'Players' },
    { href: '/scores', label: 'Scores' },
    { href: '/brackets', label: 'Brackets' },
    { href: '/payouts', label: 'Payouts' },
  ];
  return (
    <aside style={{
      width: '220px',
      background: 'linear-gradient(180deg, #222 0%, #444 100%)',
      height: '100vh',
      padding: '0',
      position: 'fixed',
      left: 0,
      top: 0,
      boxShadow: '2px 0 8px rgba(0,0,0,0.10)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ width: '100%', padding: '32px 0 16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <Link href="/">
          <img src="/logo.png" alt="BracketWorks Logo" style={{ width: '64px', height: '64px', marginBottom: '8px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
        </Link>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '1px' }}>BracketWorks</span>
      </div>
      <div style={{ width: '100%', textAlign: 'center', marginTop: '24px', marginBottom: '8px' }}>
        <span style={{ color: '#fff', fontWeight: 500, fontSize: '1rem' }}>
          Hello, {firstName ? firstName : 'User'}
        </span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '8px', width: '100%', alignItems: 'center' }}>
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: pathname === link.href ? '#ff9800' : '#fff',
              background: pathname === link.href ? 'rgba(255,152,0,0.12)' : 'none',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '1rem',
              padding: '8px 0',
              width: '80%',
              textAlign: 'center',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div style={{ width: '100%', padding: '16px 0', display: 'flex', justifyContent: 'center', position: 'absolute', bottom: 0 }}>
        <button
          onClick={() => {
            localStorage.removeItem('user_id');
            window.location.href = '/login';
          }}
          style={{
            background: 'linear-gradient(90deg, #ff9800 0%, #f7c873 100%)',
            color: '#232b36',
            fontWeight: 700,
            fontSize: '1rem',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 32px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(255,152,0,0.08)'
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
