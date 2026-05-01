import React from 'react';

export interface EmptyBracketStateProps {
  onGenerateClick: () => void;
  showDemo?: boolean;
  message?: string;
}

export function EmptyBracketState({ onGenerateClick }: EmptyBracketStateProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <div style={{
        background: 'var(--color-brand-ivory-light)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-soft)',
        padding: '32px 36px 36px',
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h2 style={{ fontWeight: 700, fontSize: '26px', color: 'var(--color-text-primary)', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          No Brackets Generated Yet
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
          Your tournament is loaded. Generate brackets to seed matchups, start scoring, and track winners in real time.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onGenerateClick} className="ds-btn ds-btn-primary ds-btn-md">
            Generate Brackets
          </button>
          <a href="/dashboard" className="ds-btn ds-btn-secondary ds-btn-md">
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
