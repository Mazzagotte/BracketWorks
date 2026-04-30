const shimmer = {
  background: 'linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-200) 50%, var(--color-gray-100) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
} as const

export default function PayoutsLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ ...shimmer, width: '160px', height: '32px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...shimmer, width: '160px', height: '40px' }} />
          <div style={{ ...shimmer, width: '140px', height: '40px' }} />
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '20px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}>
            <div style={{ ...shimmer, width: '80px', height: '14px', marginBottom: '10px' }} />
            <div style={{ ...shimmer, width: '100px', height: '28px' }} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {[100, 80].map((w, i) => (
          <div key={i} style={{ ...shimmer, width: `${w}px`, height: '36px', borderRadius: '8px 8px 0 0' }} />
        ))}
      </div>

      {/* Content card */}
      <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-soft)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-gray-100)', background: 'var(--color-gray-50)', display: 'flex', gap: '12px' }}>
          <div style={{ ...shimmer, width: '220px', height: '36px' }} />
          <div style={{ ...shimmer, flex: 1, height: '36px' }} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '14px 20px', borderBottom: '1px solid var(--color-gray-50)' }}>
            <div style={{ ...shimmer, width: '150px', height: '16px' }} />
            <div style={{ ...shimmer, width: '60px', height: '16px' }} />
            <div style={{ ...shimmer, width: '70px', height: '16px' }} />
            <div style={{ ...shimmer, width: '80px', height: '24px', borderRadius: '12px' }} />
          </div>
        ))}
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
