import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchPaged, type PagedResult } from '../../lib/apiClient';
import {
  getAtRiskDonors,
  getResidentPriority,
  recommendSocialPost,
  type DonorChurnRow,
  type ResidentMlScoreRow,
  type SocialRecommendResponse,
} from '../../lib/mlApi';
import { useAuth } from '../../context/AuthContext';
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

// ── ML dashboard widgets (isolated fetch/error so one failure does not block others) ──

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
          <p className="hw-eyebrow mb-2" style={{ color: 'var(--hw-teal)' }}>
            ML insights
          </p>
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getResidentPriority(10)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setErr(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setErr(e.message || 'Could not load ML priority list.');
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

  if (loading) {
    return <p className="text-muted mb-0">Loading…</p>;
  }
  if (err) {
    return <p className="text-danger mb-0">{err}</p>;
  }
  if (!rows?.length) {
    return <p className="text-muted mb-0">No ML readiness rows returned.</p>;
  }

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
      {rows.slice(0, 8).map((r) => (
        <li key={r.residentCode} className="mb-2 pb-2 border-bottom border-light">
          <div className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
            {r.residentCode}
            <span className="text-muted fw-normal ms-1">· rank {r.supportPriorityRank}</span>
          </div>
          <div className="text-muted">{r.operationalBand}</div>
          <div className="text-muted">
            Readiness %ile:{' '}
            {r.readinessPercentileAmongCurrentResidents != null
              ? `${Number(r.readinessPercentileAmongCurrentResidents).toFixed(1)}%`
              : '—'}
          </div>
          {r.topRiskFactors?.[0] && (
            <div className="text-truncate" title={r.topRiskFactors[0]} style={{ fontSize: 12, color: '#64748B' }}>
              Risk: {r.topRiskFactors[0]}
            </div>
          )}
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

  if (loading) {
    return <p className="text-muted mb-0">Loading…</p>;
  }
  if (err) {
    return <p className="text-danger mb-0">{err}</p>;
  }
  if (!rows?.length) {
    return <p className="text-muted mb-0">No donor churn scores returned.</p>;
  }

  return (
    <ul className="list-unstyled mb-0" style={{ maxHeight: 220, overflowY: 'auto' }}>
      {rows.slice(0, 8).map((d) => (
        <li key={d.supporterId} className="mb-2 pb-2 border-bottom border-light">
          <div className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>
            {d.displayName || `Supporter #${d.supporterId}`}
          </div>
          <div className="text-muted">
            {d.riskBand} · outreach rank {d.outreachPriorityRank} · score {Number(d.churnRiskScore).toFixed(2)}
          </div>
          {d.topDrivers?.[0] && (
            <div className="text-truncate" title={d.topDrivers[0]} style={{ fontSize: 12, color: '#64748B' }}>
              {d.topDrivers[0]}
            </div>
          )}
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
          setErr(e.message || 'Social ML service unavailable.');
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

  if (loading) {
    return <p className="text-muted mb-0">Loading…</p>;
  }
  if (err) {
    return <p className="text-danger mb-0">{err}</p>;
  }
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
      <div className="small mt-2">
        P(referral):{' '}
        <strong>{(rec.predictedPAnyReferral * 100).toFixed(0)}%</strong>
      </div>
      <p className="small text-muted mt-2 mb-0" style={{ lineHeight: 1.45 }}>
        {rec.whyRecommended}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminHomePage() {
  const { authSession } = useAuth();

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

        {/* ML insights — staff-only API; failures are contained per widget */}
        <div className="mb-5">
          <p className="hw-eyebrow mb-3">Machine learning</p>
          <div className="row g-3">
            <MlSectionCard
              title="Residents needing attention"
              footerLink={{ to: '/admin/residents', label: 'Open caseload' }}
            >
              <ResidentsNeedingAttentionWidget />
            </MlSectionCard>
            <MlSectionCard
              title="At-risk donors"
              footerLink={{ to: '/admin/donations', label: 'Open supporters' }}
            >
              <AtRiskDonorsWidget />
            </MlSectionCard>
            <MlSectionCard
              title="Best next post (live model)"
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
              {recentError && (
                <div className="px-4 py-3 text-danger small">Could not load donations.</div>
              )}
              {!recentError && recentDonations === null && (
                <div className="px-4 py-4 text-muted small">Loading…</div>
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
          <div
            className="rounded-3 d-flex align-items-center gap-3 px-4 py-3 mb-5"
            style={{
              background: 'linear-gradient(135deg, var(--hw-teal) 0%, var(--hw-purple) 100%)',
              color: 'white',
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
            <Link
              to="/admin/residents/visits-conferences"
              className="btn btn-sm ms-auto fw-semibold"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1.5px solid rgba(255,255,255,0.6)',
                color: 'white',
                whiteSpace: 'nowrap',
              }}
            >
              View →
            </Link>
          </div>
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
