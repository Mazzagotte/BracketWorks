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

const toneClassMap: Record<PasswordStrengthTone, string> = {
  weak: styles.toneWeak,
  fair: styles.toneFair,
  good: styles.toneGood,
  strong: styles.toneStrong,
};

export default function PasswordStrengthPanel({
  strengthText,
  strengthPercent,
  tone,
  requirements,
  title = 'Password Strength',
  className = '',
}: PasswordStrengthPanelProps) {
  const toneClassName = toneClassMap[tone];

  return (
    <div className={`${styles.panel}${className ? ` ${className}` : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>{title}</span>
        <span className={`${styles.badge} ${toneClassName}`}>{strengthText}</span>
      </div>
      <div className={styles.meter}>
        <div
          className={`${styles.bar} ${toneClassName}`}
          style={{ width: `${Math.max(strengthPercent, 8)}%` }}
        ></div>
      </div>
      <div className={styles.requirements}>
        {requirements.map(requirement => (
          <div
            key={requirement.label}
            className={`${styles.requirementItem} ${requirement.met ? styles.requirementMet : styles.requirementPending}`}
          >
            <span className={styles.requirementIcon} aria-hidden="true">
              {requirement.met ? '✓' : '○'}
            </span>
            <span>{requirement.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}