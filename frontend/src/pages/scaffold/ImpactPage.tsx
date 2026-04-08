import { useState, useEffect, useRef } from 'react';
import { fetchJson } from '../../lib/apiClient';
import NavBar from '../../components/hw/NavBar';
import Footer from '../../components/hw/Footer';
import MetricCard from '../../components/hw/MetricCard';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

/* ── Types ───────────────────────────────────────────────────── */
interface MetricPayload {
  total_residents: number;
  donations_total_for_month: number;
  avg_health_score: number;
  avg_education_progress: number;
}
interface ImpactSnapshot {
  snapshot_id: number;
  snapshot_date: string;
  headline: string;
  summary_text: string;
  metric_payload_json: string;
  is_published: boolean;
  published_at: string;
}

interface ApiImpactSnapshot {
  snapshotId: number;
  snapshotDate?: string | null;
  headline?: string | null;
  summaryText?: string | null;
  metricPayloadJson?: string | null;
  isPublished?: boolean | null;
  publishedAt?: string | null;
}

function normalizeSnapshot(s: ApiImpactSnapshot): ImpactSnapshot {
  const sd = s.snapshotDate ? new Date(s.snapshotDate).toISOString().slice(0, 10) : '';
  const pa = s.publishedAt ? new Date(s.publishedAt).toISOString().slice(0, 10) : '';
  return {
    snapshot_id: s.snapshotId,
    snapshot_date: sd,
    headline: s.headline ?? '',
    summary_text: s.summaryText ?? '',
    metric_payload_json: s.metricPayloadJson ?? '{}',
    is_published: s.isPublished === true,
    published_at: pa,
  };
}

/* ── Helpers ─────────────────────────────────────────────────── */
function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseMetricPayload(raw: string): MetricPayload {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Support legacy payloads that were persisted with single quotes.
    try {
      parsed = JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  return {
    total_residents: asNumber(parsed.total_residents ?? parsed.residents_served),
    donations_total_for_month: asNumber(
      parsed.donations_total_for_month ?? parsed.donations_received_usd ?? parsed.donations_total,
    ),
    avg_health_score: asNumber(parsed.avg_health_score),
    avg_education_progress: asNumber(parsed.avg_education_progress),
  };
}
const fmtMonth = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

/** Last snapshot date included on charts (14 days before 2026-03-01) — drops placeholder Mar 2026 zeros. */
const CHART_SNAPSHOT_LAST_INCLUSIVE = '2026-02-15';

function snapshotIncludedInCharts(snapshotDate: string): boolean {
  return Boolean(snapshotDate && snapshotDate <= CHART_SNAPSHOT_LAST_INCLUSIVE);
}

/* ── Recharts tooltip style ──────────────────────────────────── */
const TT = {
  contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontFamily: 'Inter, sans-serif', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#1E3A5F', fontWeight: 700 },
};

/* ── Scroll fade-in ──────────────────────────────────────────── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add('hw-visible'); }, { threshold: 0.08 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return ref;
}

/* ── White chart card ────────────────────────────────────────── */
function Card({ title, sub, hint, children }: { title: string; sub?: string; hint?: string; children: React.ReactNode }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className="hw-fade-in" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 16px rgba(30,58,95,0.07)', padding: '1.4rem 1.5rem' }}>
      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: '#1E3A5F', fontSize: '0.9rem', margin: '0 0 2px' }}>{title}</p>
      {sub && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 0.35rem' }}>{sub}</p>}
      {hint && (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.55, margin: '0 0 1rem' }}>
          {hint}
        </p>
      )}
      {!sub && !hint && <div style={{ marginBottom: '1rem' }} />}
      {sub && !hint && <div style={{ marginBottom: '0.65rem' }} />}
      {children}
    </div>
  );
}

/* ── Stat summary box ────────────────────────────────────────── */
function StatBox({ label, value, color, bg, border }: { label: string; value: string; color: string; bg: string; border: string }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className="hw-fade-in" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '1.25rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(30,58,95,0.05)' }}>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '2rem', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color, opacity: 0.65, marginTop: 8 }}>{label}</div>
    </div>
  );
}

/* ── Report card ─────────────────────────────────────────────── */
function ReportCard({ snap, featured = false }: { snap: ImpactSnapshot; featured?: boolean }) {
  const [open, setOpen] = useState(featured);
  const p = parseMetricPayload(snap.metric_payload_json);
  const ref = useFadeIn();

  const pills = [
    { label: 'Residents', value: p.total_residents?.toLocaleString(), color: '#6B21A8', bg: '#f5f3ff', border: '#e9d5ff' },
    { label: 'Health Score', value: p.avg_health_score?.toFixed(2), color: '#0D9488', bg: '#f0fdf4', border: '#bbf7d0' },
    { label: 'Education', value: `${p.avg_education_progress?.toFixed(1)}%`, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Donations', value: `₱${(p.donations_total_for_month / 1000).toFixed(1)}K`, color: '#D97706', bg: '#fffbeb', border: '#fde68a' },
  ];

  return (
    <div ref={ref} className="hw-fade-in" style={{ background: '#fff', borderRadius: 16, border: featured ? '2px solid #6B21A8' : '1px solid #e2e8f0', boxShadow: featured ? '0 4px 24px rgba(107,33,168,0.1)' : '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden', marginBottom: '0.75rem' }}>
      <div style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {featured && <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', background: '#fffbeb', color: '#D97706', border: '1px solid #fde68a', padding: '0.2rem 0.6rem', borderRadius: 50 }}>Latest</span>}
          <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', background: '#f0fdf4', color: '#0D9488', border: '1px solid #bbf7d0', padding: '0.2rem 0.6rem', borderRadius: 50 }}>{fmtMonth(snap.snapshot_date)}</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>Published {fmtMonth(snap.published_at)}</span>
        </div>
        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, color: '#1E3A5F', fontSize: featured ? '1.1rem' : '0.95rem', margin: '0 0 0.5rem', lineHeight: 1.3 }}>{snap.headline}</h3>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.65, margin: 0, display: !open ? '-webkit-box' : 'block', WebkitLineClamp: !open ? 2 : undefined, WebkitBoxOrient: !open ? 'vertical' : undefined, overflow: !open ? 'hidden' : 'visible' }}>{snap.summary_text}</p>
      </div>

      {open && (
        <div style={{ padding: '0.75rem 1.5rem 1.25rem', background: '#fafaf9', borderTop: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {pills.map(pill => (
            <div key={pill.label} style={{ background: pill.bg, border: `1px solid ${pill.border}`, borderRadius: 12, padding: '0.5rem 0.85rem', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: pill.color, lineHeight: 1 }}>{pill.value}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: pill.color, opacity: 0.65, marginTop: 4 }}>{pill.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '0.6rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16, alignItems: 'center' }}>
        <button onClick={() => setOpen(x => !x)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#6B21A8', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
          {open ? 'Collapse' : 'View Metrics'}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <span style={{ color: '#e2e8f0' }}>·</span>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Download PDF
        </button>
      </div>
    </div>
  );
}

/* ── Tabs ────────────────────────────────────────────────────── */
const TABS = ['Overview', 'Donations', 'Residents', 'Wellness', 'Reports'] as const;
type Tab = typeof TABS[number];

interface LiveStats {
  totalResidents: number;
  successfulReintegrations: number;
  safehousesActive: number;
  donationsRaisedTotal: number;
  volunteerHoursTotal: number;
  reintegrationRatePct: number;
  oldestAdmissionYear?: number | null;
}

/* ── Page ────────────────────────────────────────────────────── */
export default function ImpactPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [snapshots, setSnapshots] = useState<ImpactSnapshot[]>([]);
  const [impactLoadError, setImpactLoadError] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ApiImpactSnapshot[]>('/api/public-impact/snapshots')
      .then((rows) => {
        if (!cancelled) setSnapshots(rows.map(normalizeSnapshot));
      })
      .catch(() => {
        if (!cancelled) {
          setImpactLoadError('Unable to load published impact data.');
          setSnapshots([]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchJson<LiveStats>('/api/public-impact/live-stats')
      .then((s) => { if (!cancelled) setLiveStats(s); })
      .catch(() => { /* KPI strip uses snapshot fallbacks */ });
    return () => { cancelled = true; };
  }, []);

  const published = snapshots
    .filter((s) => s.is_published)
    .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
  const featured = published[0];
  const rest = published.slice(1);

  const validSnapshots = [...published]
    .reverse()
    .filter((s) => {
      const p = parseMetricPayload(s.metric_payload_json);
      return p.avg_health_score > 0 || p.donations_total_for_month > 0;
    });

  const chartSnapshots = validSnapshots.filter((s) => snapshotIncludedInCharts(s.snapshot_date));

  const chartData = chartSnapshots.map((s) => {
    const p = parseMetricPayload(s.metric_payload_json);
    return {
      month: fmtShort(s.snapshot_date),
      donations: p.donations_total_for_month,
      residents: p.total_residents,
      healthScore: p.avg_health_score,
      educationProgress: p.avg_education_progress,
    };
  });

  const maxResidents =
    published.length > 0
      ? Math.max(...published.map((s) => parseMetricPayload(s.metric_payload_json).total_residents ?? 0))
      : 0;
  const totalDonationsPublished = published.reduce(
    (n, s) => n + parseMetricPayload(s.metric_payload_json).donations_total_for_month,
    0,
  );

  const totalDonationsCharts = chartSnapshots.reduce(
    (n, s) => n + parseMetricPayload(s.metric_payload_json).donations_total_for_month,
    0,
  );
  const latestHealth = chartSnapshots.length > 0
    ? parseMetricPayload(chartSnapshots[chartSnapshots.length - 1].metric_payload_json).avg_health_score
    : 0;
  const peakEducation = chartSnapshots.length > 0
    ? Math.max(...chartSnapshots.map((s) => parseMetricPayload(s.metric_payload_json).avg_education_progress))
    : 0;
  const monthsOfData = chartSnapshots.length;

  const bestDonationMonth = chartData.length
    ? chartData.reduce((best, row) => (row.donations > best.donations ? row : best), chartData[0])
    : null;

  return (
    <div style={{ fontFamily: 'var(--hw-font-body)', minHeight: '100vh', background: '#f8fafc' }}>
      <NavBar />

      {impactLoadError && (
        <div className="container-xl py-3" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="alert alert-warning mb-0 py-2 small" role="alert">{impactLoadError}</div>
        </div>
      )}

      {/* ── Hero (DonorDashboardPage-aligned layout) ── */}
      <section
        aria-label="Public impact introduction"
        style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)',
          paddingTop: '7rem',
          paddingBottom: '5rem',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'left' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1.25rem 1.75rem',
            }}
          >
            <div style={{ flex: '1 1 280px', minWidth: 0, maxWidth: 560 }}>
              <span className="hw-eyebrow">Public Impact Dashboard</span>
              <h1
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 900,
                  fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
                  color: '#fff',
                  margin: '0.45rem 0 0.65rem',
                  lineHeight: 1.1,
                }}
              >
                Our Impact
              </h1>
              <p
                style={{
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '1.05rem',
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Monthly anonymized aggregate reports for our community, donors, and partners. Every number represents a life changed.
              </p>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.88rem',
                  color: 'rgba(255,255,255,0.62)',
                  lineHeight: 1.65,
                  margin: '1.1rem 0 0',
                  paddingLeft: 'clamp(0.75rem, 2vw, 1rem)',
                  borderLeft: '2px solid rgba(94, 234, 212, 0.45)',
                }}
              >
                These reports contain <strong style={{ color: '#5eead4' }}>anonymized, aggregated</strong> data intended for public-facing dashboards and donor communications. No personally identifiable information is included.
              </p>
            </div>
            <div
              style={{
                flex: '0 0 auto',
                alignSelf: 'center',
                marginRight: 'clamp(1rem, 3vw, 2rem)',
              }}
            >
              <a
                href="/#donate"
                className="hw-btn-magenta"
                style={{
                  padding: '1rem 2.5rem',
                  borderRadius: 50,
                  fontWeight: 700,
                  fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                  textDecoration: 'none',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                }}
              >
                Donate now →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ marginTop: -44, background: 'rgba(30,58,95,0.92)', backdropFilter: 'blur(14px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 20px 60px rgba(30,58,95,0.28)', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              {
                target: liveStats?.totalResidents ?? maxResidents,
                suffix: '+',
                label: 'Youth supported',
                description: 'Total young people who have received care in our programs, to date.',
              },
              {
                target: liveStats?.successfulReintegrations ?? 0,
                suffix: '',
                label: 'Families reunified',
                description: 'Youth who have moved to a stable, safe home with family or guardians.',
              },
              {
                target: liveStats
                  ? Math.round(liveStats.volunteerHoursTotal / 1000)
                  : 0,
                suffix: 'K',
                label: 'Volunteer hours',
                description: 'Time neighbors and mentors give—tutoring, activities, and meals.',
              },
              {
                target: liveStats
                  ? Math.round(Number(liveStats.donationsRaisedTotal) / 1000)
                  : Math.round(totalDonationsPublished / 1000),
                prefix: '$',
                suffix: 'K',
                label: 'Donor support',
                description: 'Gifts that keep rooms staffed, food on the table, and services running.',
              },
            ].map((kpi, i) => (
              <div key={kpi.label} style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <MetricCard
                  target={kpi.target}
                  suffix={kpi.suffix}
                  prefix={kpi.prefix}
                  label={kpi.label}
                  description={kpi.description}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ maxWidth: 1100, margin: '2.5rem auto 0', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '0.5rem 1.3rem', borderRadius: 50, fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', border: tab === t ? 'none' : '1.5px solid #e2e8f0', background: tab === t ? '#6B21A8' : '#fff', color: tab === t ? '#fff' : '#64748b', boxShadow: tab === t ? '0 4px 14px rgba(107,33,168,0.28)' : 'none', transition: 'all 0.2s' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: '#e2e8f0', marginTop: 14 }} />
      </div>

      {/* ── Tab content ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>

        {tab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <Card
                title="Donations Raised"
                sub="Monthly · PHP"
                hint="Shows whether community giving is steady enough to plan shelter staffing, meals, and counseling."
              >
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="gDon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.18}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `₱${Number(v) / 1000}K`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip {...TT} itemStyle={{ color: '#D97706' }} formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Donations']} />
                    <Area type="monotone" dataKey="donations" stroke="#D97706" strokeWidth={2.5} fill="url(#gDon)" dot={{ r: 4, fill: '#D97706', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card
                title="Average Health Score"
                sub="Monthly avg · 1–5 scale"
                hint="Resident wellness average for the month; higher reflects stronger reported wellbeing on our scale."
              >
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[2.5, 4.5]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip {...TT} itemStyle={{ color: '#0D9488' }} formatter={(v) => [String(v), 'Wellness Score']} />
                    <Line type="monotone" dataKey="healthScore" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 5, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <Card
                title="Education Progress"
                sub="Monthly avg completion %"
                hint="Average educational program completion across residents for each reporting month."
              >
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="gEduOv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6B21A8" stopOpacity={0.16}/><stop offset="95%" stopColor="#6B21A8" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 105]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...TT} itemStyle={{ color: '#6B21A8' }} formatter={(v) => [`${v}%`, 'Progress']} />
                    <Area type="monotone" dataKey="educationProgress" stroke="#6B21A8" strokeWidth={2} fill="url(#gEduOv)" dot={{ r: 4, fill: '#6B21A8', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card
                title="Health & Education Trends"
                sub="Dual-axis · score & progress"
                hint="Teal: average wellness score (1–5). Purple: average education completion (%)."
              >
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" domain={[0, 105]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#6B21A8', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                    <YAxis yAxisId="right" orientation="right" domain={[2.5, 4.5]} tick={{ fill: '#0D9488', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip {...TT} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#64748b' }} />
                    <Line yAxisId="left" type="monotone" dataKey="educationProgress" name="Education %" stroke="#6B21A8" strokeWidth={2} dot={{ r: 3, fill: '#6B21A8', strokeWidth: 0 }} />
                    <Line yAxisId="right" type="monotone" dataKey="healthScore" name="Health score" stroke="#0D9488" strokeWidth={2} dot={{ r: 3, fill: '#0D9488', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {tab === 'Donations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Card
              title="Donation trend"
              sub="Monthly revenue · PHP"
              hint="Use this to see whether giving is steady, seasonal, or spiky—so you know if we can plan long-term or need to bridge a gap."
            >
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gDon2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.18}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `₱${Number(v) / 1000}K`} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip {...TT} itemStyle={{ color: '#D97706' }} formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Donations']} />
                  <Area type="monotone" dataKey="donations" stroke="#D97706" strokeWidth={3} fill="url(#gDon2)" dot={{ r: 5, fill: '#D97706', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <StatBox label="Total Raised (chart months)" value={`₱${(totalDonationsCharts / 1000).toFixed(0)}K`} color="#D97706" bg="#fffbeb" border="#fde68a" />
              <StatBox
                label="Monthly Average"
                value={`₱${monthsOfData > 0 ? (totalDonationsCharts / monthsOfData / 1000).toFixed(0) : '0'}K`}
                color="#6B21A8"
                bg="#f5f3ff"
                border="#e9d5ff"
              />
              <StatBox
                label={bestDonationMonth ? `Best month (${bestDonationMonth.month})` : 'Best month'}
                value={bestDonationMonth ? `₱${(bestDonationMonth.donations / 1000).toFixed(0)}K` : '—'}
                color="#0D9488"
                bg="#f0fdf4"
                border="#bbf7d0"
              />
              <StatBox label="Reports Published" value={String(published.length)} color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
            </div>
          </div>
        )}

        {tab === 'Residents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <Card
                title="Health Score Trend"
                sub="Avg wellness score per month"
                hint="Monthly average on a 1–5 scale; useful for spotting dips or recovery in aggregate wellbeing."
              >
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[2.5, 4.5]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip {...TT} itemStyle={{ color: '#0D9488' }} formatter={(v) => [String(v), 'Wellness score']} />
                    <Line type="monotone" dataKey="healthScore" stroke="#0D9488" strokeWidth={3} dot={{ r: 5, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card
                title="Education Progress Trend"
                sub="Avg completion % per month"
                hint="Share of educational milestones completed on average across residents each month."
              >
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="gEduRes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6B21A8" stopOpacity={0.16}/><stop offset="95%" stopColor="#6B21A8" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 105]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...TT} itemStyle={{ color: '#6B21A8' }} formatter={(v) => [`${v}%`, 'Progress']} />
                    <Area type="monotone" dataKey="educationProgress" stroke="#6B21A8" strokeWidth={2.5} fill="url(#gEduRes)" dot={{ r: 4, fill: '#6B21A8', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {tab === 'Wellness' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Card
              title="Health Score Over Time"
              sub="Monthly average wellness score · 1–5 scale"
              hint="Same metric as the overview health line—use this tab for a single full-width view and quick stats."
            >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gHealthWell" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0D9488" stopOpacity={0.18}/><stop offset="95%" stopColor="#0D9488" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[2.5, 4.5]} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip {...TT} itemStyle={{ color: '#0D9488' }} formatter={(v) => [String(v), 'Wellness score']} />
                  <Area type="monotone" dataKey="healthScore" stroke="#0D9488" strokeWidth={3} fill="url(#gHealthWell)" dot={{ r: 5, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <StatBox label="Latest Health Score" value={chartSnapshots.length ? latestHealth.toFixed(2) : '—'} color="#0D9488" bg="#f0fdf4" border="#bbf7d0" />
              <StatBox label="Peak Education" value={`${Math.round(peakEducation)}%`} color="#6B21A8" bg="#f5f3ff" border="#e9d5ff" />
              <StatBox label="Months of Data" value={String(monthsOfData)} color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
              <StatBox label="Total Residents" value="60" color="#D97706" bg="#fffbeb" border="#fde68a" />
            </div>
          </div>
        )}

        {tab === 'Reports' && (
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#0D9488', marginBottom: '1.25rem' }}>
              Anonymized · Public · Monthly
            </p>
            {featured ? (
              <>
                <ReportCard snap={featured} featured />
                {rest.length > 0 && (
                  <>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', margin: '1.5rem 0 0.75rem' }}>Previous Reports</p>
                    {rest.map((s) => <ReportCard key={s.snapshot_id} snap={s} />)}
                  </>
                )}
              </>
            ) : (
              <p style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}>No published impact snapshots yet. Publish data from the admin pipeline to see reports here.</p>
            )}
          </div>
        )}
      </div>

      {/* ── CTA ── */}
      <section style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <span className="hw-eyebrow">Make a Difference</span>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: '#fff', margin: '0.6rem 0 0.75rem' }}>
            Your gift keeps safe homes open and healing within reach.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            Contributions fund shelter, counseling, education, and everyday care—so every girl we serve has a stable place to recover and grow.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="hw-btn-ghost-white" style={{ padding: '0.75rem 2rem', borderRadius: 50, fontWeight: 600, fontSize: '0.9rem' }}>
              Subscribe to Reports
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
