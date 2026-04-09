import { formatAmountMaybePhpAndUsd } from './currency';

export type DonationDisplayFields = {
  donationType?: string | null;
  amount?: number | null;
  currencyCode?: string | null;
  estimatedValue?: number | null;
  impactUnit?: string | null;
};

function isMonetaryType(type: string | null | undefined): boolean {
  return (type ?? '').trim() === 'Monetary';
}

/** Currency column: only monetary gifts show cash; others show em dash. */
export function formatDonationCashAmountCell(d: DonationDisplayFields): string {
  if (!isMonetaryType(d.donationType)) return '—';
  if (d.amount == null) return '—';
  return formatAmountMaybePhpAndUsd(Number(d.amount), d.currencyCode ?? 'PHP');
}

/** Quantity column: hours, items, campaigns, etc. from estimated value + impact unit; monetary rows show em dash. */
export function formatDonationQuantityCell(d: DonationDisplayFields): string {
  if (isMonetaryType(d.donationType)) return '—';
  const v = d.estimatedValue;
  if (v == null) return '—';
  const n = Number(v);
  const numStr = Number.isInteger(n)
    ? String(n)
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const u = (d.impactUnit ?? '').trim();
  if (!u) return numStr;
  return `${numStr} ${u}`;
}

/** Single-line summary for compact lists (e.g. admin widgets). */
export function formatDonationValueOneLiner(d: DonationDisplayFields): string {
  const cash = formatDonationCashAmountCell(d);
  const qty = formatDonationQuantityCell(d);
  if (cash !== '—') return cash;
  if (qty !== '—') return qty;
  return '—';
}
