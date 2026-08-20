import { BookOpen, FileSpreadsheet, Shuffle, Trash2, Upload, Zap } from 'lucide-react'

import buttonStyles from '../../styles/buttons.module.css'
import cardStyles from '../../styles/cards.module.css'
import styles from '../entries.module.css'

interface EntriesQuickActionsProps {
  isDev: boolean
  playersCount: number
  isImporting: boolean
  isDeletingAll: boolean
  onOpenGuide: () => void
  onExportToExcel: () => void
  onImportFromExcel: () => void
  onRandomizeEntries: () => void
  onDeleteAllEntries: () => void
}

export default function EntriesQuickActions({
  isDev, playersCount, isImporting, isDeletingAll, onOpenGuide, onExportToExcel,
  onImportFromExcel, onRandomizeEntries, onDeleteAllEntries,
}: EntriesQuickActionsProps) {
  return (
    <div className={`${cardStyles.card} ${cardStyles.quickActionsCard} ${styles.formCard}`}>
      <h3 className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.quickActionsTitle} ${styles.formTitle} ${styles.quickActionsHeading}`}>
        <Zap aria-hidden="true" />
        Quick Actions
      </h3>
      <div className={`${cardStyles.quickActionsBody} ${styles.quickActionsBody}`}>
        <div className={`${cardStyles.quickActionsRow} ${styles.quickActionsPrimaryRow}`}>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={onOpenGuide}>
            <BookOpen aria-hidden="true" /> Entries Guide
          </button>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={onExportToExcel} disabled={playersCount === 0}>
            <FileSpreadsheet aria-hidden="true" /> Export to Excel
          </button>
          <button className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`} onClick={onImportFromExcel} disabled={isImporting}>
            <Upload aria-hidden="true" /> {isImporting ? 'Importing...' : 'Import from Excel'}
          </button>
        </div>
        {isDev && playersCount > 0 && (
          <div className={styles.quickActionAdminSection}>
            <div className={styles.quickActionAdminRow}><span className={styles.quickActionAdminLabel}>Admin Tools</span></div>
            <div className={styles.quickActionAdminControls}>
              <button className={`${cardStyles.quickActionControl} ${styles.devButton} ${styles.quickActionDevBtn}`} onClick={onRandomizeEntries}>
                <Shuffle aria-hidden="true" /> Randomize Entries
              </button>
              <button className={`${cardStyles.quickActionControl} ${styles.devButton} ${styles.quickActionDangerBtn}`} onClick={onDeleteAllEntries} disabled={isDeletingAll}>
                <Trash2 aria-hidden="true" /> {isDeletingAll ? 'Deleting...' : 'Delete All Entries'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
