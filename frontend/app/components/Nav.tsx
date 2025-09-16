
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const linkStyle = (active: boolean) => ({
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: active ? '#f3f4f6' : 'transparent'
})

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
      <Link href="/dashboard" style={linkStyle(pathname?.startsWith('/dashboard') || false)}>Tournament Dashboard</Link>
      <Link href="/players" style={linkStyle(pathname?.startsWith('/players') || false)}>Players</Link>
      <Link href="/scores" style={linkStyle(pathname?.startsWith('/scores') || false)}>Scores</Link>
      <Link href="/brackets" style={linkStyle(pathname?.startsWith('/brackets') || false)}>Brackets</Link>
    </nav>
  )
}
