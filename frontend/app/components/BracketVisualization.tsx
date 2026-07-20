export default function BracketVisualization() {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-full h-full"
      aria-hidden="true"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left side brackets */}
      <path d="M6 8C6 8 4 8 4 10V18C4 20 6 20 6 20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Right side brackets */}
      <path d="M22 8C22 8 24 8 24 10V18C24 20 22 20 22 20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Top-left entry */}
      <rect x="8" y="6" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.7" />
      
      {/* Top-middle entry */}
      <rect x="12" y="5" width="4" height="3" rx="0.5" fill="currentColor" />
      
      {/* Top-right entry */}
      <rect x="16" y="6" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.7" />
      
      {/* Winner circle in center */}
      <circle cx="14" cy="14" r="3.5" fill="currentColor" opacity="0.9" />
      
      {/* Bottom-left entry */}
      <rect x="8" y="19" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.7" />
      
      {/* Bottom-middle entry */}
      <rect x="12" y="20" width="4" height="3" rx="0.5" fill="currentColor" />
      
      {/* Bottom-right entry */}
      <rect x="16" y="19" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
