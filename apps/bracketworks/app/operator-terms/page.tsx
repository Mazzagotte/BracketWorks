import type { Metadata } from 'next';
import LegalDocumentPage from '../legal/LegalDocumentPage';

export const metadata: Metadata = { title: 'Tournament Operator Terms | BracketWorks' };
export default function OperatorTermsPage() { return <LegalDocumentPage documentKey="operatorTerms" />; }
