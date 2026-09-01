import Link from 'next/link';

import TournamentCard from './TournamentCard';
import type { OrganizerDashboardTournament } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';

type TournamentGridProps = {
  tournaments: OrganizerDashboardTournament[];
  deletingTournamentId: number | null;
  onDeleteTournament: (tournament: OrganizerDashboardTournament) => void;
};

export default function TournamentGrid({ tournaments, deletingTournamentId, onDeleteTournament }: TournamentGridProps) {
  return (
    <section aria-label="Your tournaments" className={styles.mainSection}>
      <div className={styles.sectionHeader}>
        <h2>Your Tournaments</h2>
        <Link href="/organizer/tournaments" className={styles.inlineLink}>View all →</Link>
      </div>
      <div className={styles.grid}>
        {tournaments.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            isDeleting={deletingTournamentId === tournament.id}
            onDelete={onDeleteTournament}
          />
        ))}
      </div>
    </section>
  );
}
