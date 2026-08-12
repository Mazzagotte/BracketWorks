import type { RegistrationFieldMode } from './types';
import styles from './tournament-setup.module.css';

type RequiredOptionalControlProps = {
  value: RegistrationFieldMode;
  onChange: (next: RegistrationFieldMode) => void;
};

const options: { value: RegistrationFieldMode; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
  { value: 'dont-ask', label: "Don't Ask" },
];

export default function RequiredOptionalControl({ value, onChange }: RequiredOptionalControlProps) {
  return (
    <div className={styles.segmentedControl} role="radiogroup" aria-label="Field requirement">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.segmentedButton} ${active ? styles.segmentedButtonActive : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
