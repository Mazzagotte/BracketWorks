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
  return (
    <div
      className={`animate-pulse bg-gray-200 ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
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