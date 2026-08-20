import { BookOpen, FileSpreadsheet, FileText } from 'lucide-react'

import { QuickActions } from '../../components/primitives'
import buttonStyles from '../../styles/buttons.module.css'
import styles from '../payouts.module.css'

type PayoutsQuickActionsProps = {
  hasRows: boolean
  isLoading: boolean
  isExportingExcel: boolean
  isExportingPdf: boolean
  isMobileView: boolean
  onOpenGuide: () => void
  onExportToExcel: () => void
  onExportToPdf: () => void
}

export default function PayoutsQuickActions({
  hasRows,
  isLoading,
  isExportingExcel,
  isExportingPdf,
  isMobileView,
  onOpenGuide,
  onExportToExcel,
  onExportToPdf,
}: PayoutsQuickActionsProps) {
  return (
    <QuickActions
      className={styles.quickActionsContent}
      left={(
        <button
          className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
          onClick={onOpenGuide}
        >
          <BookOpen aria-hidden="true" />
          Payouts Guide
        </button>
      )}
      right={(
        <>
          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={onExportToExcel}
            disabled={isLoading || isExportingExcel || !hasRows}
          >
            <FileSpreadsheet aria-hidden="true" />
            {isExportingExcel ? 'Exporting...' : isMobileView ? 'Excel' : 'Export to Excel'}
          </button>
          <button
            className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.quickAction}`}
            onClick={onExportToPdf}
            disabled={isLoading || isExportingPdf || !hasRows}
          >
            <FileText aria-hidden="true" />
            {isExportingPdf ? 'Exporting...' : isMobileView ? 'PDF' : 'Export to PDF'}
          </button>
        </>
      )}
    />
  )
}
