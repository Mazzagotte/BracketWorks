import '../styles/main.css';
import '@bracketworks/ui/bracketworks-public-header.css';

export const metadata = {
  title: 'Tournament Central',
  description: 'Tournament discovery and registration by BracketWorks.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
