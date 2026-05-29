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
  const strengthWidthBucket = Math.max(10, Math.min(100, Math.round(strengthPercent / 10) * 10));
  const strengthWidthClass = styles[`barW${strengthWidthBucket}` as keyof typeof styles] as string;

  return (
    <div className={`${styles.panel}${className ? ` ${className}` : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>{title}</span>
        <span className={`${styles.badge} ${toneClassName}`}>{strengthText}</span>
      </div>
      <div className={styles.meter}>
        <div
          className={`${styles.bar} ${toneClassName} ${strengthWidthClass}`}
        ></div>
      </div>
      <div className={styles.requirements}>
        {requirements.map(requirement => (
          <div
            key={requirement.label}
            className={`${styles.requirementItem} ${requirement.met ? styles.requirementMet : styles.requirementPending}`}
          >
            <span className={styles.requirementIcon} aria-hidden="true">
              {requirement.met ? 'OK' : 'NO'}
            </span>
            <span>{requirement.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}