'use client'

import { useState } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import styles from './Nav.module.css'







export default function Nav() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isActive = (path: string) => pathname?.startsWith(path) || false

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <nav className={styles.nav}>
      {/* Desktop Navigation */}
      <div className={styles.desktopNav}>
        <Link href="/dashboard" className={`${styles.navLink} ${isActive('/dashboard') ? styles.active : ''}`}>
          Tournament Dashboard
        </Link>
        <Link href="/players" className={`${styles.navLink} ${isActive('/players') ? styles.active : ''}`}>
          Entries
        </Link>
        <Link href="/scores" className={`${styles.navLink} ${isActive('/scores') ? styles.active : ''}`}>
          Scores
        </Link>
        <Link href="/brackets" className={`${styles.navLink} ${isActive('/brackets') ? styles.active : ''}`}>
          Brackets
        </Link>
        <Link href="/payouts" className={`${styles.navLink} ${isActive('/payouts') ? styles.active : ''}`}>
          Payouts
        </Link>
      </div>

      {/* Mobile Navigation */}
      <div className={styles.mobileNav}>
        <button 
          className={styles.hamburger}
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
        </button>
        
        {isMobileMenuOpen && (
          <>
            {/* Mobile menu overlay */}
            <div 
              className={styles.mobileOverlay}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            <div className={styles.mobileMenu}>
              <Link 
                href="/dashboard" 
                className={`${styles.mobileNavLink} ${isActive('/dashboard') ? styles.mobileActive : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link 
                href="/players" 
                className={`${styles.mobileNavLink} ${isActive('/players') ? styles.mobileActive : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Entries
              </Link>
              <Link 
                href="/scores" 
                className={`${styles.mobileNavLink} ${isActive('/scores') ? styles.mobileActive : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Scores
              </Link>
              <Link 
                href="/brackets" 
                className={`${styles.mobileNavLink} ${isActive('/brackets') ? styles.mobileActive : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Brackets
              </Link>
              <Link 
                href="/payouts" 
                className={`${styles.mobileNavLink} ${isActive('/payouts') ? styles.mobileActive : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Payouts
              </Link>
            </div>
          </>
        )}
      </div>
    </nav>
  )
}

