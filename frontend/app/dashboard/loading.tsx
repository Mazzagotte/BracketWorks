export default function DashboardLoading() {
  const shimmer = 'linear-gradient(90deg, var(--color-gray-100) 25%, var(--color-gray-200) 50%, var(--color-gray-100) 75%)'
  const warmShimmer = 'linear-gradient(90deg, var(--color-brand-ivory-light) 25%, var(--color-brand-ivory) 50%, var(--color-brand-ivory-light) 75%)'

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ width: '220px', height: '32px', borderRadius: '8px', background: shimmer, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ width: '120px', height: '40px', borderRadius: '8px', background: shimmer, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          <div style={{ width: '120px', height: '40px', borderRadius: '8px', background: shimmer, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        </div>
      </div>

      {/* Two-column cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {[0, 1].map(i => (
          <div key={i} style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}>
            <div style={{ width: '160px', height: '24px', borderRadius: '6px', marginBottom: '20px', background: shimmer, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            {[0, 1, 2, 3].map(j => (
              <div key={j} style={{ width: '100%', height: '44px', borderRadius: '8px', marginBottom: '12px', background: shimmer, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
            ))}
            <div style={{ width: '100%', height: '48px', borderRadius: '12px', marginTop: '8px', background: warmShimmer, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
