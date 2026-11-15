import type { Metadata } from 'next';

import FindRegistrationForm from '@/components/public/FindRegistrationForm';

export const metadata: Metadata = {
  title: 'Find your registration',
};

export default function FindRegistrationPage() {
  return <FindRegistrationForm />;
}
