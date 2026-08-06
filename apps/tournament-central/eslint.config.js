const nextConfig = require('eslint-config-next/core-web-vitals');

module.exports = [
  { ignores: ['.next/**', 'node_modules/**'] },
  ...nextConfig,
];
