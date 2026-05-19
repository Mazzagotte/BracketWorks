import type { ReactNode } from 'react';

import { ToastProvider } from '../components/Toast';
import '../styles/auth.css';

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}