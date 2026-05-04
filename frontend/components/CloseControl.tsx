"use client";

import { ButtonHTMLAttributes } from 'react';
import styles from './CloseControl.module.css';

interface CloseControlProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  position?: 'inline' | 'absolute';
  size?: 'xs' | 'sm' | 'md';
  label?: string;
}

export default function CloseControl({
  className = '',
  position = 'inline',
  size = 'md',
  type,
  label = 'Close',
  ...props
}: CloseControlProps) {
  const positionClass = position === 'absolute' ? styles.absolute : styles.inline;
  const sizeClass = size === 'xs' ? styles.xsmall : size === 'sm' ? styles.small : '';
  const classes = [styles.root, positionClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <button type={type ?? 'button'} className={classes} aria-label={label} {...props}>
      <svg className={styles.icon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      </svg>
    </button>
  );
}