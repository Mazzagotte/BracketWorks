import styles from '../brackets.module.css'
import buttonStyles from '../../styles/buttons.module.css'

interface EntriesMismatchBannerProps {
  onRegenerate: () => void
}

/**
 * Inline warning shown when bracket entries have changed since last generation.
 */
export function EntriesMismatchBanner({ onRegenerate }: EntriesMismatchBannerProps) {
  return (
    <div className={styles.mismatchBanner}>
      <span className={styles.mismatchBannerText}>
        Brackets out of date: Entries have changed. Regenerate brackets to ensure accurate results and payouts.
      </span>
      <button
        onClick={onRegenerate}
        className={`${styles.mismatchBannerButton} ${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`}
      >
        Regenerate Brackets
      </button>
    </div>
  )
}
