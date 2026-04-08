const shimmer = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
} as const

export default function ScoresLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ ...shimmer, width: '160px', height: '32px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...shimmer, width: '130px', height: '40px' }} />
          <div style={{ ...shimmer, width: '110px', height: '40px' }} />
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ ...shimmer, width: '90px', height: '14px', marginBottom: '10px' }} />
            <div style={{ ...shimmer, width: '80px', height: '28px' }} />
          </div>
        ))}
      </div>

      {/* Search / filter bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ ...shimmer, flex: 1, height: '40px' }} />
        <div style={{ ...shimmer, width: '140px', height: '40px' }} />
      </div>

      {/* Scores table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
          {[160, 70, 70, 70, 70, 90].map((w, i) => (
            <div key={i} style={{ ...shimmer, width: `${w}px`, height: '16px' }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '12px 20px', borderBottom: '1px solid #f9fafb' }}>
            <div style={{ ...shimmer, width: '140px', height: '16px' }} />
            <div style={{ ...shimmer, width: '55px', height: '32px', borderRadius: '6px' }} />
            <div style={{ ...shimmer, width: '55px', height: '32px', borderRadius: '6px' }} />
            <div style={{ ...shimmer, width: '55px', height: '32px', borderRadius: '6px' }} />
            <div style={{ ...shimmer, width: '60px', height: '16px' }} />
            <div style={{ ...shimmer, width: '70px', height: '16px' }} />
          </div>
        ))}
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
