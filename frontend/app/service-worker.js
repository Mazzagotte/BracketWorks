
// Minimal stub. Consider workbox for real offline caching.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
