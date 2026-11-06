import styles from './publicInfo.module.css';

export type PublicTournamentDocument = { name: string; kind: string; url: string };

export default function TournamentRules({ rulesText, documents = [] }: {
  rulesText?: string;
  documents?: PublicTournamentDocument[];
}) {
  const hasRules = Boolean(rulesText?.trim());
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>Rules and documents</h3>
      {hasRules ? <div className={styles.rulesText}>{rulesText}</div> : null}
      {documents.length > 0 ? (
        <ul className={styles.documents}>
          {documents.map((document) => (
            <li key={document.url}>
              <a href={document.url} download>{document.name} ({document.kind.replaceAll('_', ' ')})</a>
            </li>
          ))}
        </ul>
      ) : null}
      {!hasRules && documents.length === 0 ? <p className={styles.empty}>Rules and documents have not been posted.</p> : null}
    </section>
  );
}
