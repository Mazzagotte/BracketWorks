'use client';

import { useRef } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Nav.module.css';

export interface TopNavProps {
  /** Product mark and name, usually a link home. Use `TopNavBrand`. */
  brand: ReactNode;
  /** Current tournament name. */
  contextTitle?: ReactNode;
  /** Current tournament date or other short fact. */
  contextMeta?: ReactNode;
  /** `NavItem` links. */
  children?: ReactNode;
  /** Account controls, live view, and so on. */
  actions?: ReactNode;
  /** Accessible name for the primary navigation. Default "Main". */
  navLabel?: string;
  /** Label of the disclosure that holds the nav items on phones. Default "Menu". */
  mobileMenuLabel?: string;
  className?: string;
}

/** The one top bar for both apps. On phones the nav items move into a "Menu" disclosure. */
export function TopNav({ brand, contextTitle, contextMeta, children, actions, navLabel = 'Main', mobileMenuLabel = 'Menu', className }: TopNavProps) {
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  return (
    <header className={cx(styles.topNav, className)}>
      {brand}
      {contextTitle ? (
        <div className={styles.context}>
          <span className={styles.contextTitle}>{contextTitle}</span>
          {contextMeta ? <span className={styles.contextMeta}>{contextMeta}</span> : null}
        </div>
      ) : null}
      {children ? <nav aria-label={navLabel} className={styles.items}>{children}</nav> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {children ? (
        <details ref={mobileMenuRef} className={styles.mobileMenu}>
          <summary className={styles.mobileMenuSummary}>{mobileMenuLabel}</summary>
          <nav
            aria-label={`${navLabel} (mobile)`}
            className={styles.mobileMenuPanel}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a') && mobileMenuRef.current) mobileMenuRef.current.open = false;
            }}
          >
            {children}
          </nav>
        </details>
      ) : null}
    </header>
  );
}

export interface TopNavBrandProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  href: string;
  /** The product mark image or SVG at 24px. */
  mark: ReactNode;
  name: string;
  className?: string;
}

/** Class names for the top-bar brand link; use on Next.js `<Link>` for client-side routing. */
export function topNavBrandClassName(className?: string): string {
  return cx(styles.brand, className);
}

export function TopNavBrand({ mark, name, className, ...rest }: TopNavBrandProps) {
  return (
    <a className={topNavBrandClassName(className)} {...rest}>
      {mark}
      {name}
    </a>
  );
}

/** Class names for a top-bar nav item; use on Next.js `<Link>`. */
export function navItemClassName(active: boolean, className?: string): string {
  return cx(styles.navItem, active && styles.navItemActive, className);
}

export interface NavItemProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  href: string;
  active?: boolean;
  className?: string;
}

export function NavItem({ active = false, className, children, ...rest }: NavItemProps) {
  return (
    <a className={navItemClassName(active, className)} aria-current={active ? 'page' : undefined} {...rest}>
      {children}
    </a>
  );
}

/** Class names for a side-navigation item; use on `<Link>` or `<button>`. */
export function sideNavItemClassName(active: boolean, className?: string): string {
  return cx(styles.sideNavItem, active && styles.sideNavItemActive, className);
}

export interface SideNavItem {
  id: string;
  label: ReactNode;
  /** Status under the label, for example "Optional" or "Ready". */
  meta?: ReactNode;
  href?: string;
}

export interface SideNavSection {
  heading?: ReactNode;
  items: SideNavItem[];
}

export interface SideNavProps {
  /** Accessible name, for example "Setup steps". */
  label: string;
  sections: SideNavSection[];
  activeId: string;
  /** Called for items without `href`. */
  onSelect?: (id: string) => void;
  className?: string;
}

/** A plain vertical list on the page, not inside a card. */
export function SideNav({ label, sections, activeId, onSelect, className }: SideNavProps) {
  return (
    <nav aria-label={label} className={className}>
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          {section.heading ? <p className={styles.sideNavHeading}>{section.heading}</p> : null}
          <ul className={styles.sideNav}>
            {section.items.map((item) => {
              const active = item.id === activeId;
              const content = (
                <>
                  <span>{item.label}</span>
                  {item.meta ? <span className={styles.sideNavMeta}>{item.meta}</span> : null}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <a href={item.href} className={sideNavItemClassName(active)} aria-current={active ? 'step' : undefined}>
                      {content}
                    </a>
                  ) : (
                    <button type="button" className={sideNavItemClassName(active)} aria-current={active ? 'step' : undefined} onClick={() => onSelect?.(item.id)}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
