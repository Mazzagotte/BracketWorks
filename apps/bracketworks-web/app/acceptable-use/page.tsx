import type { Metadata } from 'next';
import LegalDocumentPage from '../legal/LegalDocumentPage';

export const metadata: Metadata = { title: 'Acceptable Use | BracketWorks' };
export default function AcceptableUsePage() { return <LegalDocumentPage documentKey="acceptableUse" />; }
