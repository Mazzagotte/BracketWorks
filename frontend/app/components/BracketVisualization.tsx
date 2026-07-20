export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-full h-full"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left side - Entry slots */}
      <line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="11" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="22" x2="8" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Left semi-final matchups - vertical connectors */}
      <line x1="8" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="6" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="8.5" x2="13" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      <line x1="8" y1="11" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="11" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      <line x1="8" y1="17" x2="11" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="17" x2="11" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="19.5" x2="13" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      <line x1="8" y1="22" x2="11" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="22" x2="11" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Finals connector to center */}
      <line x1="13" y1="8.5" x2="16" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="8.5" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      <line x1="13" y1="19.5" x2="16" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="19.5" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Winner slot */}
      <line x1="16" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
