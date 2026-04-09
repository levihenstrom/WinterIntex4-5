import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * GDPR-oriented consent: distinguish strictly necessary vs optional storage.
 * - `necessary`: remember choice in a browser-readable cookie; auth/session storage still used where required.
 * - `all`: same + optional `intex-optional-*` localStorage keys are allowed; choosing necessary clears those keys.
 */
const CONSENT_COOKIE_NAME = 'cookie_consent';
const LEGACY_STORAGE_KEY = 'intex-cookie-consent';

function safeLocalStorageRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore blocked-storage errors in hardened/private browsers.
  }
}

function safeLocalStorageSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeLocalStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

export type CookieConsentChoice = 'necessary' | 'all';

const OPTIONAL_KEY_PREFIX = 'intex-optional-';

interface CookieConsentContextValue {
  /** User has chosen a tier (banner hidden). */
  hasResponded: boolean;
  choice: CookieConsentChoice | null;
  /** True when user accepted optional cookies (UI prefs, etc.). */
  allowOptionalStorage: boolean;
  acceptNecessaryOnly: () => void;
  acceptAll: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(
  undefined,
);

function readInitialChoice(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';').map((part) => part.trim());
  const consentCookie = cookies.find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  const cookieValue = consentCookie?.slice(`${CONSENT_COOKIE_NAME}=`.length);

  if (cookieValue === 'accepted') return 'all';
  if (cookieValue === 'declined') return 'necessary';

  // Clear any previous localStorage-backed consent so state comes from cookies only.
  safeLocalStorageRemoveItem(LEGACY_STORAGE_KEY);
  return null;
}

function writeConsentCookie(value: 'accepted' | 'declined'): void {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function clearOptionalLocalStorage(): void {
  const keys = safeLocalStorageKeys().filter((k) => k.startsWith(OPTIONAL_KEY_PREFIX));
  for (const k of keys) safeLocalStorageRemoveItem(k);
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<CookieConsentChoice | null>(readInitialChoice);

  const persist = useCallback((next: CookieConsentChoice) => {
    writeConsentCookie(next === 'all' ? 'accepted' : 'declined');
    safeLocalStorageRemoveItem(LEGACY_STORAGE_KEY);
    setChoice(next);
    if (next === 'necessary') {
      clearOptionalLocalStorage();
    }
  }, []);

  const acceptNecessaryOnly = useCallback(() => persist('necessary'), [persist]);
  const acceptAll = useCallback(() => persist('all'), [persist]);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      hasResponded: choice !== null,
      choice,
      allowOptionalStorage: choice === 'all',
      acceptNecessaryOnly,
      acceptAll,
    }),
    [choice, acceptNecessaryOnly, acceptAll],
  );

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider.');
  }
  return context;
}

/** Store UI prefs only when user accepted optional cookies (call from components). */
export function setOptionalLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  if (readInitialChoice() !== 'all') return false;
  return safeLocalStorageSetItem(`${OPTIONAL_KEY_PREFIX}${key}`, value);
}

export function getOptionalLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  if (readInitialChoice() !== 'all') return null;
  return safeLocalStorageGetItem(`${OPTIONAL_KEY_PREFIX}${key}`);
}
