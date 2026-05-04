import { StatCard, Grid } from '../../components/UI'
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
      <div className="bw-payout-stats-mb">
        <Grid columns="4" gap="20px">
          <StatCard
            title="Total Prize Pool"
            value="Loading..."
            color="default"
          />
          <StatCard
            title="Scratch Pool"
            value="Loading..."
            color="default"
          />
          <StatCard
            title="Handicap Pool"
            value="Loading..."
            color="default"
          />
          <StatCard
            title="Total Winners"
            value="Loading..."
            color="default"
          />
        </Grid>
      </div>
    )
  }

  const totalWinners = payoutData.winners_by_bracket.length
  const avgPayout = totalWinners > 0 
    ? payoutData.total_prize_pool / totalWinners 
    : 0

  return (
    <div className="bw-payout-stats-mb">
      <Grid columns="4" gap="20px">
        <StatCard
          title="Total Prize Pool"
          value={formatCurrency(payoutData.total_prize_pool)}
          color="success"
          icon="💰"
        />
        <StatCard
          title="Scratch Pool"
          value={formatCurrency(payoutData.total_scratch_pool)}
          color="primary"
          icon="🎯"
        />
        <StatCard
          title="Handicap Pool"
          value={formatCurrency(payoutData.total_handicap_pool)}
          color="warning"
          icon="⚖️"
        />
        <StatCard
          title="Total Winners"
          value={totalWinners.toString()}
          subtitle={`Avg: ${formatCurrency(avgPayout)}`}
          color="default"
          icon="🏆"
        />
      </Grid>
    </div>
  )
}
