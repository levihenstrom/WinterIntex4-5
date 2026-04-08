/**
 * User-facing copy for ML-backed admin UI (rank / tier emphasis, no fake scores).
 */

/** Dashboard / lists: priority rank with optional cohort size from API. */
export function formatResidentPriorityRank(rank: number, totalScored?: number | null): string {
  if (totalScored != null && totalScored > 0) {
    return `Priority rank ${rank} of ${totalScored}`;
  }
  return `Priority rank ${rank}`;
}

/**
 * Table cell: raw percentile from API (unchanged numeric), for display next to a clear label.
 */
export function formatRelativeReadinessPercentile(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(Number(pct))) return '—';
  return `${Number(pct).toFixed(1)}%`;
}

/** Short column header for residents table. */
export const RESIDENT_RELATIVE_READINESS_HEADER = 'Relative readiness';

/** Tooltip explaining the percentile column. */
export const RESIDENT_RELATIVE_READINESS_TITLE =
  'Percentile among current residents with a readiness score (lower often means more support needed).';

/** Donor card / widget: band + outreach order; no fabricated churn probability. */
export function formatDonorOutreachSummary(riskBand: string, outreachPriorityRank: number): string {
  return `${riskBand} · outreach rank ${outreachPriorityRank}`;
}
