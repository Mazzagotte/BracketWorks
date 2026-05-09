

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Performance optimizations
  swcMinify: true, // Use faster SWC minifier
  
  // Remove rewrites since we're using NEXT_PUBLIC_BACKEND_URL directly in api.ts
  
  // Disable image optimization to avoid requiring 'sharp' dependency
  images: {
    unoptimized: true
  },
  
  // Enable SWC for faster compilation
  experimental: {
    // Enable modern bundling optimizations
    optimizePackageImports: ['@heroicons/react', 'date-fns', 'lodash'],
  },
  
  // Production and development optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Production client-side optimizations
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // React and framework code
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              name: 'framework',
              priority: 40,
              enforce: true
            },
            // Vendor libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 30,
              minChunks: 2,
              reuseExistingChunk: true
            },
            // Common code used across pages
            common: {
              name: 'common',
              minChunks: 2,
              priority: 20,
              reuseExistingChunk: true
            },
            // Styles
            styles: {
              name: 'styles',
              test: /\.(css|scss)$/,
              chunks: 'all',
              enforce: true,
              priority: 10
            }
          }
        }
      };
    }
    
    return config;
  },
  
};

module.exports = nextConfig;
