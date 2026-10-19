import styles from '@/app/page.module.css';

export type PublicTournamentDocument = { name: string; kind: string; url: string };

export default function TournamentRules({ rulesText, documents = [] }: {
  rulesText?: string;
  documents?: PublicTournamentDocument[];
}) {
  return <section className={styles.informationSection}>
    <h3>Rules and documents</h3>
    {rulesText?.trim() && <div className={styles.tournamentRulesText}>{rulesText}</div>}
    {documents.length > 0 && <ul className={styles.informationDocumentList}>{documents.map((document) => <li key={document.url}>
      <a href={document.url} download>{document.name} ({document.kind.replaceAll('_', ' ')})</a>
    </li>)}</ul>}
    {!rulesText?.trim() && documents.length === 0 && <p className={styles.informationEmpty}>Rules and documents have not been posted.</p>}
  </section>;
}
