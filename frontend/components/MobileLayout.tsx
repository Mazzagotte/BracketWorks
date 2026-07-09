import React, { useState, useEffect } from 'react';

import styles from './MobileLayout.module.css';
import { logger } from '../app/lib/logger';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  headerActions?: React.ReactNode;
  fullWidth?: boolean;
  padding?: 'none' | 'small' | 'medium' | 'large';
  className?: string;
}

export function MobileLayout({
  children,
  title,
  subtitle,
  showBackButton = false,
  onBack,
  headerActions,
  fullWidth = false,
  padding = 'medium',
  className
}: MobileLayoutProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBackClick = () => {
    logger.userAction('Back button clicked', { currentTitle: title });
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const hasHeader = Boolean(title || showBackButton || headerActions);

  const mainPadClass = {
    none: styles.padNone,
    small: styles.padSmall,
    medium: styles.padMedium,
    large: styles.padLarge,
  }[padding];

  const mainHeaderPadClass = {
    none: styles.hasHeaderPadNone,
    small: styles.hasHeaderPadSmall,
    medium: styles.hasHeaderPadMedium,
    large: styles.hasHeaderPadLarge,
  }[padding];

  return (
    <div className={className ? `${styles.mobileLayout} ${className}` : styles.mobileLayout}>
      {hasHeader && (
        <header className={`${styles.mobileHeader} ${isScrolled ? styles.mobileHeaderScrolled : ''}`}>
          <div className={styles.mobileHeaderContent}>
            <div className={styles.mobileHeaderLeft}>
              {showBackButton && (
                <button
                  onClick={handleBackClick}
                  className={styles.mobileBackButton}
                  aria-label="Go back"
                >
                  Back
                </button>
              )}
              <div className={styles.mobileHeaderText}>
                {title && <h1 className={styles.mobileTitle}>{title}</h1>}
                {subtitle && <p className={styles.mobileSubtitle}>{subtitle}</p>}
              </div>
            </div>

            {headerActions && (
              <div className={styles.mobileHeaderActions}>
                {headerActions}
              </div>
            )}
          </div>
        </header>
      )}

      <main
        className={`${styles.mobileMain} ${fullWidth ? styles.fullWidth : ''} ${mainPadClass} ${hasHeader ? mainHeaderPadClass : ''}`}
      >
        {children}
      </main>
    </div>
  );
}

// Mobile-optimized container component
interface MobileContainerProps {
  children: React.ReactNode;
  maxWidth?: 'small' | 'medium' | 'large' | 'full';
  padding?: boolean;
  background?: 'transparent' | 'white' | 'gray';
  rounded?: boolean;
  shadow?: boolean;
}

export function MobileContainer({
  children,
  maxWidth = 'large',
  padding = true,
  background = 'transparent',
  rounded = false,
  shadow = false
}: MobileContainerProps) {
  const maxWidthClass = {
    small: styles.maxSmall,
    medium: styles.maxMedium,
    large: styles.maxLarge,
    full: styles.maxFull,
  }[maxWidth];

  const backgroundClass = {
    transparent: styles.bgTransparent,
    white: styles.bgWhite,
    gray: styles.bgGray,
  }[background];

  return (
    <div
      className={`${styles.mobileContainer} ${maxWidthClass} ${backgroundClass} ${padding ? styles.containerPad : ''} ${rounded ? styles.rounded : ''} ${shadow ? styles.shadow : ''}`}
    >
      {children}
    </div>
  );
}

// Mobile-optimized grid component
interface MobileGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'small' | 'medium' | 'large';
  breakpoint?: '480px' | '640px' | '768px';
}

export function MobileGrid({
  children,
  columns = 1,
  gap = 'medium',
  breakpoint = '640px'
}: MobileGridProps) {
  const gapClass = {
    small: styles.gapSmall,
    medium: styles.gapMedium,
    large: styles.gapLarge,
  }[gap];

  const colsClass = {
    '480px': {
      1: styles.bp480Cols1,
      2: styles.bp480Cols2,
      3: styles.bp480Cols3,
      4: styles.bp480Cols4,
    },
    '640px': {
      1: styles.bp640Cols1,
      2: styles.bp640Cols2,
      3: styles.bp640Cols3,
      4: styles.bp640Cols4,
    },
    '768px': {
      1: styles.bp768Cols1,
      2: styles.bp768Cols2,
      3: styles.bp768Cols3,
      4: styles.bp768Cols4,
    },
  }[breakpoint][columns];

  return (
    <div className={`${styles.mobileGrid} ${gapClass} ${colsClass}`}>
      {children}
    </div>
  );
}
