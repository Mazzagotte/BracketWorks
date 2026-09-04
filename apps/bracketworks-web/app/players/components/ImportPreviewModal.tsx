'use client'

import { useMemo } from 'react'
import buttonStyles from '../../styles/buttons.module.css'
import formStyles from '../../styles/forms.module.css'
import styles from '../entries.module.css'
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

export default function ImportPreviewModal({ fileName, rows, isCommitting, onRowsChange, onCancel, onConfirm }: Props) {
  const counts = useMemo(() => importPreviewCounts(rows), [rows])
  const selectedCount = rows.filter(row => row.selected && row.player).length

  const update = (id: string, updater: (row: ImportPreviewRow) => ImportPreviewRow) => {
    onRowsChange(rows.map(row => row.id === id ? updater(row) : row))
  }

  return (
    <div className={styles.importPreviewOverlay} role="presentation">
      <section className={styles.importPreviewModal} role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
        <header className={styles.importPreviewHeader}>
          <div><h2 id="import-preview-title">Review Excel Import</h2><p>{fileName} · {rows.length} detected rows</p></div>
        </header>
        <div className={styles.importPreviewCounts}>
          {Object.entries(counts).filter(([, count]) => count > 0).map(([category, count]) => (
            <span key={category} data-category={category}><strong>{count}</strong> {labels[category as keyof typeof labels]}</span>
          ))}
        </div>
        <p className={styles.importPreviewHelp}>Review warnings and duplicates. Checked rows are committed together only after confirmation.</p>
        <div className={styles.importPreviewTableWrap}>
          <table className={styles.importPreviewTable}>
            <thead><tr><th>Import</th><th>Row</th><th>Player</th><th>Average</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td><input type="checkbox" aria-label={`Import row ${row.sourceRow}`} checked={row.selected} disabled={!row.player || isCommitting} onChange={event => update(row.id, value => ({ ...value, selected: event.target.checked }))} /></td>
                  <td>{row.sourceRow}</td>
                  <td>{row.player ? (
                    <div className={styles.importNameFields}>
                      <input className={formStyles.field} aria-label={`Row ${row.sourceRow} first name`} value={row.player.firstName} disabled={isCommitting} onChange={event => update(row.id, value => ({ ...value, player: value.player ? { ...value.player, firstName: event.target.value } : value.player }))} />
                      <input className={formStyles.field} aria-label={`Row ${row.sourceRow} last name`} value={row.player.lastName} disabled={isCommitting} onChange={event => update(row.id, value => ({ ...value, player: value.player ? { ...value.player, lastName: event.target.value } : value.player }))} />
                    </div>
                  ) : '—'}</td>
                  <td>{row.player ? <input className={formStyles.field} type="number" min="0" max="300" aria-label={`Row ${row.sourceRow} average`} value={row.player.average} disabled={isCommitting} onChange={event => update(row.id, value => ({ ...value, player: value.player ? { ...value.player, average: Number(event.target.value) } : value.player }))} /> : '—'}</td>
                  <td><span className={styles.importStatus} data-category={row.category}>{labels[row.category]}</span><small>{row.reason}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className={styles.importPreviewActions}>
          <span>{selectedCount} row{selectedCount === 1 ? '' : 's'} selected</span>
          <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`} onClick={onCancel} disabled={isCommitting}>Cancel</button>
          <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`} onClick={onConfirm} disabled={selectedCount === 0 || isCommitting}>{isCommitting ? 'Importing…' : `Confirm ${selectedCount} Rows`}</button>
        </footer>
      </section>
    </div>
  )
}
