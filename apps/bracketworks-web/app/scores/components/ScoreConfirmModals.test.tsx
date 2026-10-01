import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScoreCorrectionModal } from './ScoreConfirmModals'

describe('ScoreCorrectionModal', () => {
  it('shows the changed score and requires a reason before saving', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ScoreCorrectionModal
        request={{
          playerName: 'Jamie Bowler',
          field: 'game1_scratch',
          previousValue: 198,
          nextValue: 200,
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Confirm Score Correction' })).toBeTruthy()
    expect(screen.getByText((_, element) => (
      element?.tagName === 'P'
      && element.textContent?.replace(/\s+/g, ' ').includes('Change Game 1 for Jamie Bowler from 198 to 200') === true
    ))).toBeTruthy()
    const saveButton = screen.getByRole('button', { name: 'Save Correction' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Correcting the score sheet' },
    })
    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    expect(onConfirm).toHaveBeenCalledWith('Correcting the score sheet')
    expect(onCancel).not.toHaveBeenCalled()
  })
})