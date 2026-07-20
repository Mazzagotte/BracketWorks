export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-full h-full"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left vertical line */}
      <line x1="4" y1="6" x2="4" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Left top horizontal */}
      <line x1="4" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Left bottom horizontal */}
      <line x1="4" y1="22" x2="8" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Middle vertical line */}
      <line x1="14" y1="10" x2="14" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Connectors to middle */}
      <line x1="8" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="11" y1="6" x2="11" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="11" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      <line x1="8" y1="22" x2="11" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="11" y1="22" x2="11" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="11" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Right vertical line */}
      <line x1="24" y1="12" x2="24" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Connector from middle to right */}
      <line x1="14" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="10" x2="18" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      <line x1="14" y1="18" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18" y1="18" x2="18" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
