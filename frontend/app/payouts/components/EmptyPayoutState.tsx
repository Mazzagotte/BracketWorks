import { Card } from '../../components/UI'
import EnhancedButton from '../../components/EnhancedButton'

interface EmptyPayoutStateProps {
  title?: string
  message?: string
  actionText?: string
  actionLink?: string
  icon?: string
}

export function EmptyPayoutState({
  title = 'No Payout Data Available',
  message = 'There are no brackets or winners to display payouts for yet.',
  actionText,
  actionLink,
  icon = 'WIN'
}: EmptyPayoutStateProps) {
  return (
    <Card>
      <div className="bw-empty-payout-wrap">
        <div className="bw-empty-payout-icon">
          {icon}
        </div>

        <h3 className="bw-empty-payout-title">
          {title}
        </h3>

        <p className={`bw-empty-payout-text ${actionText ? 'bw-empty-payout-text-with-action' : ''}`}>
          {message}
        </p>

        {actionText && actionLink && (
          <div className="bw-empty-payout-action">
            <EnhancedButton
              variant="primary"
              onClick={() => { window.location.href = actionLink }}
            >
              {actionText}
            </EnhancedButton>
          </div>
        )}
      </div>
    </Card>
  )
}
