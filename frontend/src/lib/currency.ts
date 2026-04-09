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

/** Whole peso amounts for tables and chart axes (keeps ticks readable). */
const phpWholeFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function formatPesoCompact(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return phpWholeFormatter.format(Number(amount));
}

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
 * Display: PHP amounts show as pesos with a USD equivalent in parentheses when applicable.
 * Non-PHP codes are formatted as USD using the numeric value as USD.
 */
export function formatAmountMaybePhpAndUsd(
  amount: number | null | undefined,
  currencyCode?: string | null,
): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const code = (currencyCode ?? 'PHP').toUpperCase();
  if (code === 'PHP') {
    const n = Number(amount);
    const phpStr = phpWholeFormatter.format(n);
    const usd = convertPhpToUsd(n);
    return usd != null ? `${phpStr} (${formatUsd(usd)})` : phpStr;
  }
  return usdFormatter.format(Number(amount));
}
