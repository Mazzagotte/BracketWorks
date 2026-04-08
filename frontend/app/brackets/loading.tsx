const shimmer = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
} as const

export default function BracketsLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ ...shimmer, width: '180px', height: '32px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...shimmer, width: '160px', height: '40px' }} />
          <div style={{ ...shimmer, width: '140px', height: '40px' }} />
          <div style={{ ...shimmer, width: '120px', height: '40px' }} />
        </div>
      </div>

      {/* Selector row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{ ...shimmer, width: '200px', height: '40px' }} />
        <div style={{ ...shimmer, width: '180px', height: '40px' }} />
        <div style={{ ...shimmer, flex: 1, height: '40px' }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[80, 90, 60].map((w, i) => (
          <div key={i} style={{ ...shimmer, width: `${w}px`, height: '36px', borderRadius: '20px' }} />
        ))}
      </div>

      {/* Bracket tree area */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        {/* Simulated bracket rounds */}
        <div style={{ display: 'flex', gap: '40px', alignItems: 'center', minWidth: '600px' }}>
          {/* Round 1 — 8 matches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ ...shimmer, width: '140px', height: '44px', borderRadius: '10px' }} />
            ))}
          </div>
          {/* Round 2 — 4 matches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '52px', marginTop: '28px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...shimmer, width: '140px', height: '44px', borderRadius: '10px' }} />
            ))}
          </div>
          {/* Round 3 — 2 matches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '140px', marginTop: '84px' }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ ...shimmer, width: '140px', height: '44px', borderRadius: '10px' }} />
            ))}
          </div>
          {/* Final */}
          <div style={{ marginTop: '196px' }}>
            <div style={{ ...shimmer, width: '140px', height: '44px', borderRadius: '10px', background: 'linear-gradient(90deg, #fde8d8 25%, #fbd0b8 50%, #fde8d8 75%)', backgroundSize: '200% 100%' }} />
          </div>
        </div>
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
