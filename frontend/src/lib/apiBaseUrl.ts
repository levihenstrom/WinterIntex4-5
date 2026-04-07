import { API_URL } from '../api/IntextAPI';

/**
 * Resolves where the browser should send `/api/*` requests.
 *
 * - **Local (`npm run dev`)**: always `''` (same origin as Vite). The dev server proxies
 *   `/api` to `https://localhost:5001` (see `vite.config.ts`). `VITE_API_BASE_URL` is
 *   ignored so a stray `.env.local` cannot point dev at Azure.
 * - **Production build**: `VITE_API_BASE_URL` from the deploy environment / `.env.production`,
 *   otherwise the baked-in `API_URL` (Azure).
 */
export const API_BASE_URL: string = (() => {
  if (import.meta.env.DEV) {
    return '';
  }
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim().replace(/\/$/, '');
  }
  return API_URL.replace(/\/$/, '');
})();
