import type { ValidationIssue, SetupSection, SetupSectionKey } from './types';
import styles from './tournament-setup.module.css';

type PublishValidationSummaryProps = {
  issues: ValidationIssue[];
  sections: SetupSection[];
  onNavigate: (section: SetupSectionKey) => void;
};

const sectionMap = (sections: SetupSection[]) => new Map(sections.map((section) => [section.key, section]));

export default function PublishValidationSummary({ issues, sections, onNavigate }: PublishValidationSummaryProps) {
  const sectionByKey = sectionMap(sections);
  const dedupedIssues = issues.filter((issue, index, list) => {
    const key = `${issue.section}::${issue.severity}::${issue.message}`;
    return list.findIndex((entry) => `${entry.section}::${entry.severity}::${entry.message}` === key) === index;
  });
  const errorCount = dedupedIssues.filter((issue) => issue.severity === 'error').length;
  const warningCount = dedupedIssues.filter((issue) => issue.severity === 'warning').length;
  const groupedBySection = sections
    .map((section) => ({
      section,
      issues: dedupedIssues.filter((issue) => issue.section === section.key),
    }))
    .filter((entry) => entry.issues.length > 0);

  if (issues.length === 0) {
    return (
      <section className={styles.reviewCard}>
        <h3>Ready to publish</h3>
        <p>All required setup checks passed. You can publish when ready.</p>
      </section>
    );
  }

  return (
    <section className={styles.reviewCard}>
      <h3>Validation summary</h3>
      <p>
        Resolve critical issues before publishing. Warnings can be addressed now or later.
        {' '}
        {errorCount} error{errorCount === 1 ? '' : 's'}, {warningCount} warning{warningCount === 1 ? '' : 's'}.
      </p>
      {groupedBySection.map(({ section, issues: sectionIssues }) => (
        <div key={section.key}>
          <p><strong>{section.label}</strong> ({sectionIssues.length})</p>
          <ul className={styles.validationList}>
            {sectionIssues.map((issue) => {
              const sectionMeta = sectionByKey.get(issue.section);
              return (
                <li key={issue.id} className={styles.validationItem}>
                  <span className={`${styles.validationSeverity} ${issue.severity === 'error' ? styles.validationError : styles.validationWarning}`}>
                    {issue.severity === 'error' ? 'Error' : 'Warning'}
                  </span>
                  <div>
                    <strong>{issue.message}</strong>
                    <p>{sectionMeta?.label ?? issue.section}</p>
                  </div>
                  <button type="button" className={styles.inlineAction} onClick={() => onNavigate(issue.section)}>
                    Open section
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
