import Link from 'next/link';

export interface EmptyBracketStateProps {
  onGenerateClick: () => void;
  showDemo?: boolean;
  message?: string;
}

export function EmptyBracketState({ onGenerateClick }: EmptyBracketStateProps) {
  return (
    <div className="bw-empty-wrap">
      <div className="bw-payout-empty-card">
        <h2 className="bw-payout-empty-title">
          No Brackets Generated Yet
        </h2>
        <p className="bw-payout-empty-text">
          Your tournament is loaded. Generate brackets to seed matchups, start scoring, and track winners in real time.
        </p>
        <div className="bw-payout-empty-actions">
          <button onClick={onGenerateClick} className="ds-btn ds-btn-primary ds-btn-md">
            Generate Brackets
          </button>
          <Link href="/dashboard" className="ds-btn ds-btn-secondary ds-btn-md">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
