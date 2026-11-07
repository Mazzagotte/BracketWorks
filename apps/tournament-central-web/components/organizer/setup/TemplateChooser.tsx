'use client';

import { Badge, Button, Card } from '@bracketworks/ui';

import { TOURNAMENT_TEMPLATES } from '../tournamentTemplates';
import StepHeader from './StepHeader';
import styles from './TemplateChooser.module.css';

type TemplateChooserProps = {
  /** Called with a template id, or null to start blank. */
  onChoose: (templateId: string | null) => void;
  /** Shown when the organizer is changing an earlier choice: go back without changing anything. */
  onCancel?: () => void;
  /** The template already applied, if any. */
  currentTemplateId?: string;
};

/** "What kind of tournament?" Picks a starting template for a new tournament. */
export default function TemplateChooser({ onChoose, onCancel, currentTemplateId }: TemplateChooserProps) {
  return (
    <>
      <StepHeader
        title="What kind of tournament?"
        description={onCancel
          ? 'Picking a type replaces the events, divisions, and add-ons you have now. You can change every setting afterwards.'
          : 'Pick a starting point. It fills in events, divisions, and add-ons with typical settings. You can change every setting afterwards.'}
        actions={(
          <>
            {onCancel ? <Button variant="secondary" onClick={onCancel}>Keep current setup</Button> : null}
            <Button variant="secondary" onClick={() => onChoose(null)}>Start blank</Button>
          </>
        )}
      />
      <ul className={styles.grid} aria-label="Tournament types">
        {TOURNAMENT_TEMPLATES.map((template) => (
          <li key={template.id} className={styles.item}>
            <Card
              as="button"
              interactive
              padding="dense"
              className={styles.option}
              onClick={() => onChoose(template.id)}
            >
              <span className={styles.nameRow}>
                <span className={styles.name}>{template.name}</span>
                {currentTemplateId === template.id ? <Badge tone="neutral">Current</Badge> : null}
              </span>
              <span className={styles.description}>{template.description}</span>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
