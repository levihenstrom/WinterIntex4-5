import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchJson, fetchPaged, postJson, type PagedResult } from '../../lib/apiClient';
import {
  getAtRiskDonors,
  getResidentCurrentScores,
  getResidentPriority,
  recommendSocialPost,
  type DonorChurnRow,
  type ResidentMlScoreRow,
  type SocialRecommendResponse,
} from '../../lib/mlApi';
import {
  formatDonorOutreachSummary,
  formatResidentPriorityRank,
} from '../../lib/mlDisplayHelpers';
import { useAuth } from '../../context/AuthContext';
import { ErrorState, LoadingState } from '../../components/common/AsyncStatus';
import { formatAmountMaybePhpAndUsd } from '../../lib/currency';
import { formatDonationCashAmountCell, formatDonationQuantityCell, formatDonationValueOneLiner } from '../../lib/donationDisplay';
import { SafehouseSearchCombobox } from '../../components/admin/lookupCombos';
import { ALLOCATION_PROGRAM_AREA_PRESETS } from '../../lib/allocationProgramAreas';
import 'bootstrap-icons/font/bootstrap-icons.css';

interface MetricState {
  count: number | null;
  loading: boolean;
  error: boolean;
}

function useCount(endpoint: string, query: Record<string, string> = {}): MetricState {
  const [state, setState] = useState<MetricState>({ count: null, loading: true, error: false });
  useEffect(() => {
    let cancelled = false;
    setState({ count: null, loading: true, error: false });
    fetchPaged<unknown>(endpoint, 1, 1, query)
      .then((r) => {
        if (!cancelled) setState({ count: r.totalCount, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ count: null, loading: false, error: true });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);
  return state;
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  sublabel: string;
  metric: MetricState;
  accentColor: string;
  icon: string;
  linkTo: string;
}

function MetricCard({ label, sublabel, metric, accentColor, icon, linkTo }: MetricCardProps) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <Link to={linkTo} className="text-decoration-none">
        <div
          className="card border-0 shadow-sm rounded-3 h-100"
          style={{ transition: 'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(30,58,95,0.12)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = '';
            (e.currentTarget as HTMLElement).style.boxShadow = '';
          }}
        >
          <div className="card-body d-flex align-items-center gap-3 py-4">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 52,
                height: 52,
                background: `${accentColor}18`,
                fontSize: '1.5rem',
              }}
            >
              {icon.includes('bi-') ? <i className={icon} /> : <i className={`bi bi-${icon}`} />}
            </div>
            <div>
              <p className="hw-eyebrow mb-1" style={{ color: accentColor }}>
                {sublabel}
              </p>
              <div
                className="fw-bold hw-metric-num"
                style={{ fontSize: '1.75rem', color: 'var(--hw-navy)', lineHeight: 1 }}
              >
                {metric.loading ? (
                  <span className="text-muted" style={{ fontSize: '1rem' }}>…</span>
                ) : metric.error ? (
                  <span className="text-danger" style={{ fontSize: '1rem' }}>—</span>
                ) : (
                  metric.count?.toLocaleString() ?? '0'
                )}
              </div>
              <p className="small text-muted mb-0 mt-1">{label}</p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Quick link card ───────────────────────────────────────────────────────────

interface QuickLinkProps {
  to: string;
  icon: string;
  title: string;
  description: string;
}

function QuickLink({ to, icon, title, description }: QuickLinkProps) {
  return (
    <div className="col-12 col-md-6 col-lg-4">
      <Link
        to={to}
        className="text-decoration-none d-flex align-items-start gap-3 p-3 rounded-3 h-100"
        style={{
          background: 'var(--hw-bg-white)',
          border: '1px solid rgba(107,33,168,0.08)',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onMouseEnter={(e: React.MouseEvent) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--hw-purple-soft)';
          (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-lavender)';
        }}
        onMouseLeave={(e: React.MouseEvent) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(107,33,168,0.08)';
          (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-white)';
        }}
      >
        <i className={icon.includes('bi-') ? icon : `bi bi-${icon}`} style={{ fontSize: '1.4rem', lineHeight: 1, marginTop: 2 }} />
        <div>
          <p className="fw-semibold mb-1" style={{ color: 'var(--hw-purple)' }}>{title}</p>
          <p className="small text-muted mb-0">{description}</p>
        </div>
      </Link>
    </div>
  );
}

interface RecentDonationRow {
  donationId: number;
  donationDate?: string | null;
  donationType?: string | null;
  amount?: number | null;
  estimatedValue?: number | null;
  currencyCode?: string | null;
  impactUnit?: string | null;
  campaignName?: string | null;
  supporter?: { displayName?: string | null; organizationName?: string | null } | null;
}
// ── Insights dashboard widgets (isolated fetch/error so one failure does not block others) ──
function ResidentsNeedingAttentionWidget({ onCriticalCount, onOpenProfile }: { onCriticalCount?: (n: number) => void; onOpenProfile?: (residentId: number) => void }) {
  const [rows, setRows] = useState<ResidentMlScoreRow[] | null>(null);
  const [totalScored, setTotalScored] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getResidentPriority(10), getResidentCurrentScores()])
      .then(([priorityRows, allScored]) => {
        if (!cancelled) {
          setRows(priorityRows);
          setTotalScored(allScored.length);
          setErr(null);
          const critical = priorityRows.filter(r => (r.supportPriorityRank ?? 99) <= 3).length;
          onCriticalCount?.(critical);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setErr(e.message || 'Could not load resident priority list.');
          setRows(null);
          setTotalScored(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingState message="Loading ML insights…" size="compact" />;
  if (err) return <ErrorState message={err} />;
  if (!rows?.length) {
    return <p className="text-muted mb-0">No resident priority list returned.</p>;
  }

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
      {rows.slice(0, 8).map((r) => {
        const rank = r.supportPriorityRank ?? 99;
        const severityColor = rank <= 3 ? '#dc2626' : rank <= 6 ? '#d97706' : '#cbd5e1';
        return (
          <li
            key={r.residentCode}
            className="mb-2 pb-2 border-bottom border-light"
            style={{
              borderLeft: `3px solid ${severityColor}`,
              paddingLeft: 8,
              borderRadius: 4,
              background: rank <= 3 ? 'rgba(220,38,38,0.05)' : rank <= 6 ? 'rgba(217,119,6,0.04)' : undefined,
            }}
          >
            <button
              type="button"
              className="text-decoration-none d-block rounded px-2 py-1 w-100 text-start border-0 bg-transparent"
              style={{ transition: 'background 0.15s', cursor: r.residentId != null ? 'pointer' : 'default' }}
              onClick={() => { if (r.residentId != null) onOpenProfile?.(r.residentId); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-lavender)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
              title={[
                formatResidentPriorityRank(r.supportPriorityRank, totalScored),
                r.operationalBand,
                r.topRiskFactors?.[0] ? `Factor: ${r.topRiskFactors[0]}` : '',
              ].filter(Boolean).join(' · ')}
            >
              <div className="d-flex align-items-center justify-content-between gap-2">
                <span className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
                  {r.residentCode}
                  {r.residentId != null && <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: 10, opacity: 0.5 }} />}
                </span>
                <span
                  className="badge rounded-pill flex-shrink-0"
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    background: rank <= 3 ? '#fee2e2' : rank <= 6 ? '#fef3c7' : '#f1f5f9',
                    color: rank <= 3 ? '#991b1b' : rank <= 6 ? '#92400e' : '#64748b',
                  }}
                >
                  Rank {rank}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AtRiskDonorsWidget({
  onCriticalCount,
  onSelectDonor,
}: {
  onCriticalCount?: (n: number) => void;
  onSelectDonor?: (row: DonorChurnRow) => void;
}) {
  const [rows, setRows] = useState<DonorChurnRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAtRiskDonors(10)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setErr(null);
          const critical = r.filter(d => d.riskBand === 'Critical').length;
          onCriticalCount?.(critical);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setErr(e.message || 'Could not load at-risk donors.');
          setRows(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingState message="Loading ML insights…" size="compact" />;
  if (err) return <ErrorState message={err} />;
  if (!rows?.length) {
    return <p className="text-muted mb-0">No at-risk donor list returned.</p>;
  }

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
      {rows.slice(0, 8).map((d) => {
        const isCritical = d.riskBand === 'Critical';
        const isHigh = d.riskBand === 'High';
        const leftColor = isCritical ? '#dc2626' : isHigh ? '#d97706' : '#cbd5e1';
        return (
          <li
            key={d.supporterId}
            className="mb-2 pb-2 border-bottom border-light"
            style={{ borderLeft: `3px solid ${leftColor}`, paddingLeft: 8 }}
          >
            <button
              type="button"
              className="d-block rounded px-2 py-1 w-100 text-start border-0 bg-transparent"
              style={{
                transition: 'background 0.15s',
                background: isCritical ? 'rgba(220,38,38,0.04)' : undefined,
                cursor: onSelectDonor ? 'pointer' : 'default',
              }}
              onClick={() => onSelectDonor?.(d)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-lavender)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isCritical ? 'rgba(220,38,38,0.04)' : ''; }}
              title={[
                formatDonorOutreachSummary(d.riskBand, d.outreachPriorityRank),
                d.topDrivers?.[0] ?? '',
              ].filter(Boolean).join(' · ')}
            >
              <div className="d-flex align-items-center justify-content-between gap-2">
                <span className="fw-semibold text-truncate" style={{ color: 'var(--hw-navy)' }}>
                  {d.displayName || `Supporter #${d.supporterId}`}
                </span>
                <span
                  className={`badge rounded-pill flex-shrink-0 ${isCritical ? 'text-bg-danger' : isHigh ? 'text-bg-warning' : 'text-bg-secondary'}`}
                  style={{ fontSize: '0.65rem', fontWeight: 700 }}
                >
                  {d.riskBand}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function BestNextPostWidget() {
  const [data, setData] = useState<SocialRecommendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    recommendSocialPost({ goal: 'donations', topK: 1 })
      .then((r) => {
        if (!cancelled) {
          setData(r);
          setErr(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setErr(e.message || 'Recommendations are temporarily unavailable.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState message="Loading ML insights…" size="compact" />;
  if (err) return <ErrorState message={err} />;
  const rec = data?.recommendations?.[0];
  if (!rec) {
    return <p className="text-muted mb-0">No recommendation returned.</p>;
  }

  return (
    <div>
      <div className="mb-1">
        <span className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
          {rec.platform}
        </span>
        <span className="text-muted"> · {rec.postType}</span>
      </div>
      <div className="text-muted small">
        {rec.mediaType} · {rec.postHour}:00 · topic: {rec.contentTopic || '—'}
      </div>
      <div className="small mt-2 text-muted">
        Estimated chance of a gift-linked referral:{' '}
        <strong className="text-body">{(rec.predictedPAnyReferral * 100).toFixed(0)}%</strong>
      </div>
      <p className="small text-muted mt-2 mb-0" style={{ lineHeight: 1.45 }}>
        {rec.whyRecommended}
      </p>
    </div>
  );
}

interface UnallocatedDonation {
  donationId: number;
  donationDate?: string | null;
  amount?: number | null;
  estimatedValue?: number | null;
  currencyCode?: string | null;
  impactUnit?: string | null;
  donationType?: string | null;
  supporter?: { displayName?: string | null; organizationName?: string | null } | null;
}

interface AllocFormState {
  donationId: number;
  safehouseId: number;
  programArea: string;
  amount: string;
  submitting: boolean;
  error: string | null;
  done: boolean;
}

function UnallocatedDonationsWidget({ onUnallocatedCount }: { onUnallocatedCount?: (n: number) => void }) {
  const [items, setItems] = useState<UnallocatedDonation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, AllocFormState>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPaged<UnallocatedDonation>('/api/donations', 1, 10, { unallocated: 'true' })
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setErr(null);
          onUnallocatedCount?.(r.totalCount);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) { setErr(e.message); setItems([]); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleExpand(id: number) {
    setExpandedId((prev) => prev === id ? null : id);
    setForms((prev) => ({
      ...prev,
      [id]: prev[id] ?? { donationId: id, safehouseId: 0, programArea: '', amount: '', submitting: false, error: null, done: false },
    }));
  }

  async function submitAllocation(donationId: number) {
    const f = forms[donationId];
    if (!f) return;
    if (!f.safehouseId) {
      setForms((prev) => ({ ...prev, [donationId]: { ...f, error: 'Select a safehouse.' } }));
      return;
    }
    setForms((prev) => ({ ...prev, [donationId]: { ...f, submitting: true, error: null } }));
    try {
      await postJson('/api/donation-allocations', {
        donationId,
        safehouseId: f.safehouseId,
        programArea: f.programArea || null,
        amountAllocated: f.amount ? Number(f.amount) : null,
        allocationDate: new Date().toISOString().split('T')[0],
      });
      setForms((prev) => ({ ...prev, [donationId]: { ...f, submitting: false, done: true } }));
      setItems((prev) => prev?.filter((d) => d.donationId !== donationId) ?? prev);
      onUnallocatedCount?.((items?.length ?? 1) - 1);
    } catch (e) {
      setForms((prev) => ({ ...prev, [donationId]: { ...f, submitting: false, error: e instanceof Error ? e.message : 'Failed.' } }));
    }
  }

  if (loading) return <LoadingState message="Loading…" size="compact" />;
  if (err) return <ErrorState message={err} />;
  if (!items?.length) return <p className="text-muted mb-0 small">No unallocated donations — all caught up!</p>;

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 280, overflowY: 'auto' }}>
      {items.map((d) => {
        const name = d.supporter?.displayName?.trim() || d.supporter?.organizationName?.trim() || `Donation #${d.donationId}`;
        const f = forms[d.donationId];
        const isExpanded = expandedId === d.donationId;
        const valueLine = formatDonationValueOneLiner(d);
        const dateStr = d.donationDate ? new Date(d.donationDate).toLocaleDateString() : '';
        const rowTitle = [dateStr, d.donationType, valueLine].filter(Boolean).join(' · ') || undefined;
        return (
          <li key={d.donationId} className="mb-2 border-bottom border-light pb-2" style={{ borderLeft: '3px solid #dc2626', paddingLeft: 8 }}>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <div className="fw-semibold small text-truncate" style={{ color: 'var(--hw-navy)' }} title={rowTitle}>
                {name}
                <span className="text-muted fw-normal"> · {valueLine}</span>
              </div>
              <button
                type="button"
                className="btn btn-sm fw-semibold flex-shrink-0"
                style={{ fontSize: 11, background: isExpanded ? '#f1f5f9' : 'var(--hw-purple)', color: isExpanded ? '#1E3A5F' : 'white', borderRadius: 6, padding: '3px 10px' }}
                title={rowTitle}
                onClick={() => toggleExpand(d.donationId)}
              >
                {isExpanded ? 'Cancel' : 'Allocate →'}
              </button>
            </div>
            {isExpanded && f && !f.done && (
              <div className="mt-2 p-2 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {f.error && <div className="text-danger small mb-1">{f.error}</div>}
                <div className="d-flex flex-wrap gap-2 align-items-end">
                  <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                    <label className="form-label mb-1" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Safehouse</label>
                    <SafehouseSearchCombobox
                      value={f.safehouseId}
                      onChange={(safehouseId) => setForms((p) => ({ ...p, [d.donationId]: { ...f, safehouseId } }))}
                      disabled={f.submitting}
                    />
                  </div>
                  <div>
                    <label className="form-label mb-1" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Program area</label>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 148 }}
                      value={f.programArea}
                      onChange={(e) => setForms((p) => ({ ...p, [d.donationId]: { ...f, programArea: e.target.value } }))}
                    >
                      <option value="">Select…</option>
                      {ALLOCATION_PROGRAM_AREA_PRESETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label mb-1" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>Amount</label>
                    <input type="number" className="form-control form-control-sm" style={{ width: 100 }} placeholder="e.g. 5000"
                      value={f.amount} onChange={(e) => setForms((p) => ({ ...p, [d.donationId]: { ...f, amount: e.target.value } }))} />
                  </div>
                  <button type="button" className="btn btn-sm btn-success fw-semibold" disabled={f.submitting} onClick={() => void submitAllocation(d.donationId)}>
                    {f.submitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            {f?.done && <div className="text-success small mt-1"><i className="bi bi-check-circle me-1" />Allocated!</div>}
          </li>
        );
      })}
    </ul>
  );
}

// ── Dashboard quick-profile modals ──

interface SupporterDetailRow {
  supporterId: number;
  supporterType?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  status?: string | null;
  firstDonationDate?: string | null;
}

interface DonationAmountRow {
  amount?: number | null;
  currencyCode?: string | null;
  donationDate?: string | null;
}

function useModalDismiss(onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

function AdminDonorQuickModal({
  selection,
  onClose,
}: {
  selection: DonorChurnRow | null;
  onClose: () => void;
}) {
  const open = selection !== null;
  useModalDismiss(onClose, open);

  const [supporter, setSupporter] = useState<SupporterDetailRow | null>(null);
  const [donationsPage, setDonationsPage] = useState<PagedResult<DonationAmountRow> | null>(null);
  const [extraLoading, setExtraLoading] = useState(false);
  const [extraError, setExtraError] = useState(false);

  useEffect(() => {
    if (!selection) {
      setSupporter(null);
      setDonationsPage(null);
      setExtraError(false);
      return;
    }
    let cancelled = false;
    const id = selection.supporterId;
    setExtraLoading(true);
    setExtraError(false);
    Promise.all([
      fetchJson<SupporterDetailRow>(`/api/supporters/${id}`),
      fetchPaged<DonationAmountRow>('/api/donations', 1, 100, { supporterId: id }),
    ])
      .then(([sup, dPage]) => {
        if (cancelled) return;
        setSupporter(sup);
        setDonationsPage(dPage);
      })
      .catch(() => {
        if (!cancelled) {
          setSupporter(null);
          setDonationsPage(null);
          setExtraError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setExtraLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  if (!selection) return null;

  const displayName =
    selection.displayName?.trim() ||
    supporter?.displayName?.trim() ||
    supporter?.organizationName?.trim() ||
    `Supporter #${selection.supporterId}`;

  const donationList =
    !extraLoading && !extraError && donationsPage ? (
      (() => {
        const items = donationsPage.items;
        const cur = items[0]?.currencyCode ?? 'PHP';
        const sumSample = items.reduce((s, d) => s + (d.amount != null ? Number(d.amount) : 0), 0);
        const lastDate = items[0]?.donationDate
          ? new Date(items[0].donationDate).toLocaleDateString()
          : null;
        return (
          <ul className="small text-muted mb-0 ps-3">
            <li>
              <strong className="text-body">Recorded gifts:</strong> {donationsPage.totalCount.toLocaleString()}
            </li>
            {lastDate && (
              <li>
                <strong className="text-body">Most recent gift:</strong> {lastDate}
              </li>
            )}
            {items.length > 0 && (
              <li>
                <strong className="text-body">
                  {donationsPage.totalCount <= items.length
                    ? 'Total given (known amounts):'
                    : 'Total (recent sample):'}
                </strong>{' '}
                {formatAmountMaybePhpAndUsd(sumSample, cur)}
              </li>
            )}
          </ul>
        );
      })()
    ) : null;

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adminDonorQuickTitle"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header" style={{ background: '#F5F3FF', borderBottom: '1px solid #E9D5FF' }}>
            <h5 className="modal-title fw-bold mb-0" id="adminDonorQuickTitle" style={{ color: '#1E3A5F' }}>
              Donor insights — {displayName}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <p className="small text-muted mb-2">
              <strong>Outreach priority:</strong>{' '}
              {formatDonorOutreachSummary(selection.riskBand, selection.outreachPriorityRank)}
            </p>
            {selection.outreachNote?.trim() && (
              <p className="small border rounded p-2 bg-light mb-3">{selection.outreachNote.trim()}</p>
            )}
            <p className="fw-semibold small mb-2" style={{ color: 'var(--hw-navy)' }}>
              Key drivers
            </p>
            <ul className="small mb-4">
              {(selection.topDrivers ?? []).slice(0, 8).map((t, i) => (
                <li key={`drv-${i}`}>{t}</li>
              ))}
              {(!selection.topDrivers || selection.topDrivers.length === 0) && (
                <li className="text-muted">None listed</li>
              )}
            </ul>
            <p className="fw-semibold small mb-2" style={{ color: 'var(--hw-navy)' }}>
              Supporter record &amp; gifts
            </p>
            {extraLoading && <p className="small text-muted mb-0">Loading supporter details…</p>}
            {!extraLoading && extraError && (
              <p className="small text-muted mb-0">Could not load supporter profile or contributions.</p>
            )}
            {!extraLoading && !extraError && supporter && (
              <ul className="small text-muted mb-3 ps-3">
                <li>
                  <strong className="text-body">Type:</strong> {supporter.supporterType?.trim() || '—'}
                </li>
                <li>
                  <strong className="text-body">Status:</strong> {supporter.status?.trim() || '—'}
                </li>
                <li>
                  <strong className="text-body">First gift:</strong>{' '}
                  {supporter.firstDonationDate
                    ? new Date(supporter.firstDonationDate).toLocaleDateString()
                    : '—'}
                </li>
              </ul>
            )}
            {!extraLoading && !extraError && donationList}
          </div>
          <div className="modal-footer" style={{ borderTop: '1px solid var(--hw-bg-lavender2)' }}>
            <Link to="/admin/donations" className="btn btn-outline-primary btn-sm" onClick={onClose}>
              Open supporters
            </Link>
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface LiveStats {
  successfulReintegrations: number;
}

export default function AdminHomePage() {
  const { authSession } = useAuth();
  const navigate = useNavigate();

  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [residentCriticalCount, setResidentCriticalCount] = useState(0);
  const [donorCriticalCount, setDonorCriticalCount] = useState(0);
  const [unallocatedCount, setUnallocatedCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchJson<LiveStats>('/api/public-impact/live-stats')
      .then((s) => { if (!cancelled) setLiveStats(s); })
      .catch(() => { /* non-critical — OKR card shows — on error */ });
    return () => { cancelled = true; };
  }, []);
  const [donorQuick, setDonorQuick] = useState<DonorChurnRow | null>(null);

  const [recentDonations, setRecentDonations] = useState<PagedResult<RecentDonationRow> | null>(null);
  const [recentError, setRecentError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPaged<RecentDonationRow>('/api/donations', 1, 8)
      .then((r) => {
        if (!cancelled) setRecentDonations(r);
      })
      .catch(() => {
        if (!cancelled) setRecentError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalResidents   = useCount('/api/residents');
  const activeResidents  = useCount('/api/residents', { caseStatus: 'Active' });
  const totalSessions    = useCount('/api/process-recordings');
  const totalVisits      = useCount('/api/home-visitations');
  const upcomingConfs    = useCount('/api/case-conferences', { upcoming: 'true' });

  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">

        {/* Header */}
        <div className="mb-5 d-flex align-items-stretch justify-content-between gap-4 flex-wrap">
          <div>
            <span
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#0D9488',
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Administration
            </span>
            <h1
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 28,
                color: '#1E3A5F',
                marginBottom: 8,
                lineHeight: 1.2,
              }}
            >
              Dashboard
            </h1>
            <p className="text-muted mb-0" style={{ fontSize: 14 }}>
              Welcome back, <strong>{authSession.email}</strong>
              {authSession.roles.length > 0 && (
                <span className="ms-2">
                  {authSession.roles.map((r) => (
                    <span
                      key={r}
                      className="badge rounded-pill ms-1"
                      style={{ background: 'var(--hw-purple)', color: 'white', fontSize: '0.7rem' }}
                    >
                      {r}
                    </span>
                  ))}
                </span>
              )}
            </p>
          </div>
          {/* OKR chip — stretches to full height of the header left block */}
          <Link
            to="/admin/residents?reintegrationStatus=Completed"
            className="text-decoration-none flex-shrink-0"
            style={{ display: 'flex', alignSelf: 'stretch' }}
          >
            <div
              className="d-flex align-items-center gap-2 rounded-3 px-3"
              style={{
                background: '#FEF3C7',
                border: '1px solid #D97706',
                transition: 'box-shadow 0.15s',
                width: '100%',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(217,119,6,0.25)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <i className="bi bi-star-fill" style={{ color: '#D97706', fontSize: 16 }} />
              <div>
                <div className="fw-bold" style={{ fontSize: 22, color: '#92400e', lineHeight: 1 }}>
                  {liveStats != null ? liveStats.successfulReintegrations : '—'}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.4, marginTop: 4 }}>
                  Successful Reintegrations
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Zone 1 — Action Required */}
        <div className="mb-5">
          <p className="hw-eyebrow mb-3">Action Required</p>
          <div className="row g-3">
            {/* Residents needing attention */}
            <div className="col-12 col-lg-4">
              <div
                className="card border-0 rounded-3 h-100"
                style={residentCriticalCount > 0 ? {
                  boxShadow: '0 0 0 2px #dc2626, 0 4px 20px #dc262644',
                  border: '1.5px solid #dc2626',
                } : { boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}
              >
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    {residentCriticalCount > 0 && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0, boxShadow: '0 0 6px 2px #dc262688' }} />
                    )}
                    <h3 className="h5 fw-bold mb-0" style={{ color: 'var(--hw-navy)', flex: 1 }}>Residents needing attention</h3>
                    {residentCriticalCount > 0 && (
                      <span className="badge rounded-pill" style={{ background: '#dc2626', color: 'white', fontSize: '0.62rem' }}>
                        {residentCriticalCount} Critical
                      </span>
                    )}
                  </div>
                  <div className="flex-grow-1 small">
                    <ResidentsNeedingAttentionWidget
                      onCriticalCount={setResidentCriticalCount}
                      onOpenProfile={(id) => navigate(`/admin/residents/${id}`)}
                    />
                  </div>
                  <Link to="/admin/residents" className="small fw-semibold text-decoration-none mt-3" style={{ color: 'var(--hw-purple)' }}>
                    Open caseload →
                  </Link>
                </div>
              </div>
            </div>
            {/* Donations to allocate */}
            <div className="col-12 col-lg-4">
              <div
                className="card border-0 rounded-3 h-100"
                style={unallocatedCount > 0 ? {
                  boxShadow: '0 0 0 2px #dc2626, 0 4px 20px #dc262644',
                  border: '1.5px solid #dc2626',
                } : { boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}
              >
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    {unallocatedCount > 0 && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0, boxShadow: '0 0 6px 2px #dc262688' }} />
                    )}
                    <h3 className="h5 fw-bold mb-0" style={{ color: 'var(--hw-navy)', flex: 1 }}>Donations to allocate</h3>
                    {unallocatedCount > 0 && (
                      <span className="badge rounded-pill" style={{ background: '#dc2626', color: 'white', fontSize: '0.62rem' }}>
                        {unallocatedCount} unallocated
                      </span>
                    )}
                  </div>
                  <div className="flex-grow-1 small">
                    <UnallocatedDonationsWidget onUnallocatedCount={setUnallocatedCount} />
                  </div>
                  <Link to="/admin/donations/allocations" className="small fw-semibold text-decoration-none mt-3" style={{ color: 'var(--hw-purple)' }}>
                    Open allocations →
                  </Link>
                </div>
              </div>
            </div>
            {/* Donors needing outreach */}
            <div className="col-12 col-lg-4">
              <div
                className="card border-0 rounded-3 h-100"
                style={donorCriticalCount > 0 ? {
                  boxShadow: '0 0 0 2px #dc2626, 0 4px 20px #dc262644',
                  border: '1.5px solid #dc2626',
                } : { boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}
              >
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    {donorCriticalCount > 0 && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0, boxShadow: '0 0 6px 2px #dc262688' }} />
                    )}
                    <h3 className="h5 fw-bold mb-0" style={{ color: 'var(--hw-navy)', flex: 1 }}>Donors needing outreach</h3>
                    {donorCriticalCount > 0 && (
                      <span className="badge rounded-pill" style={{ background: '#dc2626', color: 'white', fontSize: '0.62rem' }}>
                        {donorCriticalCount} Critical
                      </span>
                    )}
                  </div>
                  <div className="flex-grow-1 small">
                    <AtRiskDonorsWidget onCriticalCount={setDonorCriticalCount} onSelectDonor={(d) => setDonorQuick(d)} />
                  </div>
                  <Link to="/admin/donations" className="small fw-semibold text-decoration-none mt-3" style={{ color: 'var(--hw-purple)' }}>
                    Open supporters →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="row g-3 mb-5">
          <MetricCard
            label="Total residents on record"
            sublabel="All Residents"
            metric={totalResidents}
            accentColor="var(--hw-purple)"
            icon="people"
            linkTo="/admin/residents"
          />
          <MetricCard
            label="Currently active cases"
            sublabel="Active Cases"
            metric={activeResidents}
            accentColor="var(--hw-teal)"
            icon="clipboard-data"
            linkTo="/admin/residents?caseStatus=Active"
          />
          <MetricCard
            label="Counseling sessions logged"
            sublabel="Session notes"
            metric={totalSessions}
            accentColor="var(--hw-purple-light)"
            icon="file-earmark-text"
            linkTo="/admin/residents/process-recordings"
          />
          <MetricCard
            label="Home visits conducted"
            sublabel="Visits & conferences"
            metric={totalVisits}
            accentColor="var(--hw-amber)"
            icon="house-door"
            linkTo="/admin/residents/visits-conferences"
          />
        </div>

        {/* Recommended next post — full width */}
        <div className="mb-5">
          <div className="card border-0 rounded-3" style={{ boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}>
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className="h6 fw-semibold mb-0" style={{ color: 'var(--hw-navy)' }}>
                  <i className="bi bi-lightbulb me-2" style={{ color: 'var(--hw-purple)' }} />
                  Recommended next post
                </h3>
                <Link to="/admin/social-media/suggest" className="small fw-semibold text-decoration-none" style={{ color: 'var(--hw-purple)' }}>
                  Explore recommendations →
                </Link>
              </div>
              <BestNextPostWidget />
            </div>
          </div>
        </div>

        {/* Recent donations */}
        <div className="mb-5">
          <p className="hw-eyebrow mb-2">Fundraising</p>
          <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
            <div className="card-body p-0">
              <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom" style={{ background: 'var(--hw-bg-lavender)' }}>
                <span className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
                  Recent donations
                </span>
                <Link to="/admin/donations/contributions" className="small fw-semibold text-decoration-none" style={{ color: 'var(--hw-purple)' }}>
                  View all →
                </Link>
              </div>
              {recentError && <div className="px-4 py-3"><ErrorState message="Could not load donations." /></div>}
              {!recentError && recentDonations === null && (
                <div className="px-4 py-4"><LoadingState message="Loading donations…" size="compact" /></div>
              )}
              {!recentError && recentDonations && recentDonations.items.length === 0 && (
                <div className="px-4 py-4 text-muted small">No donation rows yet.</div>
              )}
              {!recentError && recentDonations && recentDonations.items.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-4 small text-muted">Date</th>
                        <th className="small text-muted">Supporter</th>
                        <th className="small text-muted">Type</th>
                        <th className="small text-muted">Cash</th>
                        <th className="small text-muted">Quantity</th>
                        <th className="pe-4 small text-muted">Campaign</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentDonations.items.map((d) => {
                        const name =
                          d.supporter?.displayName?.trim() ||
                          d.supporter?.organizationName?.trim() ||
                          '—';
                        return (
                          <tr
                            key={d.donationId}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/admin/donations/contributions?donationId=${d.donationId}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/admin/donations/contributions?donationId=${d.donationId}`);
                              }
                            }}
                            title="Open in Contributions (filtered to this gift)"
                          >
                            <td className="ps-4 text-muted small">
                              {d.donationDate
                                ? new Date(d.donationDate).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="fw-medium" style={{ color: 'var(--hw-navy)' }}>
                              {name}
                            </td>
                            <td className="small">{d.donationType ?? '—'}</td>
                            <td className="small tabular-nums text-muted">{formatDonationCashAmountCell(d)}</td>
                            <td className="small tabular-nums text-muted">{formatDonationQuantityCell(d)}</td>
                            <td className="pe-4 small text-muted">{d.campaignName ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming conferences banner */}
        {!upcomingConfs.loading && !upcomingConfs.error && (upcomingConfs.count ?? 0) > 0 && (
          <Link
            to="/admin/residents/visits-conferences"
            className="text-decoration-none rounded-3 d-flex align-items-center gap-3 px-4 py-3 mb-5"
            style={{
              background: 'linear-gradient(135deg, var(--hw-teal) 0%, var(--hw-purple) 100%)',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            <i className="bi bi-calendar-event" style={{ fontSize: '1.5rem' }} />
            <div>
              <p className="fw-semibold mb-0">
                {upcomingConfs.count} upcoming case conference{upcomingConfs.count !== 1 ? 's' : ''}
              </p>
              <p className="small mb-0" style={{ opacity: 0.85 }}>
                Review scheduled conferences in the Visits &amp; conferences tab.
              </p>
            </div>
            <span
              className="btn btn-sm ms-auto fw-semibold"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1.5px solid rgba(255,255,255,0.6)',
                color: 'white',
                whiteSpace: 'nowrap',
              }}
            >
              View →
            </span>
          </Link>
        )}

        {/* Quick links */}
        <div className="mb-4">
          <p className="hw-eyebrow mb-3">Quick Links</p>
        </div>
        <div className="row g-3">
          <QuickLink
            to="/admin/residents"
            icon="people"
            title="Residents"
            description="View, search, and manage all resident profiles."
          />
          <QuickLink
            to="/admin/residents/process-recordings"
            icon="file-earmark-text"
            title="Session notes"
            description="Record and review counseling session documentation."
          />
          <QuickLink
            to="/admin/residents/visits-conferences"
            icon="house-door"
            title="Visits &amp; conferences"
            description="Log home visits and see upcoming case conferences."
          />
          <QuickLink
            to="/admin/donations"
            icon="heart"
            title="Supporters"
            description="Manage donor profiles and contribution history."
          />
          <QuickLink
            to="/admin/reports"
            icon="bar-chart-fill"
            title="Reports &amp; Analytics"
            description="Giving trends, outcomes, site performance, and annual service summaries."
          />
        </div>
      </div>

      <AdminDonorQuickModal selection={donorQuick} onClose={() => setDonorQuick(null)} />
    </div>
  );
}
