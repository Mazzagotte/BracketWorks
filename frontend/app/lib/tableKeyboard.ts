import React from 'react'

const FOCUSABLE_SELECTOR = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'

export function handleTableArrowNavigation(event: React.KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return
  }

  const target = event.target as HTMLElement

  // Do not hijack arrow keys while user is actively editing form controls.
  // This avoids disrupting numeric score entry and caret movement.
  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
  ) {
    return
  }

  const currentCell = target.closest('td,th') as HTMLTableCellElement | null
  const currentRow = currentCell?.parentElement as HTMLTableRowElement | null

  if (!currentCell || !currentRow) {
    return
  }

  const tbody = currentRow.closest('tbody')
  if (!tbody) {
    return
  }

  const rows = Array.from(tbody.querySelectorAll('tr')) as HTMLTableRowElement[]
  const rowIndex = rows.indexOf(currentRow)
  const cellIndex = Array.from(currentRow.children).indexOf(currentCell)

  if (rowIndex < 0 || cellIndex < 0) {
    return
  }

  let nextRowIndex = rowIndex
  let nextCellIndex = cellIndex

  switch (event.key) {
    case 'ArrowUp':
      nextRowIndex = Math.max(0, rowIndex - 1)
      break
    case 'ArrowDown':
      nextRowIndex = Math.min(rows.length - 1, rowIndex + 1)
      break
    case 'ArrowLeft':
      nextCellIndex = Math.max(0, cellIndex - 1)
      break
    case 'ArrowRight':
      nextCellIndex = Math.min(currentRow.children.length - 1, cellIndex + 1)
      break
    default:
      return
  }

  const nextRow = rows[nextRowIndex]
  const nextCell = nextRow?.children[nextCellIndex] as HTMLElement | undefined
  if (!nextCell) {
    return
  }

  const nextFocusable = nextCell.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null
  if (nextFocusable) {
    event.preventDefault()
    nextFocusable.focus()
    if ('select' in nextFocusable && typeof (nextFocusable as HTMLInputElement).select === 'function') {
      ;(nextFocusable as HTMLInputElement).select()
    }
    return
  }

  event.preventDefault()
  nextCell.setAttribute('tabindex', '-1')
  nextCell.focus()
}
