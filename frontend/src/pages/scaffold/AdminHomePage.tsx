import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchPaged } from '../../lib/apiClient';
import {
  getAtRiskDonors,
  getResidentPriority,
  recommendSocialPost,
  type DonorChurnRow,
  type ResidentMlScoreRow,
  type SocialRecommendResponse,
} from '../../lib/mlApi';
import { useAuth } from '../../context/AuthContext';

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
              {icon}
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

// ── ML dashboard widgets (isolated fetch/error) ───────────────────────────────

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
          <p className="hw-eyebrow mb-2" style={{ color: 'var(--hw-teal)' }}>ML insights</p>
          <h3 className="h6 fw-semibold mb-3" style={{ color: 'var(--hw-navy)' }}>{title}</h3>
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
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted mb-0">Loading…</p>;
  if (err) return <p className="text-danger mb-0">{err}</p>;
  if (!rows?.length) return <p className="text-muted mb-0">No ML readiness rows returned.</p>;

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
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted mb-0">Loading…</p>;
  if (err) return <p className="text-danger mb-0">{err}</p>;
  if (!rows?.length) return <p className="text-muted mb-0">No donor churn scores returned.</p>;

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
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-muted mb-0">Loading…</p>;
  if (err) return <p className="text-danger mb-0">{err}</p>;
  const rec = data?.recommendations?.[0];
  if (!rec) return <p className="text-muted mb-0">No recommendation returned.</p>;

  return (
    <div>
      <div className="mb-1">
        <span className="fw-semibold" style={{ color: 'var(--hw-navy)' }}>{rec.platform}</span>
        <span className="text-muted"> · {rec.postType}</span>
      </div>
      <div className="text-muted small">
        {rec.mediaType} · {rec.postHour}:00 · topic: {rec.contentTopic || '—'}
      </div>
      <div className="small mt-2">
        P(referral): <strong>{(rec.predictedPAnyReferral * 100).toFixed(0)}%</strong>
      </div>
      <p className="small text-muted mt-2 mb-0" style={{ lineHeight: 1.45 }}>{rec.whyRecommended}</p>
    </div>
  );
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
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--hw-purple-soft)';
          (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-lavender)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(107,33,168,0.08)';
          (e.currentTarget as HTMLElement).style.background = 'var(--hw-bg-white)';
        }}
      >
        <span style={{ fontSize: '1.4rem', lineHeight: 1, marginTop: 2 }}>{icon}</span>
        <div>
          <p className="fw-semibold mb-1" style={{ color: 'var(--hw-purple)' }}>{title}</p>
          <p className="small text-muted mb-0">{description}</p>
        </div>
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminHomePage() {
  const { authSession } = useAuth();

  const totalResidents   = useCount('/api/residents');
  const activeResidents  = useCount('/api/residents', { caseStatus: 'Active' });
  const totalSessions    = useCount('/api/process-recordings');
  const totalVisits      = useCount('/api/home-visitations');
  const upcomingConfs    = useCount('/api/case-conferences', { upcoming: 'true' });

  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">

        {/* Header */}
        <div className="mb-5">
          <p className="hw-eyebrow mb-1">Admin Portal</p>
          <h1 className="hw-heading mb-1" style={{ fontSize: '2rem' }}>Dashboard</h1>
          <p className="text-muted mb-0">
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
            icon="👥"
            linkTo="/admin/residents"
          />
          <MetricCard
            label="Currently active cases"
            sublabel="Active Cases"
            metric={activeResidents}
            accentColor="var(--hw-teal)"
            icon="📋"
            linkTo="/admin/residents"
          />
          <MetricCard
            label="Counseling sessions logged"
            sublabel="Process Recordings"
            metric={totalSessions}
            accentColor="var(--hw-purple-light)"
            icon="📝"
            linkTo="/admin/residents/process-recordings"
          />
          <MetricCard
            label="Home visits conducted"
            sublabel="Home Visitations"
            metric={totalVisits}
            accentColor="var(--hw-amber)"
            icon="🏠"
            linkTo="/admin/residents/visits-conferences"
          />
        </div>

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

        {/* Upcoming conferences banner */}
        {!upcomingConfs.loading && !upcomingConfs.error && (upcomingConfs.count ?? 0) > 0 && (
          <div
            className="rounded-3 d-flex align-items-center gap-3 px-4 py-3 mb-5"
            style={{
              background: 'linear-gradient(135deg, var(--hw-teal) 0%, var(--hw-purple) 100%)',
              color: 'white',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>📅</span>
            <div>
              <p className="fw-semibold mb-0">
                {upcomingConfs.count} upcoming case conference{upcomingConfs.count !== 1 ? 's' : ''}
              </p>
              <p className="small mb-0" style={{ opacity: 0.85 }}>
                Review scheduled conferences in the Home Visits &amp; Conferences tab.
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
            icon="👥"
            title="Caseload Inventory"
            description="View, search, and manage all resident profiles."
          />
          <QuickLink
            to="/admin/residents/process-recordings"
            icon="📝"
            title="Process Recordings"
            description="Log and review counseling session notes."
          />
          <QuickLink
            to="/admin/residents/visits-conferences"
            icon="🏠"
            title="Home Visits &amp; Conferences"
            description="Record field visits and view upcoming conferences."
          />
          <QuickLink
            to="/admin/donations"
            icon="💛"
            title="Supporters"
            description="Manage donor profiles and contribution history."
          />
          <QuickLink
            to="/admin/reports"
            icon="📊"
            title="Reports &amp; Analytics"
            description="Giving trends, outcomes, site performance, and annual service summaries."
          />
        </div>
      </div>
    </div>
  );
}
