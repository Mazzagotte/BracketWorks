import { Badge, Button, Card, CardDivider, CardHeader, Notice } from '@bracketworks/ui';
import { Fragment } from 'react';

import type { ValidationIssue, SetupSection, SetupSectionKey } from './types';
import layout from './setup/setupLayout.module.css';

type PublishValidationSummaryProps = {
  issues: ValidationIssue[];
  sections: SetupSection[];
  onNavigate: (section: SetupSectionKey) => void;
  /** ISO time of the last manual check, if any. */
  checkedAt?: string | null;
};

/** Preflight results: counts in the header, then issues grouped by setup step as divider rows. */
export default function PublishValidationSummary({ issues, sections, onNavigate, checkedAt }: PublishValidationSummaryProps) {
  const dedupedIssues = issues.filter((issue, index, list) => {
    const key = `${issue.section}::${issue.severity}::${issue.message}`;
    return list.findIndex((entry) => `${entry.section}::${entry.severity}::${entry.message}` === key) === index;
  });
  const errorCount = dedupedIssues.filter((issue) => issue.severity === 'error').length;
  const warningCount = dedupedIssues.filter((issue) => issue.severity === 'warning').length;
  const sectionsWithErrors = new Set(dedupedIssues.filter((issue) => issue.severity === 'error').map((issue) => issue.section));
  const passedCount = sections.filter((section) => !sectionsWithErrors.has(section.key)).length;
  const groupedBySection = sections
    .map((section) => ({ section, issues: dedupedIssues.filter((issue) => issue.section === section.key) }))
    .filter((entry) => entry.issues.length > 0);

  return (
    <Card aria-label="Preflight checks">
      <CardHeader
        title="Preflight checks"
        description={`${passedCount} of ${sections.length} steps passed · ${errorCount} required · ${warningCount} recommended · ${checkedAt ? `Last checked ${new Date(checkedAt).toLocaleTimeString()}` : 'Checks update as setup changes'}`}
        headingLevel="h3"
      />
      {dedupedIssues.length === 0 ? (
        <Notice tone="success">All required checks passed. Your tournament is ready to publish.</Notice>
      ) : (
        <div className={layout.stack}>
          {groupedBySection.map(({ section, issues: sectionIssues }, index) => (
            <Fragment key={section.key}>
              {index > 0 ? <CardDivider /> : null}
              <div className={layout.groupHeader}>
                <h4 className={layout.subsectionTitle}>{section.label}</h4>
                <Button size="sm" variant="ghost" onClick={() => onNavigate(section.key)}>Go to {section.label.toLowerCase()}</Button>
              </div>
              <ul className={layout.rows}>
                {sectionIssues.map((issue) => (
                  <li key={issue.id} className={layout.row}>
                    <div className={layout.rowText}>
                      <span className={layout.rowTitle}>
                        <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>{issue.severity === 'error' ? 'Required' : 'Recommended'}</Badge>
                        {issue.message}
                      </span>
                      <span className={layout.rowMeta}>
                        {issue.severity === 'error' ? 'Resolve this before publishing.' : 'Review this setting before publishing.'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
      )}
    </Card>
  );
}
