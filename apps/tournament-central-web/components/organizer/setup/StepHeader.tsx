import type { ReactNode } from 'react';

import SetupStatusBadge from '../SetupStatusBadge';
import type { SetupStatus } from '../types';
import layout from './setupLayout.module.css';

type StepHeaderProps = {
  title: string;
  description: ReactNode;
  status?: SetupStatus;
  /** Step-level actions on the right, for example "Add squad". */
  actions?: ReactNode;
};

/** Title row for a setup step. It sits on the page; the step's topics are cards below it. */
export default function StepHeader({ title, description, status, actions }: StepHeaderProps) {
  return (
    <header className={layout.stepHeader}>
      <div className={layout.stepHeaderText}>
        <div className={layout.stepTitleRow}>
          <h2 className={layout.stepTitle}>{title}</h2>
          {status ? <SetupStatusBadge status={status} /> : null}
        </div>
        <p className={layout.stepDescription}>{description}</p>
      </div>
      {actions ? <div className={layout.stepActions}>{actions}</div> : null}
    </header>
  );
}
