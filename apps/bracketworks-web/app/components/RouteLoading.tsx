import { Card, Page } from '@bracketworks/ui';

import { DelayedRouteFallback } from './DelayedRouteFallback';
import styles from './RouteLoading.module.css';

/** Route-level loading state: a plain status line, shown only if loading takes a moment. */
export default function RouteLoading({ label }: { label: string }) {
  return (
    <DelayedRouteFallback>
      <Page>
        <Card>
          <p className={styles.status} role="status">{label}</p>
        </Card>
      </Page>
    </DelayedRouteFallback>
  );
}
