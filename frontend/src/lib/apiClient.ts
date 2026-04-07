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

async function readApiError(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status}).`;
  const text = await response.text().catch(() => '');
  if (text.trim() === '') return fallback;

  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };

    if (parsed.message) return parsed.message;
    if (parsed.detail) return parsed.detail;
    if (parsed.errors) {
      const firstFieldErrors = Object.values(parsed.errors).find((messages) => messages.length > 0);
      if (firstFieldErrors?.[0]) return firstFieldErrors[0];
    }
    if (parsed.title) return parsed.title;
  } catch {
    return text;
  }

  return text;
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
    throw new Error(await readApiError(response));
  }
  return response.json();
}

/** Loads every page of a paged list (for admin UIs that need full in-memory lists). */
export async function fetchAllPaged<T>(
  path: string,
  pageSize = 200,
  extraQuery: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const first = await fetchPaged<T>(path, 1, pageSize, extraQuery);
  const items = [...first.items];
  for (let p = 2; p <= first.totalPages; p += 1) {
    const next = await fetchPaged<T>(path, p, pageSize, extraQuery);
    items.push(...next.items);
  }
  return items;
}

/** Fetches a single JSON resource (no pagination). */
export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

export async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

/** POST JSON and return the created entity. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<T>;
}

/** PUT JSON to a resource (expects 204 No Content). */
export async function putJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}
