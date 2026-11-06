'use client';

import '@bracketworks/ui/styles/globals.css';
import './globals.css';
import { AlertTriangle } from 'lucide-react';
import { Button, ButtonLink, Card, EmptyState, ICON_SIZE, Page } from '@bracketworks/ui';

/**
 * Shown when the root layout itself fails. Next.js renders this without the root layout,
 * so it loads the shared styles on its own.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main>
          <Page width="narrow">
            <Card>
              <EmptyState
                icon={<AlertTriangle size={ICON_SIZE['2xl']} aria-hidden="true" />}
                title="Something went wrong"
                description={error.digest
                  ? `Tournament Central could not load this page. Reference: ${error.digest}`
                  : 'Tournament Central could not load this page.'}
                action={(
                  <>
                    <Button variant="primary" onClick={() => reset()}>Try again</Button>
                    <ButtonLink variant="secondary" href="/">Go to the homepage</ButtonLink>
                  </>
                )}
              />
            </Card>
          </Page>
        </main>
      </body>
    </html>
  );
}
