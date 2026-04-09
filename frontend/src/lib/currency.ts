/**
 * Static PHP → USD display helper for the UI. No live FX API.
 * All conversion for display lives here.
 */
export const PHP_TO_USD_RATE = 0.017;

export function convertPhpToUsd(php: number | null | undefined): number | null {
  if (php == null || Number.isNaN(Number(php))) return null;
  return Number(php) * PHP_TO_USD_RATE;
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return usdFormatter.format(Number(amount));
}

/**
 * Compact chart label from a PHP amount, e.g. "$1.2K" (USD thousands).
 */
export function formatUsdThousandsFromPhp(
  php: number | null | undefined,
  fractionDigits: 0 | 1 = 1,
): string {
  const usd = convertPhpToUsd(php);
  if (usd == null) return '—';
  const k = usd / 1000;
  return `$${k.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits })}K`;
}

/**
 * Display-only: PHP amounts convert to USD; other codes are formatted as USD (same numeric value).
 */
export function formatAmountMaybePhpAndUsd(
  amount: number | null | undefined,
  currencyCode?: string | null,
): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const code = (currencyCode ?? 'PHP').toUpperCase();
  if (code === 'PHP') {
    const usd = convertPhpToUsd(amount);
    return usd == null ? '—' : formatUsd(usd);
  }
  return usdFormatter.format(Number(amount));
}
