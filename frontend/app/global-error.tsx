'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="bw-global-error-wrap">
          <div className="bw-global-error-card">
            <h2 className="bw-global-error-title">Something went wrong</h2>
            <button
              onClick={() => reset()}
              className="bw-global-error-btn"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
