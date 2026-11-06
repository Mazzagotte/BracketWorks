import { BookOpen, FileSpreadsheet, FileText } from 'lucide-react'
import { Button, Card, CardHeader, ICON_SIZE } from '@bracketworks/ui'

import styles from './Payouts.module.css'

type PayoutsQuickActionsProps = {
  hasRows: boolean
  isLoading: boolean
  isExportingExcel: boolean
  isExportingPdf: boolean
  onOpenGuide: () => void
  onExportToExcel: () => void
  onExportToPdf: () => void
}

/** Payout exports and the guide: all secondary, no row of orange buttons. */
export default function PayoutsQuickActions({
  hasRows,
  isLoading,
  isExportingExcel,
  isExportingPdf,
  onOpenGuide,
  onExportToExcel,
  onExportToPdf,
}: PayoutsQuickActionsProps) {
  return (
    <Card aria-label="Quick actions">
      <CardHeader title="Quick actions" />
      <div className={styles.actionRow}>
        <Button variant="secondary" icon={<FileSpreadsheet size={ICON_SIZE.md} aria-hidden="true" />} onClick={onExportToExcel} disabled={isLoading || isExportingExcel || !hasRows}>
          {isExportingExcel ? 'Exporting...' : 'Export to Excel'}
        </Button>
        <Button variant="secondary" icon={<FileText size={ICON_SIZE.md} aria-hidden="true" />} onClick={onExportToPdf} disabled={isLoading || isExportingPdf || !hasRows}>
          {isExportingPdf ? 'Exporting...' : 'Export to PDF'}
        </Button>
        <Button variant="ghost" icon={<BookOpen size={ICON_SIZE.md} aria-hidden="true" />} onClick={onOpenGuide}>
          Payouts guide
        </Button>
      </div>
    </Card>
  )
}
