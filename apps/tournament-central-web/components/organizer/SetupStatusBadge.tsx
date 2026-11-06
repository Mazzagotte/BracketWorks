import { Badge } from '@bracketworks/ui';
import type { BadgeProps } from '@bracketworks/ui';

import type { SetupStatus } from './types';

const statusBadge: Record<SetupStatus, { label: string; tone: NonNullable<BadgeProps['tone']> }> = {
  complete: { label: 'Complete', tone: 'success' },
  incomplete: { label: 'Incomplete', tone: 'neutral' },
  'needs-attention': { label: 'Needs attention', tone: 'warning' },
  'not-used': { label: 'Not used', tone: 'neutral' },
};

export default function SetupStatusBadge({ status }: { status: SetupStatus }) {
  const { label, tone } = statusBadge[status];
  return <Badge tone={tone}>{label}</Badge>;
}
