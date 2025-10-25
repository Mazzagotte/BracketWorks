

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
    forceSwcTransforms: true,
    // Enable modern bundling optimizations
    optimizePackageImports: ['@heroicons/react'],
  },
  
  // Production and development optimizations
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Faster development builds
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
        },
      };
      
      // Reduce bundle analysis in development
      config.optimization.providedExports = false;
      config.optimization.usedExports = false;
    }
    return config;
  },
  
  compiler: {
    // Remove console logs in production for smaller bundles
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;
