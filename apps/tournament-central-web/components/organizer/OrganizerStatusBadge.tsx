import { Badge } from '@bracketworks/ui';
import type { BadgeProps } from '@bracketworks/ui';

const labels: Record<string, string> = {
  mixed: 'Partial',
  private: 'Private',
};

type Tone = NonNullable<BadgeProps['tone']>;

const tones: Record<string, Tone> = {
  paid: 'success', published: 'success', open: 'success', available: 'success', completed: 'success', confirmed: 'success',
  pending: 'warning', waitlisted: 'warning', waitlist: 'warning', 'nearly full': 'warning', mixed: 'warning',
  cancelled: 'danger', refunded: 'danger', closed: 'danger', full: 'danger',
  unpaid: 'neutral', draft: 'neutral', private: 'neutral',
};

/** Maps a registration, payment, or squad status string to the shared `Badge`, in sentence case. */
export default function OrganizerStatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = (status || 'pending').trim().toLowerCase();
  const label = labels[normalized] ?? normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return <Badge tone={tones[normalized] ?? 'neutral'}>{label}</Badge>;
}
