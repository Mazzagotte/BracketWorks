const shimmer = {
  background: 'linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-200) 50%, var(--color-gray-100) 75%)',
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
      <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '32px', boxShadow: 'var(--shadow-soft)', overflowX: 'auto' }}>
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
            <div style={{ ...shimmer, width: '140px', height: '44px', borderRadius: '10px', background: 'linear-gradient(90deg, var(--color-brand-ivory-light) 25%, var(--color-brand-ivory) 50%, var(--color-brand-ivory-light) 75%)', backgroundSize: '200% 100%' }} />
          </div>
        </div>
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
