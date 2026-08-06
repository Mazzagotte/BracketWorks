import Link from 'next/link';
import buttonStyles from '../styles/buttons.module.css';
import styles from './HelpGuideFooter.module.css';

export default function HelpGuideFooter({ section }: { section: string }) {
  return (
    <div className={styles.footer}>
      <span>See how this area connects to the rest of the tournament.</span>
      <Link href={`/help/getting-started#${section}`} className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`}>View Full Workflow</Link>
    </div>
  );
}
