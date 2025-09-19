"use client";


import './styles/globals.css';
import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';


function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginPage, setIsLoginPage] = useState(false);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('user_id'));
    setIsLoginPage(window.location.pathname === '/login');
    setFirstName(localStorage.getItem('first_name') || undefined);
  }, []);

  return (
    <>
      {isLoginPage ? (
        children
      ) : (
        <>
          {isLoggedIn && <Sidebar firstName={firstName} />}
          <div className="container" style={{ marginLeft: isLoggedIn ? '200px' : '0' }}>
            {children}
          </div>
        </>
      )}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
