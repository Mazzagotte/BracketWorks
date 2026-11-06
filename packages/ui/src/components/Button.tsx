import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'accent-outline' | 'secondary' | 'ghost' | 'ghost-danger' | 'danger';
export type ButtonSize = 'md' | 'sm';

const variantClass: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  'accent-outline': styles.accentOutline,
  secondary: styles.secondary,
  ghost: styles.ghost,
  'ghost-danger': styles.ghostDanger,
  danger: styles.danger,
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
  className?: string;
}

/**
 * Class names for a button-styled element. Use this to style links
 * (for example Next.js `<Link>`) exactly like a `Button`.
 */
export function buttonClassName({ variant = 'secondary', size = 'md', fullWidth, iconOnly, className }: ButtonStyleOptions = {}): string {
  return cx(styles.button, variantClass[variant], size === 'sm' && styles.sm, fullWidth && styles.fullWidth, iconOnly && styles.iconOnly, className);
}

interface ButtonContentProps {
  /** Icon element (for example a Lucide icon with `size={ICON_SIZE.md}`). */
  icon?: ReactNode;
  /** Put the icon after the label ("Next", "Continue"). Default: before. */
  iconPosition?: 'start' | 'end';
  children?: ReactNode;
}

function ButtonContent({ icon, iconPosition = 'start', children }: ButtonContentProps) {
  const iconNode = icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null;
  return (
    <>
      {iconPosition === 'start' ? iconNode : null}
      {children}
      {iconPosition === 'end' ? iconNode : null}
    </>
  );
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>,
    ButtonStyleOptions,
    ButtonContentProps {}

/** The only button. See docs/ui-standards.md section 6 for when to use each variant. */
export function Button({ variant, size, fullWidth, iconOnly, className, icon, iconPosition, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName({ variant, size, fullWidth, iconOnly, className })} {...rest}>
      <ButtonContent icon={icon} iconPosition={iconPosition}>{children}</ButtonContent>
    </button>
  );
}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>,
    ButtonStyleOptions,
    ButtonContentProps {
  href: string;
}

/** A plain `<a>` styled as a button. For client-side routing, use `buttonClassName` on `<Link>`. */
export function ButtonLink({ variant, size, fullWidth, iconOnly, className, icon, iconPosition, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={buttonClassName({ variant, size, fullWidth, iconOnly, className })} {...rest}>
      <ButtonContent icon={icon} iconPosition={iconPosition}>{children}</ButtonContent>
    </a>
  );
}
