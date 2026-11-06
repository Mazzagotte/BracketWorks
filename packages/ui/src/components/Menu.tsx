'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { AnchorHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Menu.module.css';

export interface MenuProps {
  /** Accessible name for the trigger button, for example "Open account menu". */
  triggerLabel: string;
  /** Visible trigger content, for example an `Avatar` and a caret. */
  trigger: ReactNode;
  /** Optional non-interactive first line, for example the signed-in user's name. */
  header?: ReactNode;
  /** `MenuItem`s, `MenuDivider`s, or elements using `menuItemClassName()`. */
  children: ReactNode;
  /** Which edge of the trigger the panel lines up with. Default `end`. */
  align?: 'start' | 'end';
  className?: string;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

/** A dropdown menu for account and overflow actions. Closes on Escape, outside click, or selection. */
export function Menu({ triggerLabel, trigger, header, children, align = 'end', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      list[list.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={rootRef} className={cx(styles.menu, className)}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={triggerLabel.replace(/^Open\s+/i, '')}
          className={cx(styles.panel, align === 'start' && styles.alignStart)}
          onKeyDown={onPanelKeyDown}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest(ITEM_SELECTOR)) close(false);
          }}
        >
          {header ? <div className={styles.header}>{header}</div> : null}
          {header ? <div className={styles.divider} role="separator" /> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Class names for a menu item; use on Next.js `<Link role="menuitem">`. */
export function menuItemClassName(tone: 'default' | 'danger' = 'default', className?: string): string {
  return cx(styles.item, tone === 'danger' && styles.danger, className);
}

interface MenuItemBaseProps {
  tone?: 'default' | 'danger';
  /** Optional icon before the label (`ICON_SIZE.md`). */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export type MenuItemProps = MenuItemBaseProps &
  (
    | ({ href: string; onSelect?: never } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>)
    | { href?: never; onSelect: () => void; disabled?: boolean }
  );

export function MenuItem(props: MenuItemProps) {
  const { tone = 'default', icon, children, className } = props;
  const content = (
    <>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </>
  );
  if (props.href !== undefined) {
    const { tone: _tone, icon: _icon, children: _children, className: _className, ...anchorProps } = props;
    return (
      <a role="menuitem" className={menuItemClassName(tone, className)} {...anchorProps}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" className={menuItemClassName(tone, className)} onClick={props.onSelect} disabled={props.disabled}>
      {content}
    </button>
  );
}

export function MenuDivider() {
  return <div className={styles.divider} role="separator" />;
}

/** A short message inside the menu, for example a sign-out error. */
export function MenuStatus({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={styles.status}>
      {children}
    </p>
  );
}
