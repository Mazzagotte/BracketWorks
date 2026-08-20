import { useCallback, useMemo, useState } from 'react'

import { Toast } from '../../components/Toast'
import { formatShortMonthDayYear } from '../../lib/formatters'
import { printHtmlDocument } from '../../lib/printExport'
import { Squad, Tournament } from '../../lib/types'
import { PayoutSummary } from './usePayouts'
import { SidePotSummary } from './useSidePotAccounting'
import { AggregatedWinner, buildPayoutExportRows, buildSidePotByPlayer } from '../utils/payoutExportRows'
import { buildPayoutExcelBuffer } from '../utils/payoutExcelExport'
import { buildPayoutPdfHtml } from '../utils/payoutPdfExport'

type AddToast = (payload: Omit<Toast, 'id'>) => string

type UsePayoutExportArgs = {
  addToast: AddToast
  winners: AggregatedWinner[]
  paidKeys: Set<string>
  payoutData: PayoutSummary | null
  sidePotSummaries: SidePotSummary[]
  selectedTournament: Tournament | null
  selectedSquad: Squad | null
}

function getExportBaseContext(
  payoutData: PayoutSummary | null,
  sidePotSummaries: SidePotSummary[],
  selectedTournament: Tournament | null,
  selectedSquad: Squad | null,
) {
  const allBrackets = [
    ...(payoutData?.scratch_brackets ?? []),
    ...(payoutData?.handicap_brackets ?? []),
  ]

  const totalEntries = allBrackets.reduce((sum, bracket) => sum + bracket.bracket_size, 0)
  const programs = [
    ...(payoutData?.program_summaries ?? []).filter((program) => program.total_brackets > 0).map((program) => program.name),
    ...sidePotSummaries.filter((summary) => summary.pool > 0).map((summary) => summary.name),
  ].join(' / ') || 'N/A'

  const tournamentName = selectedTournament?.name || 'Unknown Tournament'
  const squadLabel = selectedSquad
    ? `${selectedSquad.date || ''} — ${selectedSquad.time || ''}`.trim()
    : 'All Squads'

  return {
    allBrackets,
    totalEntries,
    programs,
    tournamentName,
    squadLabel,
  }
}

function buildExportFileName(
  selectedTournament: Tournament | null,
  selectedSquad: Squad | null,
  suffix: 'xlsx' | 'pdf',
): string {
  const safeTournament = (selectedTournament?.name || 'Tournament')
    .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Tournament'

  const safeDate = selectedSquad?.date
    ? selectedSquad.date.replace(/[^a-zA-Z0-9\-]/g, '')
    : new Date().toISOString().slice(0, 10)

  return `Payout_Distribution_${safeTournament}_${safeDate}.${suffix}`
}

export function usePayoutExport({
  addToast,
  winners,
  paidKeys,
  payoutData,
  sidePotSummaries,
  selectedTournament,
  selectedSquad,
}: UsePayoutExportArgs) {
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const sidePotByPlayer = useMemo(() => buildSidePotByPlayer(sidePotSummaries), [sidePotSummaries])

  const exportToExcel = useCallback(async () => {
    if (winners.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingExcel(true)
    try {
      const rows = buildPayoutExportRows(winners, sidePotByPlayer, paidKeys)
      const context = getExportBaseContext(payoutData, sidePotSummaries, selectedTournament, selectedSquad)
      const generatedAt = new Date().toLocaleString()

      const xlsxBuffer = await buildPayoutExcelBuffer({
        rows,
        programs: context.programs,
        totalBrackets: context.allBrackets.length,
        totalEntries: context.totalEntries,
        tournamentName: context.tournamentName,
        squadLabel: context.squadLabel,
        generatedAt,
      })

      const blob = new Blob([xlsxBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = buildExportFileName(selectedTournament, selectedSquad, 'xlsx')
      link.click()
      URL.revokeObjectURL(url)

      addToast({
        type: 'success',
        message: `Exported ${rows.length} payout row${rows.length !== 1 ? 's' : ''} to Excel.`,
        duration: 3000,
      })
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      })
    } finally {
      setIsExportingExcel(false)
    }
  }, [addToast, paidKeys, payoutData, selectedSquad, selectedTournament, sidePotByPlayer, sidePotSummaries, winners])

  const exportToPdf = useCallback(() => {
    if (winners.length === 0) {
      addToast({ type: 'warning', message: 'No payout rows to export.', duration: 3000 })
      return
    }

    setIsExportingPdf(true)
    try {
      const rows = buildPayoutExportRows(winners, sidePotByPlayer, paidKeys)
      const context = getExportBaseContext(payoutData, sidePotSummaries, selectedTournament, selectedSquad)
      const generatedAt = new Date().toLocaleString()
      const paidStampDate = formatShortMonthDayYear(new Date())
      const logoUrl = `${window.location.origin}/logo_no_text.svg`

      const html = buildPayoutPdfHtml({
        rows,
        tournamentName: context.tournamentName,
        squadLabel: context.squadLabel,
        generatedAt,
        paidStampDate,
        logoUrl,
        programs: context.programs,
        totalBrackets: context.allBrackets.length,
        totalEntries: context.totalEntries,
      })

      printHtmlDocument({
        html,
        documentTitle: buildExportFileName(selectedTournament, selectedSquad, 'pdf').replace('.pdf', ''),
      })

      addToast({
        type: 'success',
        message: `Prepared ${rows.length} payout row${rows.length !== 1 ? 's' : ''} for PDF export.`,
        duration: 3000,
      })
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      })
    } finally {
      setIsExportingPdf(false)
    }
  }, [addToast, paidKeys, payoutData, selectedSquad, selectedTournament, sidePotByPlayer, sidePotSummaries, winners])

  return {
    isExportingExcel,
    isExportingPdf,
    exportToExcel,
    exportToPdf,
    sidePotByPlayer,
  }
}
