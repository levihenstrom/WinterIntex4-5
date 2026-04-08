/**
 * Static PHP → USD display helper for the UI. No live FX API.
 * All conversion for display lives here.
 */
export const PHP_TO_USD_RATE = 0.017;

export const CURRENCY_RATE_NOTE =
  'USD values use a static conversion rate of 1 PHP = 0.017 USD.';

export function convertPhpToUsd(php: number | null | undefined): number | null {
  if (php == null || Number.isNaN(Number(php))) return null;
  return Number(php) * PHP_TO_USD_RATE;
}

export function formatPhp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  return `₱${n.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Main display: ₱5,600 ($95.20) */
export function formatPhpAndUsd(php: number | null | undefined): string {
  if (php == null || Number.isNaN(Number(php))) return '—';
  const usd = convertPhpToUsd(php);
  if (usd == null) return '—';
  return `${formatPhp(php)} (${formatUsd(usd)})`;
}

/**
 * PHP rows: dual currency. Other ISO currencies: Intl only (no USD conversion).
 */
export function formatAmountMaybePhpAndUsd(
  amount: number | null | undefined,
  currencyCode?: string | null,
): string {
  const code = (currencyCode ?? 'PHP').toUpperCase();
  if (code !== 'PHP') {
    if (amount == null || Number.isNaN(Number(amount))) return '—';
    try {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      }).format(Number(amount));
    } catch {
      return `${code} ${Number(amount).toFixed(0)}`;
    }
  }
  return formatPhpAndUsd(amount);
}
