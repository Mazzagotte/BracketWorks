export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-full h-full"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left side brackets */}
      <path d="M6 8C6 8 4 8 4 10V18C4 20 6 20 6 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Right side brackets */}
      <path d="M22 8C22 8 24 8 24 10V18C24 20 22 20 22 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Top connector line */}
      <line x1="6" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Bottom connector line */}
      <line x1="6" y1="18" x2="10" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Center vertical line */}
      <line x1="14" y1="9" x2="14" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Top to center */}
      <line x1="10" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Bottom to center */}
      <line x1="10" y1="18" x2="12" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
