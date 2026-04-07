import type { AuthSession } from '../types/AuthSession';
import type { TwoFactorStatus } from '../types/TwoFactorStatus';
import { API_URL } from '../api/IntextAPI';

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
}

/** Dev: empty → Vite proxy. Prod: VITE_API_BASE_URL, or API_URL so deploys work even if env is missing at build. */
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

async function readApiError(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return fallbackMessage;
  }

  const data = await response.json();

  if (typeof data?.detail === 'string' && data.detail.length > 0) {
    return data.detail;
  }

  if (typeof data?.title === 'string' && data.title.length > 0) {
    return data.title;
  }

  if (data?.errors && typeof data.errors === 'object') {
    const firstError = Object.values(data.errors)
      .flat()
      .find((value): value is string => typeof value === 'string');

    if (firstError) {
      return firstError;
    }
  }

  if (typeof data?.message === 'string' && data.message.length > 0) {
    return data.message;
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
    return JSON.parse(raw) as AuthSession;
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
    const session: AuthSession = await response.json();
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
      return refreshResponse.json();
    }

    // Refresh token expired/invalid — clear stored session
    clearStoredSession();
  }

  // Check localStorage as last resort (may have been stored during OAuth flow)
  const stored = getStoredSession();
  if (stored?.isAuthenticated) {
    return stored;
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
  const session: AuthSession = {
    isAuthenticated: data.isAuthenticated,
    userName: data.userName,
    email: data.email,
    roles: data.roles,
  };

  storeSession(session, data.refreshToken);
  return session;
}

export async function registerUser(
  email: string,
  password: string
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
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
