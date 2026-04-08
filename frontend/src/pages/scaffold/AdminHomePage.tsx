import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson, fetchPaged, type PagedResult } from '../../lib/apiClient';
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
  currencyCode?: string | null;
  campaignName?: string | null;
  supporter?: { displayName?: string | null; organizationName?: string | null } | null;
}

function fmtDonationMoney(n: number | null | undefined, currency = 'PHP') {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

// ── Insights dashboard widgets (isolated fetch/error so one failure does not block others) ──

function MlSectionCard({
  title,
  children,
  footerLink,
}: {
  title: string;
  children: ReactNode;
  footerLink?: { to: string; label: string };
}) {
  return (
    <div className="col-12 col-lg-4">
      <div className="card border-0 shadow-sm rounded-3 h-100">
        <div className="card-body d-flex flex-column">
          <h3 className="h6 fw-semibold mb-3" style={{ color: 'var(--hw-navy)' }}>
            {title}
          </h3>
          <div className="flex-grow-1 small">{children}</div>
          {footerLink && (
            <Link
              to={footerLink.to}
              className="small fw-semibold text-decoration-none mt-3"
              style={{ color: 'var(--hw-purple)' }}
            >
              {footerLink.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ResidentsNeedingAttentionWidget() {
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
  }, []);

  if (loading) return <LoadingState message="Loading ML insights…" size="compact" />;
  if (err) return <ErrorState message={err} />;
  if (!rows?.length) {
    return <p className="text-muted mb-0">No resident priority list returned.</p>;
  }

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
      {rows.slice(0, 8).map((r) => (
        <li key={r.residentCode} className="mb-2 pb-2 border-bottom border-light">
          <Link
            to="/admin/residents"
            className="text-decoration-none d-block rounded px-2 py-1"
            style={{ transition: 'background 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-lavender)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <div className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
              {r.residentCode}
            </div>
            <div className="text-muted small">
              {formatResidentPriorityRank(r.supportPriorityRank, totalScored)}
            </div>
            <div className="text-muted small">{r.operationalBand}</div>
            {r.topRiskFactors?.[0] && (
              <div className="text-truncate" title={r.topRiskFactors[0]} style={{ fontSize: 12, color: '#64748B' }}>
                Factor: {r.topRiskFactors[0]}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AtRiskDonorsWidget() {
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
  }, []);

  if (loading) return <LoadingState message="Loading ML insights…" size="compact" />;
  if (err) return <ErrorState message={err} />;
  if (!rows?.length) {
    return <p className="text-muted mb-0">No at-risk donor list returned.</p>;
  }

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
      {rows.slice(0, 8).map((d) => (
        <li key={d.supporterId} className="mb-2 pb-2 border-bottom border-light">
          <Link
            to="/admin/donations"
            className="text-decoration-none d-block rounded px-2 py-1"
            style={{ transition: 'background 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-lavender)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <div className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
              {d.displayName || `Supporter #${d.supporterId}`}
            </div>
            <div className="text-muted small">{formatDonorOutreachSummary(d.riskBand, d.outreachPriorityRank)}</div>
            {d.topDrivers?.[0] && (
              <div className="text-truncate" title={d.topDrivers[0]} style={{ fontSize: 12, color: '#64748B' }}>
                {d.topDrivers[0]}
              </div>
            )}
          </Link>
        </li>
      ))}
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

// ── Page ──────────────────────────────────────────────────────────────────────

interface LiveStats {
  totalResidents: number;
  successfulReintegrations: number;
  safehousesActive: number;
  donationsRaisedTotal: number;
  volunteerHoursTotal: number;
  reintegrationRatePct: number;
}

export default function AdminHomePage() {
  const { authSession } = useAuth();

  const [recentDonations, setRecentDonations] = useState<PagedResult<RecentDonationRow> | null>(null);
  const [recentError, setRecentError] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [alertRows, setAlertRows] = useState<ResidentMlScoreRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<LiveStats>('/api/public-impact/live-stats')
      .then((s) => { if (!cancelled) setLiveStats(s); })
      .catch(() => { /* optional */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getResidentCurrentScores()
      .then((scores) => {
        if (!cancelled) {
          const highPriority = scores
            .filter((s) => s.supportPriorityRank <= 2)
            .sort((a, b) => a.supportPriorityRank - b.supportPriorityRank)
            .slice(0, 5);
          setAlertRows(highPriority);
        }
      })
      .catch(() => { /* optional */ });
    return () => { cancelled = true; };
  }, []);

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

        {/* Header — match other admin pages (Poppins, bold navy title) */}
        <div className="mb-5">
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

        {/* North Star OKR Card */}
        {liveStats && (
          <div
            className="mb-4 rounded-3 p-4"
            style={{
              background: '#1E3A5F',
              color: '#fff',
            }}
          >
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>
                  North Star Metric
                </div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1 }}>
                  {liveStats.reintegrationRatePct}%
                </div>
                <div style={{ fontSize: 14, marginTop: 6, opacity: 0.85 }}>
                  Reintegration Success Rate
                </div>
                <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>
                  residents successfully reintegrated into society
                </div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8, fontStyle: 'italic' }}>
                  Every percentage point represents a life transformed.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* High-Priority Alerts */}
        {alertRows.length > 0 && (
          <div
            className="mb-4 rounded-3 p-3"
            style={{
              background: '#fff',
              border: '1px solid #FEE2E2',
              boxShadow: '0 2px 8px rgba(220,38,38,0.08)',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0" style={{ color: '#991B1B', fontSize: 14 }}>
                <i className="bi bi-exclamation-triangle-fill me-2" />
                Priority Alerts
              </h6>
              <Link to="/admin/residents" className="small fw-semibold text-decoration-none" style={{ color: '#6B21A8' }}>
                View all →
              </Link>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {alertRows.map((r) => (
                <div
                  key={r.residentCode}
                  className="d-flex align-items-center gap-2 rounded-pill px-3 py-1"
                  style={{
                    background: r.supportPriorityRank === 1 ? '#FEE2E2' : '#FEF3C7',
                    border: `1px solid ${r.supportPriorityRank === 1 ? '#FECACA' : '#FDE68A'}`,
                    fontSize: 12,
                  }}
                >
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: r.supportPriorityRank === 1 ? '#DC2626' : '#D97706',
                      color: '#fff',
                      fontSize: 10,
                    }}
                  >
                    {r.supportPriorityRank === 1 ? 'High Risk' : 'Elevated Risk'}
                  </span>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{r.residentCode}</span>
                  {r.operationalBand && (
                    <span style={{ color: '#64748B' }}>· {r.operationalBand}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2" style={{ fontSize: 11, color: '#94A3B8' }}>
              <i className="bi bi-calendar-check me-1" />
              Reminder: Check conference schedules for residents who haven't had a review recently.
            </div>
          </div>
        )}

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
            linkTo="/admin/residents"
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

        {/* Priority & Insights — staff-only API; failures are contained per widget */}
        <div className="mb-5">
          <p className="hw-eyebrow mb-3">Priority &amp; Insights</p>
          <div className="row g-3">
            <MlSectionCard
              title="Residents needing attention"
              footerLink={{ to: '/admin/residents', label: 'Open caseload' }}
            >
              <ResidentsNeedingAttentionWidget />
            </MlSectionCard>
            <MlSectionCard
              title="Donors needing outreach"
              footerLink={{ to: '/admin/donations', label: 'Open supporters' }}
            >
              <AtRiskDonorsWidget />
            </MlSectionCard>
            <MlSectionCard
              title="Recommended next post"
              footerLink={{ to: '/admin/social-media/suggest', label: 'Explore recommendations' }}
            >
              <BestNextPostWidget />
            </MlSectionCard>
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
                        <th className="small text-muted">Amount</th>
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
                          <tr key={d.donationId}>
                            <td className="ps-4 text-muted small">
                              {d.donationDate
                                ? new Date(d.donationDate).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="fw-medium" style={{ color: 'var(--hw-navy)' }}>
                              {name}
                            </td>
                            <td className="small">{d.donationType ?? '—'}</td>
                            <td className="small tabular-nums">
                              {fmtDonationMoney(d.amount != null ? Number(d.amount) : null, d.currencyCode ?? 'PHP')}
                            </td>
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
    </div>
  );
}
