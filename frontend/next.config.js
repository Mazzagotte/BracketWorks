

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

  // resolve.symlinks=false: exFAT/USB drives return EISDIR for readlink().
  // On Ubuntu CI (ext4), this is a safe no-op that prevents unnecessary readlink calls.
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },

};

module.exports = nextConfig;
