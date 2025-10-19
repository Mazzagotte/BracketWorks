

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Development performance optimizations
  swcMinify: true, // Use faster SWC minifier
  
  // Remove rewrites since we're using NEXT_PUBLIC_BACKEND_URL directly in api.ts
  
  // Disable image optimization to avoid requiring 'sharp' dependency
  images: {
    unoptimized: true
  },
  
  // Enable SWC for faster compilation
  experimental: {
    forceSwcTransforms: true,
  },
  
  // Development optimizations
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
    // Disable SWC minification in favor of Terser
    removeConsole: false,
  },
};

module.exports = nextConfig;
