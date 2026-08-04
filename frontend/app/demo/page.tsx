import type { Metadata } from 'next';
import Link from 'next/link';
import DemoDashboard from './DemoDashboard';
import styles from './demo.module.css';

export const metadata: Metadata = { title: 'Tournament Dashboard | BracketWorks', description: 'Explore The Famous Frames Invitational tournament dashboard in BracketWorks.', robots: { index: true, follow: true } };

export default function DemoPage() {
  return <div className={styles.page}><div className={styles.shell}><div className={styles.backRow}><Link href="/">Back to BracketWorks home</Link><span>The Famous Frames Invitational</span></div><DemoDashboard /></div></div>;
}
