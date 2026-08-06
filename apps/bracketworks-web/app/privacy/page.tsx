import type { Metadata } from 'next';
import LegalDocumentPage from '../legal/LegalDocumentPage';

export const metadata: Metadata = { title: 'Privacy Policy | BracketWorks' };
export default function PrivacyPage() { return <LegalDocumentPage documentKey="privacy" />; }
