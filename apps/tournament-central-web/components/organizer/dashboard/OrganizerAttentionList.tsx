import type { OrganizerAttentionItem } from './useOrganizerDashboard';
import AttentionList from '../AttentionList';
import { organizerRoutes } from '../organizerRoutes';

type OrganizerAttentionListProps = {
  items: OrganizerAttentionItem[];
};

/** Dashboard attention items across all tournaments; each links to that tournament's overview. */
export default function OrganizerAttentionList({ items }: OrganizerAttentionListProps) {
  return (
    <AttentionList
      items={items.map((item) => ({
        id: item.id,
        message: item.message,
        href: organizerRoutes.overview(item.tournamentId),
        linkLabel: `Manage: ${item.message}`,
      }))}
    />
  );
}
