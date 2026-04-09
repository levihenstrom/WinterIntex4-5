import type { CSSProperties } from 'react';

/**
 * Matches {@link PublicImpactController} / live-stats OKR: only "Completed"
 * reintegration counts as a successful reintegration (not merely case closed).
 */
export function isOkrSuccessfulReintegration(reintegrationStatus: string | null | undefined): boolean {
  return (reintegrationStatus ?? '').trim() === 'Completed';
}

/** Subtle gold row treatment on caseload table (successful reintegration / OKR outcome). */
export function residentCaseloadRowStyle(isOkr: boolean, stripeEven: boolean): CSSProperties {
  const base: CSSProperties = {
    borderBottom: '1px solid #F1F5F9',
    cursor: 'pointer',
  };
  if (!isOkr) {
    return { ...base, background: stripeEven ? '#fff' : '#FAFAFA' };
  }
  return {
    ...base,
    background: stripeEven ? 'rgba(255, 252, 245, 0.98)' : 'rgba(255, 247, 230, 0.72)',
    boxShadow: 'inset 4px 0 0 0 rgba(217, 119, 6, 0.22)',
  };
}

export const OKR_REINTEGRATION_CHIP: CSSProperties = {
  background: 'rgba(254, 243, 199, 0.95)',
  color: '#92400e',
  border: '1px solid rgba(245, 158, 11, 0.35)',
  borderRadius: 20,
  padding: '3px 10px',
  fontSize: 11,
  fontWeight: 700,
};

export const OKR_PROFILE_HEADER_BAND: CSSProperties = {
  background: 'linear-gradient(90deg, rgba(254, 243, 199, 0.45) 0%, rgba(255, 252, 245, 0.35) 55%, transparent 100%)',
  borderLeft: '4px solid rgba(217, 119, 6, 0.28)',
  borderRadius: 12,
  padding: '14px 18px',
};
