

/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const isDevelopment = process.env.NODE_ENV !== 'production';
const frameAncestors = isDevelopment
  ? "'self' http://localhost:3000 http://127.0.0.1:3000"
  : "'self' https://bracketworks.app https://www.bracketworks.app";
let backendOrigin = "'self'";
try {
  backendOrigin = new URL(backendUrl).origin;
} catch {
  // Keep same-origin API access when a relative backend URL is supplied.
}
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${backendOrigin}${isDevelopment ? ' ws: wss:' : ''}`,
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
].join('; ');

const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@bracketworks/ui'],

  // Disable image optimization to avoid requiring 'sharp' dependency
  images: {
    unoptimized: true
  },

  experimental: {
    externalDir: true,
    optimizePackageImports: ['@heroicons/react', 'date-fns', 'lodash'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
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
