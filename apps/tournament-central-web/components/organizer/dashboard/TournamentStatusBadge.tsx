import { Badge } from '@bracketworks/ui';

type TournamentStatusBadgeProps = {
  isPublic: boolean;
  hasPublishedSetup: boolean;
};

export default function TournamentStatusBadge({ isPublic, hasPublishedSetup }: TournamentStatusBadgeProps) {
  if (!hasPublishedSetup) return <Badge tone="warning">Draft</Badge>;
  if (!isPublic) return <Badge tone="neutral">Private</Badge>;
  return <Badge tone="success">Published</Badge>;
}
