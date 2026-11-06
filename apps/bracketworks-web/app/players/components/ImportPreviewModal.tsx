'use client'

import { useMemo } from 'react'
import { Badge, Button, DataTable, Modal } from '@bracketworks/ui'

import styles from './ImportPreviewModal.module.css'
import { importPreviewCounts, type ImportPreviewRow } from '../utils/buildImportPreview'

interface Props {
  fileName: string
  rows: ImportPreviewRow[]
  isCommitting: boolean
  onRowsChange: (rows: ImportPreviewRow[]) => void
  onCancel: () => void
  onConfirm: () => void
}

const labels = {
  new: 'New', existing_match: 'Existing match', possible_duplicate: 'Possible duplicate',
  invalid: 'Invalid', warning: 'Warning', skipped: 'Skipped',
}

const tones = {
  new: 'success', existing_match: 'neutral', possible_duplicate: 'warning',
  invalid: 'danger', warning: 'warning', skipped: 'neutral',
} as const

/** Review an Excel import before it is saved: status per row, editable names and averages. */
export default function ImportPreviewModal({ fileName, rows, isCommitting, onRowsChange, onCancel, onConfirm }: Props) {
  const counts = useMemo(() => importPreviewCounts(rows), [rows])
  const selectedCount = rows.filter(row => row.selected && row.player).length

  const update = (id: string, updater: (row: ImportPreviewRow) => ImportPreviewRow) => {
    onRowsChange(rows.map(row => row.id === id ? updater(row) : row))
  }

  return (
    <Modal
      open
      onClose={onCancel}
      size="lg"
      dismissible={!isCommitting}
      title="Review Excel import"
      description={`${fileName} · ${rows.length} rows found. Checked rows are saved together when you confirm.`}
      footer={(
        <>
          <span className={styles.selected}>{selectedCount} row{selectedCount === 1 ? '' : 's'} selected</span>
          <Button variant="secondary" onClick={onCancel} disabled={isCommitting}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm} disabled={selectedCount === 0 || isCommitting}>
            {isCommitting ? 'Importing...' : `Import ${selectedCount} row${selectedCount === 1 ? '' : 's'}`}
          </Button>
        </>
      )}
    >
      <div className={styles.body}>
        <p className={styles.counts}>
          {Object.entries(counts).filter(([, count]) => count > 0).map(([category, count]) => (
            <Badge key={category} tone={tones[category as keyof typeof tones]}>{count} {labels[category as keyof typeof labels].toLowerCase()}</Badge>
          ))}
        </p>
        <DataTable caption="Rows to import">
          <thead>
            <tr><th>Import</th><th data-align="right">Row</th><th>Bowler</th><th data-align="right">Average</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    aria-label={`Import row ${row.sourceRow}`}
                    checked={row.selected}
                    disabled={!row.player || isCommitting}
                    onChange={event => update(row.id, value => ({ ...value, selected: event.target.checked }))}
                  />
                </td>
                <td data-align="right" data-tone="secondary">{row.sourceRow}</td>
                <td>
                  {row.player ? (
                    <div className={styles.nameFields}>
                      <input className={styles.cellInput} aria-label={`Row ${row.sourceRow} first name`} value={row.player.firstName} disabled={isCommitting} onChange={event => update(row.id, value => ({ ...value, player: value.player ? { ...value.player, firstName: event.target.value } : value.player }))} />
                      <input className={styles.cellInput} aria-label={`Row ${row.sourceRow} last name`} value={row.player.lastName} disabled={isCommitting} onChange={event => update(row.id, value => ({ ...value, player: value.player ? { ...value.player, lastName: event.target.value } : value.player }))} />
                    </div>
                  ) : <span className={styles.meta}>-</span>}
                </td>
                <td data-align="right">
                  {row.player ? (
                    <input className={`${styles.cellInput} ${styles.cellNumber}`} type="number" min="0" max="300" aria-label={`Row ${row.sourceRow} average`} value={row.player.average} disabled={isCommitting} onChange={event => update(row.id, value => ({ ...value, player: value.player ? { ...value.player, average: Number(event.target.value) } : value.player }))} />
                  ) : <span className={styles.meta}>-</span>}
                </td>
                <td>
                  <div className={styles.status}>
                    <Badge tone={tones[row.category]}>{labels[row.category]}</Badge>
                    {row.reason ? <span className={styles.meta}>{row.reason}</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </Modal>
  )
}
