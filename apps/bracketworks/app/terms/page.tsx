import type { Metadata } from 'next';
import LegalDocumentPage from '../legal/LegalDocumentPage';

export const metadata: Metadata = { title: 'Terms of Service | BracketWorks' };
export default function TermsPage() { return <LegalDocumentPage documentKey="terms" />; }
