/**
 * Compatibility shim - all public exports now live in ./api/ modules.
 * Importing from '../lib/api' continues to work unchanged.
 */
export {
  getMemoryAccessToken,
  setMemoryAccessToken,
  clearAuthStorage,
  getCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  ApiClient,
  apiClient,
  apiFetch,
  buildApiUrl,
  API,
} from './api/index'
