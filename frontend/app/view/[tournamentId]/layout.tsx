import type { Metadata } from 'next';

export async function generateMetadata(
  { params }: { params: Promise<{ tournamentId: string }> }
): Promise<Metadata> {
  const { tournamentId } = await params;
  return {
    title: 'Tournament View | BracketWorks',
    alternates: { canonical: `https://bracketworks.app/view/${encodeURIComponent(tournamentId)}` },
  };
}

export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
