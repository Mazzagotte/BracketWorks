const shimmer = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
} as const

export default function PlayersLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ ...shimmer, width: '180px', height: '32px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...shimmer, width: '140px', height: '40px' }} />
          <div style={{ ...shimmer, width: '120px', height: '40px' }} />
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{ ...shimmer, width: '200px', height: '40px' }} />
        <div style={{ ...shimmer, width: '160px', height: '40px' }} />
        <div style={{ ...shimmer, flex: 1, height: '40px' }} />
      </div>

      {/* Card with table */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
          {['200px', '80px', '80px', '80px', '100px'].map((w, i) => (
            <div key={i} style={{ ...shimmer, width: w, height: '16px' }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', padding: '14px 20px', borderBottom: '1px solid #f9fafb' }}>
            <div style={{ ...shimmer, width: '160px', height: '16px' }} />
            <div style={{ ...shimmer, width: '60px', height: '16px' }} />
            <div style={{ ...shimmer, width: '50px', height: '16px' }} />
            <div style={{ ...shimmer, width: '70px', height: '16px' }} />
            <div style={{ ...shimmer, width: '80px', height: '28px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
