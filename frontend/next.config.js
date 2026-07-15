

/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const nextConfig = {
  output: 'standalone',

  // Disable image optimization to avoid requiring 'sharp' dependency
  images: {
    unoptimized: true
  },

  experimental: {
    optimizePackageImports: ['@heroicons/react', 'date-fns', 'lodash'],
  },

  async rewrites() {
    return [
      {
        source: '/api/v1/tournaments',
        destination: `${backendUrl}/api/v1/tournaments/`,
      },
      {
        source: '/api/v1/squads',
        destination: `${backendUrl}/api/v1/squads/`,
      },
      {
        source: '/api/v1/scores',
        destination: `${backendUrl}/api/v1/scores/`,
      },
      {
        source: '/api/v1/bracket-settings',
        destination: `${backendUrl}/api/v1/bracket-settings/`,
      },
      {
        source: '/api/v1/bracket-settings/:path*',
        destination: `${backendUrl}/api/v1/bracket-settings/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

};

module.exports = nextConfig;
