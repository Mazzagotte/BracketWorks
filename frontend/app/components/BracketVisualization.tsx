export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-full h-full"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left - 4 entry lines */}
      <line x1="4" y1="4" x2="8" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="18" x2="8" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="24" x2="8" y2="24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      
      {/* Stage 1 - 4 to 2 */}
      <line x1="8" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="4" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      
      <line x1="8" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="10" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      
      <line x1="8" y1="18" x2="12" y2="18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="21" x2="14" y2="21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      
      <line x1="8" y1="24" x2="12" y2="24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="24" x2="12" y2="21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      
      {/* Stage 2 - 2 to 1 (winner) */}
      <line x1="14" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="18" y1="7" x2="18" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="18" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      
      <line x1="14" y1="21" x2="18" y2="21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="18" y1="21" x2="18" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
