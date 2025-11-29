import { colors, spacing } from '../../lib/design-system'
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
  icon = '🏆'
}: EmptyPayoutStateProps) {
  return (
    <Card>
      <div style={{
        textAlign: 'center',
        padding: `${spacing.xl} ${spacing.lg}`,
        color: colors.text.secondary
      }}>
        <div style={{ fontSize: '64px', marginBottom: spacing.md }}>
          {icon}
        </div>
        
        <h3 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: colors.text.primary,
          marginBottom: spacing.sm
        }}>
          {title}
        </h3>
        
        <p style={{
          fontSize: '16px',
          color: colors.text.secondary,
          marginBottom: actionText ? spacing.lg : 0,
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          {message}
        </p>
        
        {actionText && actionLink && (
          <div style={{ marginTop: spacing.lg }}>
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
