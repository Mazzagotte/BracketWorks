'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { AnchorHTMLAttributes, CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
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
  const [position, setPosition] = useState<CSSProperties | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // The panel is fixed to the viewport so scrolling containers (such as tables) cannot clip it.
  // It opens below the trigger, or above when there is no room below.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(undefined);
      return;
    }
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const opensUp = rect.bottom + panel.offsetHeight > window.innerHeight && rect.top > panel.offsetHeight;
    const vars: Record<string, string> = opensUp
      ? { '--menu-bottom': `${window.innerHeight - rect.top}px` }
      : { '--menu-top': `${rect.bottom}px` };
    if (align === 'start') vars['--menu-left'] = `${rect.left}px`;
    else vars['--menu-right'] = `${document.documentElement.clientWidth - rect.right}px`;
    setPosition(vars as CSSProperties);
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => close(false);
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      close(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus({ preventScroll: true });
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
          className={cx(styles.panel, position && '--menu-bottom' in position && styles.opensUp)}
          style={position}
          onKeyDown={onPanelKeyDown}
          onClick={(event) => {
            // Return focus to the trigger so a dialog opened by the item can restore it later.
            if ((event.target as HTMLElement).closest(ITEM_SELECTOR)) close(true);
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
    | { href?: never; onSelect: () => void; disabled?: boolean; 'aria-label'?: string }
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
    <button
      type="button"
      role="menuitem"
      className={menuItemClassName(tone, className)}
      onClick={props.onSelect}
      disabled={props.disabled}
      aria-label={props['aria-label']}
    >
      {content}
    </button>
  );
}

export function MenuDivider() {
  return <div className={styles.divider} role="separator" />;
}

/** Explanatory text inside the menu, for example why an item is disabled. */
export function MenuNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

/** A short message inside the menu, for example a sign-out error. */
export function MenuStatus({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={styles.status}>
      {children}
    </p>
  );
}
