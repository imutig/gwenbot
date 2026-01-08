interface SkeletonProps {
    className?: string
    width?: string
    height?: string
    borderRadius?: string
}

export function Skeleton({
    className = '',
    width = '100%',
    height = '1rem',
    borderRadius = '8px'
}: SkeletonProps) {
    return (
        <div
            className={className}
            style={{
                width,
                height,
                borderRadius,
                background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-input) 50%, var(--bg-card) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
            }}
        />
    )
}

export function SkeletonCard() {
    return (
        <>
            <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
            <div
                className="glass-card"
                style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}
            >
                <Skeleton width="40%" height="1.25rem" />
                <Skeleton width="100%" height="0.9rem" />
                <Skeleton width="80%" height="0.9rem" />
                <Skeleton width="60%" height="0.9rem" />
            </div>
        </>
    )
}

export function SkeletonRow() {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-card)',
                borderRadius: '8px',
            }}
        >
            <Skeleton width="24px" height="24px" borderRadius="50%" />
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="20%" height="1rem" />
        </div>
    )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
    return (
        <>
            <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Array.from({ length: count }).map((_, i) => (
                    <SkeletonRow key={i} />
                ))}
            </div>
        </>
    )
}
