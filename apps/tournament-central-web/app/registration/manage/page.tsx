import type { Metadata } from 'next';
import { Suspense } from 'react';

import ManageRegistration from '@/components/public/ManageRegistration';

export const metadata: Metadata = {
  title: 'Manage registration',
  robots: { index: false, follow: false },
};

export default function ManageRegistrationPage() {
  return (
    <Suspense>
      <ManageRegistration />
    </Suspense>
  );
}
