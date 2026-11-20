import { Badge } from '@bracketworks/ui';

type TournamentStatusBadgeProps = {
  isPublic: boolean;
  hasPublishedSetup: boolean;
  /** From the published setup. Unlisted tournaments are live but only reachable by link. */
  visibility?: 'public' | 'unlisted' | 'private' | null;
};

/** Who can see the tournament: Draft, Private, Unlisted, or Published. */
export default function TournamentStatusBadge({ isPublic, hasPublishedSetup, visibility }: TournamentStatusBadgeProps) {
  if (!hasPublishedSetup) return <Badge tone="warning">Draft</Badge>;
  if (!isPublic) return <Badge tone="neutral">Private</Badge>;
  if (visibility === 'unlisted') return <Badge tone="neutral">Unlisted</Badge>;
  return <Badge tone="success">Published</Badge>;
}
