export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 56 56"
      className="w-full h-full"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left column - Round 1 */}
      {/* Top slot */}
      <rect x="4" y="8" width="10" height="6" rx="1" fill="currentColor" opacity="0.6" />
      {/* Middle slot */}
      <rect x="4" y="25" width="10" height="6" rx="1" fill="currentColor" opacity="0.6" />
      {/* Bottom slot */}
      <rect x="4" y="42" width="10" height="6" rx="1" fill="currentColor" opacity="0.6" />

      {/* Connecting lines from left to middle */}
      {/* Top to middle connector */}
      <line x1="14" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="20" y1="11" x2="20" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="20" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />

      {/* Bottom to middle connector */}
      <line x1="14" y1="45" x2="20" y2="45" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="20" y1="45" x2="20" y2="36" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="20" y1="36" x2="26" y2="36" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />

      {/* Middle column - Round 2 */}
      {/* Top finalist */}
      <rect x="26" y="16" width="10" height="6" rx="1" fill="currentColor" opacity="0.8" />
      {/* Bottom finalist */}
      <rect x="26" y="34" width="10" height="6" rx="1" fill="currentColor" opacity="0.8" />

      {/* Connecting lines to finals */}
      <line x1="36" y1="19" x2="42" y2="19" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="42" y1="19" x2="42" y2="28" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="42" y1="28" x2="42" y2="37" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="36" y1="37" x2="42" y2="37" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />

      {/* Right column - Finals Winner */}
      <rect x="42" y="24" width="10" height="6" rx="1" fill="currentColor" opacity="1" />

      {/* Crown accent on winner */}
      <path
        d="M47 22L48 20L49 22"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
