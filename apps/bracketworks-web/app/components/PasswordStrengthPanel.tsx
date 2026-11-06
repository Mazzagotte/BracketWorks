import { Check, Minus } from 'lucide-react';
import { ICON_SIZE, ProgressBar } from '@bracketworks/ui';

import styles from './PasswordStrengthPanel.module.css';

export type PasswordStrengthTone = 'weak' | 'fair' | 'good' | 'strong';

export type PasswordStrengthRequirement = {
  label: string;
  met: boolean;
};

type PasswordStrengthPanelProps = {
  strengthText: string;
  strengthPercent: number;
  tone: PasswordStrengthTone;
  requirements: PasswordStrengthRequirement[];
  title?: string;
  className?: string;
};

/** Password strength under a new-password field: a progress bar with its value, then each requirement. */
export default function PasswordStrengthPanel({
  strengthText,
  strengthPercent,
  requirements,
  title = 'Password strength',
  className = '',
}: PasswordStrengthPanelProps) {
  const value = Math.max(0, Math.min(100, Math.round(strengthPercent)));

  return (
    <div className={`${styles.panel}${className ? ` ${className}` : ''}`}>
      <ProgressBar value={value} max={100} label={title} valueText={`${title}: ${strengthText}`} />
      <ul className={styles.requirements}>
        {requirements.map(requirement => (
          <li key={requirement.label} className={requirement.met ? styles.met : styles.pending}>
            {requirement.met
              ? <Check size={ICON_SIZE.sm} aria-hidden="true" className={styles.metIcon} />
              : <Minus size={ICON_SIZE.sm} aria-hidden="true" />}
            <span>{requirement.label}</span>
            <span className="sr-only">{requirement.met ? ' (met)' : ' (not met)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
