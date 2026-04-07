import { API_URL } from '../api/IntextAPI';

/** Shared base URL resolution — mirrors authAPI.ts. */
const apiBaseUrl: string = (() => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return '';
  }
  return API_URL.replace(/\/$/, '');
})();

export interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: T[];
}

/** Fetches a paged resource. Throws on non-2xx with the API error detail. */
export async function fetchPaged<T>(
  path: string,
  page: number,
  pageSize = 20,
  extraQuery: Record<string, string | number | undefined> = {}
): Promise<PagedResult<T>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [k, v] of Object.entries(extraQuery)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const url = `${apiBaseUrl}${path}?${params}`;
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`);
  }
  return response.json();
}

/** Fetches a single JSON resource (no pagination). */
export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`);
  }
  return response.json();
}
