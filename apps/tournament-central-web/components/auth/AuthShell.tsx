import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthShell as SharedAuthShell, ICON_SIZE } from '@bracketworks/ui';

const BRACKETWORKS_URL = 'https://bracketworks.app/login';

type AuthShellProps = {
  mode: 'login' | 'signup';
  title: string;
  subtitle: string;
  children: ReactNode;
  showSwitchRow?: boolean;
};

const features = [
  { title: 'Discover tournaments', description: 'Find upcoming bowling tournaments by location, date, and format.' },
  { title: 'Register in one place', description: 'Enter tournaments and choose squads, divisions, and events.' },
  { title: 'Stay connected', description: 'See tournament information, availability, and results.' },
] as const;

/** Tournament Central sign-in, signup, forgot password, and verify email frame, on the shared AuthShell. */
export default function AuthShell({ mode, title, subtitle, children, showSwitchRow = true }: AuthShellProps) {
  const isLogin = mode === 'login';

  return (
    <SharedAuthShell
      brand={(
        <Link href="/" aria-label="Tournament Central home">
          <Image src="/TC_logo_No_Text.svg" alt="" width={ICON_SIZE['3xl']} height={ICON_SIZE['3xl']} priority />
          Tournament Central
        </Link>
      )}
      introTitle="Your tournament starts here."
      introText="Find bowling tournaments near you, register your squad, and keep up with everything on tournament day."
      features={features}
      crossLink={<>Running a tournament? <a href={BRACKETWORKS_URL}>Manage brackets, scores, and payouts in BracketWorks</a>.</>}
      title={title}
      subtitle={subtitle}
      switchRow={showSwitchRow ? (
        isLogin
          ? <>New to Tournament Central? <Link href="/signup">Create an account</Link></>
          : <>Already have an account? <Link href="/login">Sign in</Link></>
      ) : undefined}
      footer={<>&copy; {new Date().getFullYear()} BracketWorks and Tournament Central. All rights reserved.</>}
    >
      {children}
    </SharedAuthShell>
  );
}
