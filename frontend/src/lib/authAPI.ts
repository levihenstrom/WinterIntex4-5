import type { AuthSession } from '../types/AuthSession';

function normalizeAuthSession(raw: Partial<AuthSession> | null | undefined): AuthSession {
  if (!raw) {
    return { isAuthenticated: false, userName: null, email: null, roles: [] };
  }
  return {
    isAuthenticated: Boolean(raw.isAuthenticated),
    userName: raw.userName ?? null,
    email: raw.email ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles : [],
  };
}
import type { TwoFactorStatus } from '../types/TwoFactorStatus';
import { API_BASE_URL as apiBaseUrl } from './apiBaseUrl';

export interface ExternalAuthProvider {
  name: string;
  displayName: string;
}

export interface PasswordLoginResult {
  requiresTwoFactor: boolean;
  isAuthenticated: boolean;
  userName: string | null;
  email: string | null;
  roles: string[];
  refreshToken?: string;
}

async function readApiError(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  const isJsonLike =
    contentType.includes('application/json') ||
    contentType.includes('application/problem+json');

  if (!isJsonLike) {
    return fallbackMessage;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return fallbackMessage;
  }

  if (!data || typeof data !== 'object') {
    return fallbackMessage;
  }

  const payload = data as {
    detail?: unknown;
    title?: unknown;
    message?: unknown;
    errors?: Record<string, unknown>;
  };

  if (payload.errors && typeof payload.errors === 'object') {
    const firstError = Object.values(payload.errors)
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    if (firstError) {
      return firstError;
    }
  }

  if (typeof payload.detail === 'string' && payload.detail.length > 0) {
    return payload.detail;
  }

  if (typeof payload.title === 'string' && payload.title.length > 0) {
    return payload.title;
  }

  if (typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message;
  }

  return fallbackMessage;
}

async function postTwoFactorRequest(
  payload: object
): Promise<TwoFactorStatus> {
  const response = await fetch(`${apiBaseUrl}/api/auth/manage/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Unable to update MFA settings.')
    );
  }

  return response.json();
}

export function buildExternalLoginUrl(
  provider: string,
  returnPath = '/'
): string {
  const searchParams = new URLSearchParams({ provider, returnPath });
  return `${apiBaseUrl}/api/auth/external-login?${searchParams}`;
}

export async function getExternalProviders(): Promise<
  ExternalAuthProvider[]
> {
  const response = await fetch(`${apiBaseUrl}/api/auth/providers`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Unable to load external login providers.')
    );
  }

  return response.json();
}

const REFRESH_TOKEN_KEY = 'intex-refresh-token';
const SESSION_KEY = 'intex-session';

export function getStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return normalizeAuthSession(JSON.parse(raw) as Partial<AuthSession>);
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession, refreshToken?: string): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function getAuthSession(): Promise<AuthSession> {
  // First try cookie-based session (works on desktop / same-origin)
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    credentials: 'include',
  });

  if (response.ok) {
    const session = normalizeAuthSession((await response.json()) as Partial<AuthSession>);
    if (session.isAuthenticated) {
      return session;
    }
  }

  // Cookie didn't work (mobile Safari) — try refresh token from localStorage
  const refreshToken = getStoredRefreshToken();
  if (refreshToken) {
    const refreshResponse = await fetch(`${apiBaseUrl}/api/auth/refresh-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshResponse.ok) {
      return normalizeAuthSession((await refreshResponse.json()) as Partial<AuthSession>);
    }

    // Refresh token expired/invalid — clear stored session
    clearStoredSession();
  }

  // Check localStorage as last resort (may have been stored during OAuth flow)
  const stored = getStoredSession();
  if (stored?.isAuthenticated) {
    return normalizeAuthSession(stored);
  }

  return {
    isAuthenticated: false,
    userName: null,
    email: null,
    roles: [],
  };
}

export async function exchangeAuthToken(token: string): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/api/auth/exchange-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error('Unable to complete sign-in.');
  }

  const data = await response.json();
  const session = normalizeAuthSession(data as Partial<AuthSession>);

  storeSession(session, data.refreshToken);
  return session;
}

export async function registerUser(
  email: string,
  password: string
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/self-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, 'Unable to register the account.')
    );
  }
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean
): Promise<PasswordLoginResult> {
  const response = await fetch(`${apiBaseUrl}/api/auth/password-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, rememberMe }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to log in.'));
  }

  return response.json();
}

export async function completeTwoFactorLogin(
  rememberMe: boolean,
  twoFactorCode?: string,
  recoveryCode?: string
): Promise<PasswordLoginResult> {
  const response = await fetch(`${apiBaseUrl}/api/auth/password-login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      twoFactorCode: twoFactorCode || null,
      recoveryCode: recoveryCode || null,
      rememberMe,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        'Unable to verify the authenticator or recovery code.'
      )
    );
  }

  return response.json();
}

export async function loginUserLegacy(
  email: string,
  password: string,
  rememberMe: boolean,
  twoFactorCode?: string,
  twoFactorRecoveryCode?: string
): Promise<void> {
  const searchParams = new URLSearchParams();

  if (rememberMe) {
    searchParams.set('useCookies', 'true');
  } else {
    searchParams.set('useSessionCookies', 'true');
  }

  const body: Record<string, string> = { email, password };

  if (twoFactorCode) {
    body.twoFactorCode = twoFactorCode;
  }

  if (twoFactorRecoveryCode) {
    body.twoFactorRecoveryCode = twoFactorRecoveryCode;
  }

  const response = await fetch(
    `${apiBaseUrl}/api/auth/login?${searchParams}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        'Unable to log in. If MFA is enabled, include an authenticator code or recovery code.'
      )
    );
  }
}

export async function logoutUser(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  clearStoredSession();

  const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Unable to log out.'));
  }
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({});
}

export async function enableTwoFactor(
  twoFactorCode: string
): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({
    enable: true,
    twoFactorCode,
    resetRecoveryCodes: true,
  });
}

export async function disableTwoFactor(): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({ enable: false });
}

export async function resetRecoveryCodes(): Promise<TwoFactorStatus> {
  return postTwoFactorRequest({ resetRecoveryCodes: true });
}
