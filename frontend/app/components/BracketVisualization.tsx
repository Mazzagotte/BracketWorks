export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-full h-full"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left - 8 entry lines */}
      <line x1="4" y1="2" x2="8" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="8" x2="8" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="20" x2="8" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="23" x2="8" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="26" x2="8" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      {/* Stage 1 - 8 to 4 */}
      <line x1="8" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="2" x2="12" y2="3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="3.5" x2="14" y2="3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="5" x2="12" y2="3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="8" x2="12" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="9.5" x2="14" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="11" x2="12" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="18.5" x2="14" y2="18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="20" x2="12" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="20" x2="12" y2="18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="23" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="23" x2="12" y2="24.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="24.5" x2="14" y2="24.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="8" y1="26" x2="12" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="26" x2="12" y2="24.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      {/* Stage 2 - 4 to 2 */}
      <line x1="14" y1="3.5" x2="18" y2="3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="3.5" x2="18" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="6.5" x2="20" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="14" y1="9.5" x2="18" y2="9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="9.5" x2="18" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="14" y1="18.5" x2="18" y2="18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="18.5" x2="18" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="21.5" x2="20" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="14" y1="24.5" x2="18" y2="24.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="24.5" x2="18" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      {/* Stage 3 - 2 to 1 (winner) */}
      <line x1="20" y1="6.5" x2="24" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="6.5" x2="24" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      <line x1="20" y1="21.5" x2="24" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="21.5" x2="24" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
