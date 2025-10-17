

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Remove rewrites since we're using NEXT_PUBLIC_BACKEND_URL directly in api.ts
};

module.exports = nextConfig;
