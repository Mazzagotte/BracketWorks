import { Suspense } from 'react';

import SignInForm from '@/components/auth/SignInForm';

export default function LoginPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
