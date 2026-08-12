import type { LucideIcon } from 'lucide-react';

import styles from './FeatureIconCard.module.css';

type FeatureIconCardProps = {
  icon: LucideIcon;
  label: string;
  className?: string;
};

export default function FeatureIconCard({ icon: Icon, label, className = '' }: FeatureIconCardProps) {
  return (
    <div role="img" aria-label={label} className={`${styles.card} ${className}`.trim()}>
      <Icon size={28} strokeWidth={2} aria-hidden="true" className={styles.icon} />
    </div>
  );
}
