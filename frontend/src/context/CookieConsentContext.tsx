import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * GDPR-oriented consent: distinguish strictly necessary vs optional storage.
 * - `necessary`: remember choice; auth/session storage still used where required for the product.
 * - `all`: same + optional `intex-optional-*` localStorage keys are allowed; choosing necessary clears those keys.
 */
const STORAGE_KEY = 'intex-cookie-consent';

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
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'necessary' || v === 'all') return v;
  if (v === 'acknowledged') {
    window.localStorage.setItem(STORAGE_KEY, 'necessary');
    return 'necessary';
  }
  return null;
}

function clearOptionalLocalStorage(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(OPTIONAL_KEY_PREFIX)) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<CookieConsentChoice | null>(readInitialChoice);

  const persist = useCallback((next: CookieConsentChoice) => {
    window.localStorage.setItem(STORAGE_KEY, next);
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
  const tier = window.localStorage.getItem(STORAGE_KEY);
  if (tier !== 'all') return false;
  window.localStorage.setItem(`${OPTIONAL_KEY_PREFIX}${key}`, value);
  return true;
}

export function getOptionalLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  if (window.localStorage.getItem(STORAGE_KEY) !== 'all') return null;
  return window.localStorage.getItem(`${OPTIONAL_KEY_PREFIX}${key}`);
}
