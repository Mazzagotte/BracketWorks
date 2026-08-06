export const createApiClient = () => ({
  baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? '',
});
