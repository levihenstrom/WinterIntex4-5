import { API_BASE_URL as apiBaseUrl } from './apiBaseUrl';
import { getStoredRefreshToken } from './authAPI';

export interface PagedResult<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: T[];
}

function toFriendlyFieldName(field: string): string {
  const lastSegment = field.split('.').at(-1) ?? field;
  return lastSegment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

    if (parsed.errors) {
      const entries = Object.entries(parsed.errors).filter(([, messages]) => messages.length > 0);
      if (entries.length > 0) {
        return entries
          .map(([field, messages]) => `${toFriendlyFieldName(field)}: ${messages[0]}`)
          .join(' | ');
      }
    }
    if (parsed.message) return parsed.message;
    if (parsed.detail) return parsed.detail;
    if (parsed.title) return parsed.title;
  } catch {
    return text;
  }

  return text;
}

function createAuthHeaders(): HeadersInit | undefined {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return undefined;

  return {
    Authorization: `Bearer ${refreshToken}`,
  };
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
  const response = await fetch(url, {
    credentials: 'include',
    headers: createAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

/** Loads every page of a paged list (for admin UIs that need full in-memory filtering). */
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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: createAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.json();
}

export async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: createAuthHeaders(),
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
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(),
    },
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
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}
