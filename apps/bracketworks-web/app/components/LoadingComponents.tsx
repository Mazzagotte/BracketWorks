interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
  'aria-hidden'?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  color = 'primary',
  className = '',
  'aria-hidden': ariaHidden = false
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  const colorClasses = {
    primary: 'text-blue-500',
    secondary: 'text-gray-500',
    white: 'text-white'
  };

  return (
    <div 
      className={`inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-hidden={ariaHidden}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  children,
  loadingText = 'Loading...',
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={`relative ${className} ${loading ? 'cursor-not-allowed opacity-75' : ''}`}
      aria-busy={loading}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" color="white" aria-hidden />
          <span className="ml-2 sr-only">{loadingText}</span>
        </span>
      )}
      <span className={loading ? 'opacity-0' : ''}>
        {children}
      </span>
    </button>
  );
};

interface SkeletonProps {
  className?: string;
  height?: string | number;
  width?: string | number;
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  height = '1rem',
  width = '100%',
  rounded = false
}) => {
  const normalizedHeight = typeof height === 'number' ? `${height}px` : height;
  const normalizedWidth = typeof width === 'number' ? `${width}px` : width;

  return (
    <svg
      className={`animate-pulse ${className}`}
      width={normalizedWidth}
      height={normalizedHeight}
      aria-hidden="true"
      role="presentation"
      focusable="false"
    >
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={rounded ? '9999' : '4'}
        ry={rounded ? '9999' : '4'}
        fill="var(--color-gray-200)"
      />
    </svg>
  );
};

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
  children?: React.ReactNode;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  showSpinner = true,
  children
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-gray-500">
      {showSpinner && <Spinner size="lg" className="mb-4" />}
      <p className="text-lg font-medium">{message}</p>
      {children}
    </div>
  );
};

// Tournament card skeleton
export const TournamentCardSkeleton: React.FC = () => {
  return (
    <div className="tournament-card p-6 bg-white rounded-lg shadow-sm border">
      <div className="flex justify-between items-start mb-4">
        <Skeleton width="60%" height="1.5rem" />
        <Skeleton width="4rem" height="2rem" rounded />
      </div>
      <Skeleton width="40%" height="1rem" className="mb-2" />
      <Skeleton width="50%" height="1rem" className="mb-4" />
      <div className="flex gap-2">
        <Skeleton width="6rem" height="2.5rem" />
        <Skeleton width="6rem" height="2.5rem" />
      </div>
    </div>
  );
};

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  loading?: boolean;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  loading = false 
}) => {
  return (
    <div className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
      {children}
    </div>
  );
};

// Dashboard page skeleton
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton width="200px" height="2rem" />
        <Skeleton width="120px" height="2.5rem" />
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 bg-white rounded-lg border">
            <Skeleton width="50%" height="1rem" className="mb-2" />
            <Skeleton width="80px" height="2rem" />
          </div>
        ))}
      </div>
      
      {/* Content area */}
      <div className="bg-white rounded-lg border p-6">
        <Skeleton width="150px" height="1.5rem" className="mb-4" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="mb-3">
            <Skeleton width="100%" height="3rem" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Bracket page skeleton
export const BracketSkeleton: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Skeleton width="200px" height="2rem" className="mb-4" />
        <div className="flex gap-2">
          <Skeleton width="100px" height="2.5rem" />
          <Skeleton width="100px" height="2.5rem" />
          <Skeleton width="100px" height="2.5rem" />
        </div>
      </div>
      
      <div className="bg-white rounded-lg border p-6">
        <div className="grid grid-cols-2 gap-8">
          {[1, 2].map(col => (
            <div key={col} className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} width="100%" height="4rem" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Scores page skeleton
export const ScoresSkeleton: React.FC = () => {
  return (
    <div className="p-6">
      <Skeleton width="150px" height="2rem" className="mb-6" />
      
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Table header */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="flex gap-4">
            <Skeleton width="150px" height="1.5rem" />
            <Skeleton width="100px" height="1.5rem" />
            <Skeleton width="100px" height="1.5rem" />
            <Skeleton width="100px" height="1.5rem" />
          </div>
        </div>
        
        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="p-4 border-b">
            <div className="flex gap-4">
              <Skeleton width="150px" height="1rem" />
              <Skeleton width="100px" height="1rem" />
              <Skeleton width="100px" height="1rem" />
              <Skeleton width="100px" height="1rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Payouts page skeleton
export const PayoutsSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton width="180px" height="2rem" />
        <Skeleton width="150px" height="2.5rem" />
      </div>
      
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 bg-white rounded-lg border text-center">
            <Skeleton width="80px" height="2rem" className="mx-auto mb-2" />
            <Skeleton width="100px" height="1rem" className="mx-auto" />
          </div>
        ))}
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="p-4 border-b flex justify-between items-center">
            <Skeleton width="200px" height="1.5rem" />
            <Skeleton width="100px" height="2rem" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Players page skeleton
export const PlayersSkeleton: React.FC = () => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton width="150px" height="2rem" />
        <Skeleton width="120px" height="2.5rem" />
      </div>
      
      <div className="bg-white rounded-lg border p-4">
        <div className="mb-4 flex gap-4">
          <Skeleton width="200px" height="2.5rem" />
          <Skeleton width="150px" height="2.5rem" />
        </div>
        
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="p-3 border-b flex justify-between items-center">
            <div className="flex-1">
              <Skeleton width="180px" height="1.2rem" className="mb-1" />
              <Skeleton width="120px" height="0.9rem" />
            </div>
            <Skeleton width="80px" height="2rem" />
          </div>
        ))}
      </div>
    </div>
  );
};
