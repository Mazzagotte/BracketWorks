import { StatCard, Grid } from '../../components/UI'
import { colors } from '../../lib/design-system'
import { PayoutSummary } from '../hooks/usePayouts'

interface PayoutSummaryStatsProps {
  payoutData: PayoutSummary | null
  loading: boolean
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

export function PayoutSummaryStats({ payoutData, loading }: PayoutSummaryStatsProps) {
  if (loading || !payoutData) {
    return (
      <Grid columns={4} gap="20px" style={{ marginBottom: '24px' }}>
        <StatCard
          label="Total Prize Pool"
          value="Loading..."
          variant="default"
        />
        <StatCard
          label="Scratch Pool"
          value="Loading..."
          variant="default"
        />
        <StatCard
          label="Handicap Pool"
          value="Loading..."
          variant="default"
        />
        <StatCard
          label="Total Winners"
          value="Loading..."
          variant="default"
        />
      </Grid>
    )
  }

  const totalWinners = payoutData.winners_by_bracket.length
  const avgPayout = totalWinners > 0 
    ? payoutData.total_prize_pool / totalWinners 
    : 0

  return (
    <Grid columns={4} gap="20px" style={{ marginBottom: '24px' }}>
      <StatCard
        label="Total Prize Pool"
        value={formatCurrency(payoutData.total_prize_pool)}
        variant="success"
        icon="💰"
      />
      <StatCard
        label="Scratch Pool"
        value={formatCurrency(payoutData.total_scratch_pool)}
        variant="info"
        icon="🎯"
      />
      <StatCard
        label="Handicap Pool"
        value={formatCurrency(payoutData.total_handicap_pool)}
        variant="warning"
        icon="⚖️"
      />
      <StatCard
        label="Total Winners"
        value={totalWinners.toString()}
        subtitle={`Avg: ${formatCurrency(avgPayout)}`}
        variant="default"
        icon="🏆"
      />
    </Grid>
  )
}
