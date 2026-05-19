"use client";

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const ProtectedRouteShell = dynamic(() => import('./ProtectedRouteShell'));

const PUBLIC_ROUTE_PREFIXES = ['/login', '/signup', '/reset-password', '/verify-email', '/view'];

function isPublicRoute(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  if (pathname === '/') {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function RouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return <ProtectedRouteShell>{children}</ProtectedRouteShell>;
}