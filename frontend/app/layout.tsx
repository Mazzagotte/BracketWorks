


import './styles/globals.css'
import Header from './components/Header';

export const metadata = {
  title: 'BracketWorks',
  description: 'Bowling brackets & side pots manager',
  manifest: '/manifest.json'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <div className="container">
          {children}
        </div>
      </body>
    </html>
  );
}
