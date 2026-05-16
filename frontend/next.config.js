

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Disable image optimization to avoid requiring 'sharp' dependency
  images: {
    unoptimized: true
  },

  experimental: {
    optimizePackageImports: ['@heroicons/react', 'date-fns', 'lodash'],
  },

};

module.exports = nextConfig;
