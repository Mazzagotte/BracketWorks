import { BookOpen, FileSpreadsheet, Shuffle, Trash2, Upload } from 'lucide-react'
import { Button, Card, CardDivider, CardHeader, ICON_SIZE } from '@bracketworks/ui'

import styles from './EntriesPanels.module.css'

interface EntriesQuickActionsProps {
  isDev: boolean
  playersCount: number
  isImporting: boolean
  isExporting: boolean
  isDeletingAll: boolean
  onOpenGuide: () => void
  onExportToExcel: () => void
  onImportFromExcel: () => void
  onRandomizeEntries: () => void
  onDeleteAllEntries: () => void
}

/** Entries quick actions: all secondary (no row of orange buttons); admin tools below a divider. */
export default function EntriesQuickActions({
  isDev, playersCount, isImporting, isExporting, isDeletingAll, onOpenGuide, onExportToExcel,
  onImportFromExcel, onRandomizeEntries, onDeleteAllEntries,
}: EntriesQuickActionsProps) {
  return (
    <Card aria-label="Quick actions">
      <CardHeader title="Quick actions" />
      <div className={styles.actionRow}>
        <Button variant="secondary" icon={<Upload size={ICON_SIZE.md} aria-hidden="true" />} onClick={onImportFromExcel} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import from Excel'}
        </Button>
        <Button variant="secondary" icon={<FileSpreadsheet size={ICON_SIZE.md} aria-hidden="true" />} onClick={onExportToExcel} disabled={playersCount === 0 || isExporting}>
          {isExporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
        <Button variant="ghost" icon={<BookOpen size={ICON_SIZE.md} aria-hidden="true" />} onClick={onOpenGuide}>
          Entries guide
        </Button>
      </div>
      {isDev && playersCount > 0 ? (
        <>
          <CardDivider />
          <h3 className={styles.overline}>Admin tools</h3>
          <div className={styles.actionRow}>
            <Button size="sm" variant="secondary" icon={<Shuffle size={ICON_SIZE.md} aria-hidden="true" />} onClick={onRandomizeEntries}>
              Randomize entries
            </Button>
            <Button size="sm" variant="ghost-danger" icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={onDeleteAllEntries} disabled={isDeletingAll}>
              {isDeletingAll ? 'Deleting...' : 'Delete all entries'}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  )
}
