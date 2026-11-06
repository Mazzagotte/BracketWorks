import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthShell, ICON_SIZE } from '@bracketworks/ui';

const TOURNAMENT_CENTRAL_URL = 'https://tournamentcentral.app/login';

const features = [
  { title: 'Organize your tournament', description: 'Manage entries, squads, divisions, formats, and bowler information.' },
  { title: 'Run brackets and side pots', description: 'Generate brackets, advance winners, and calculate payouts.' },
  { title: 'Publish live results', description: 'Enter scores and share standings, brackets, and updates as they happen.' },
] as const;

interface BWAuthShellProps {
  title: string;
  subtitle?: ReactNode;
  switchRow?: ReactNode;
  children: ReactNode;
}

/** BracketWorks login, signup, and password pages on the shared AuthShell (same design as Tournament Central). */
export default function BWAuthShell({ title, subtitle, switchRow, children }: BWAuthShellProps) {
  return (
    <AuthShell
      brand={(
        <Link href="/" aria-label="BracketWorks home">
          <Image src="/logo_no_text.svg" alt="" width={ICON_SIZE['3xl']} height={ICON_SIZE['3xl']} priority />
          BracketWorks
        </Link>
      )}
      introTitle="Run your tournament without the spreadsheets."
      introText="Manage entries, brackets, side pots, scores, standings, and payouts from one organized workspace."
      features={features}
      crossLink={<>Looking for a tournament? <a href={TOURNAMENT_CENTRAL_URL}>Find tournaments and register on Tournament Central</a>.</>}
      title={title}
      subtitle={subtitle}
      switchRow={switchRow}
      footer={<>&copy; {new Date().getFullYear()} BracketWorks and Tournament Central. All rights reserved.</>}
    >
      {children}
    </AuthShell>
  );
}
