import React from 'react';
import styles from './primitives.module.css';

type CardVariant = 'primary' | 'secondary' | 'utility';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  interactive?: boolean;
}

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
  variant = 'primary',
  interactive = false,
}: CardProps) {
  const variantClass =
    variant === 'primary'
      ? styles.cardPrimary
      : variant === 'secondary'
        ? styles.cardSecondary
        : styles.cardUtility;

  return (
    <section
      className={cx(
        styles.card,
        variantClass,
        interactive && styles.cardInteractive,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ children, className }: CardSectionProps) {
  return <header className={cx(styles.cardHeader, className)}>{children}</header>;
}

export function CardBody({ children, className }: CardSectionProps) {
  return <div className={cx(styles.cardBody, className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardSectionProps) {
  return <footer className={cx(styles.cardFooter, className)}>{children}</footer>;
}
