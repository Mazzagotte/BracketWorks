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
  const sectionsWithErrors = new Set(dedupedIssues.filter((issue) => issue.severity === 'error').map((issue) => issue.section));
  const passedCount = sections.filter((section) => !sectionsWithErrors.has(section.key)).length;
  const groupedBySection = sections
    .map((section) => ({
      section,
      issues: dedupedIssues.filter((issue) => issue.section === section.key),
    }))
    .filter((entry) => entry.issues.length > 0);

  return (
    <section className={`${styles.reviewCard} ${styles.preflightResults}`}>
      <div className={styles.preflightMetrics}>
        <article className={styles.preflightMetricPassed}><span>Passed</span><strong>{passedCount}</strong></article>
        <article className={styles.preflightMetricError}><span>Needs Attention</span><strong>{errorCount}</strong></article>
        <article className={styles.preflightMetricWarning}><span>Recommendations</span><strong>{warningCount}</strong></article>
      </div>
      {dedupedIssues.length === 0 ? <div className={styles.preflightReadyMessage}><strong>All required checks passed</strong><p>Your tournament is ready to publish.</p></div> : null}
      {groupedBySection.map(({ section, issues: sectionIssues }) => (
        <div key={section.key} className={styles.preflightGroup}>
          <div className={styles.preflightGroupHead}><strong>{section.label}</strong><span>{sectionIssues.length} item{sectionIssues.length === 1 ? '' : 's'}</span></div>
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
                    <p>{issue.severity === 'error' ? 'This must be resolved before publishing.' : 'Review this setting before publishing.'}</p>
                  </div>
                  <button type="button" className={styles.inlineAction} onClick={() => onNavigate(issue.section)}>
                    Review {sectionMeta?.label ?? 'Section'}
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
