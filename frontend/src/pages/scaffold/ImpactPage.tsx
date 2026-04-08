import { useState, useEffect, useRef } from 'react';
import { fetchJson } from '../../lib/apiClient';
import 'bootstrap-icons/font/bootstrap-icons.css';
import NavBar from '../../components/hw/NavBar';
import MetricCard from '../../components/hw/MetricCard';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  LineChart, Line, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

/* ── Types ───────────────────────────────────────────────────── */
interface MetricPayload {
  residents_served: number;
  new_admissions: number;
  successful_reintegrations: number;
  reintegration_rate_pct: number;
  active_volunteers: number;
  volunteer_hours: number;
  programs_completed: number;
  donations_received_usd: number;
  safehouses_active: number;
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
const parse = (j: string): MetricPayload => { try { return JSON.parse(j); } catch { return {} as MetricPayload; } };
const fmtMonth = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

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
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className="hw-fade-in" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 16px rgba(30,58,95,0.07)', padding: '1.4rem 1.5rem' }}>
      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: '#1E3A5F', fontSize: '0.9rem', margin: '0 0 2px' }}>{title}</p>
      {sub && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 1rem' }}>{sub}</p>}
      {!sub && <div style={{ marginBottom: '1rem' }} />}
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
  const p = parse(snap.metric_payload_json);
  const ref = useFadeIn();

  const pills = [
    { label: 'Residents', value: p.residents_served?.toLocaleString(), color: '#6B21A8', bg: '#f5f3ff', border: '#e9d5ff' },
    { label: 'Reint. Rate', value: `${p.reintegration_rate_pct}%`, color: '#0D9488', bg: '#f0fdf4', border: '#bbf7d0' },
    { label: 'Vol. Hours', value: p.volunteer_hours?.toLocaleString(), color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Donations', value: `$${(p.donations_received_usd / 1000).toFixed(0)}K`, color: '#D97706', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Programs', value: String(p.programs_completed), color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
    { label: 'Safehouses', value: String(p.safehouses_active), color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
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
const TABS = ['Overview', 'Donations', 'Residents', 'Volunteers', 'Reports'] as const;
type Tab = typeof TABS[number];

/* ── Page ────────────────────────────────────────────────────── */
export default function ImpactPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [snapshots, setSnapshots] = useState<ImpactSnapshot[]>([]);
  const [impactLoadError, setImpactLoadError] = useState<string | null>(null);

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

  const published = snapshots
    .filter((s) => s.is_published)
    .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());
  const featured = published[0];
  const rest = published.slice(1);

  const chartData = [...published].reverse().map((s) => {
    const p = parse(s.metric_payload_json);
    return {
      month: fmtShort(s.snapshot_date),
      donations: p.donations_received_usd,
      residents: p.residents_served,
      reintegrationRate: p.reintegration_rate_pct,
      volunteerHours: p.volunteer_hours,
      programs: p.programs_completed,
      newAdmissions: p.new_admissions,
      reintegrations: p.successful_reintegrations,
      volunteers: p.active_volunteers,
    };
  });

  const radialColors = ['#6B21A8', '#7C3AED', '#0D9488', '#D97706', '#34d399', '#60a5fa'];
  const radialData = [...published].reverse().map((s, i) => ({
    name: fmtShort(s.snapshot_date),
    value: parse(s.metric_payload_json).successful_reintegrations,
    fill: radialColors[i % radialColors.length],
  }));

  const maxResidents =
    published.length > 0
      ? Math.max(...published.map((s) => parse(s.metric_payload_json).residents_served ?? 0))
      : 0;
  const totalReint = published.reduce((n, s) => n + (parse(s.metric_payload_json).successful_reintegrations ?? 0), 0);
  const totalHours = published.reduce((n, s) => n + (parse(s.metric_payload_json).volunteer_hours ?? 0), 0);
  const totalDonations = published.reduce((n, s) => n + (parse(s.metric_payload_json).donations_received_usd ?? 0), 0);

  return (
    <div style={{ fontFamily: 'var(--hw-font-body)', minHeight: '100vh', background: '#f8fafc' }}>
      <NavBar />

      {impactLoadError && (
        <div className="container-xl py-3" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="alert alert-warning mb-0 py-2 small" role="alert">{impactLoadError}</div>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)', paddingTop: '7rem', paddingBottom: '5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <span className="hw-eyebrow">Public Impact Dashboard</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: '#fff', margin: '0.5rem 0 0.75rem', lineHeight: 1.1 }}>
            Our Impact
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.05rem', maxWidth: 520, lineHeight: 1.65, margin: '0 0 1.5rem' }}>
            Monthly anonymized aggregate reports for our community, donors, and partners. Every number represents a life changed.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, padding: '0.75rem 1rem', maxWidth: 560 }}>
            <svg width="15" height="15" fill="none" stroke="#5eead4" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.62)', margin: 0, lineHeight: 1.6 }}>
              These reports contain <strong style={{ color: '#5eead4' }}>anonymized, aggregated</strong> data intended for public-facing dashboards and donor communications. No personally identifiable information is included.
            </p>
          </div>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ marginTop: -44, background: 'rgba(30,58,95,0.92)', backdropFilter: 'blur(14px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 20px 60px rgba(30,58,95,0.28)', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { target: maxResidents, suffix: '+', label: 'Residents Served' },
              { target: totalReint,   suffix: '',  label: 'Reintegrations' },
              { target: Math.round(totalHours / 1000),    suffix: 'K', label: 'Volunteer Hours' },
              { target: Math.round(totalDonations / 1000), prefix: '$', suffix: 'K', label: 'Donations Raised' },
            ].map((kpi, i) => (
              <div key={kpi.label} style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <MetricCard target={kpi.target} suffix={kpi.suffix} prefix={kpi.prefix} label={kpi.label} />
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
              <Card title="Donations Raised" sub="Monthly · USD">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="gDon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.18}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: any) => `$${v/1000}K`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
                    <Tooltip {...TT} itemStyle={{ color: '#D97706' }} formatter={(v: any) => [`$${v.toLocaleString()}`, 'Donations']} />
                    <Area type="monotone" dataKey="donations" stroke="#D97706" strokeWidth={2.5} fill="url(#gDon)" dot={{ r: 4, fill: '#D97706', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Residents Served" sub="Monthly count">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartData} barSize={26} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip {...TT} itemStyle={{ color: '#6B21A8' }} formatter={(v: any) => [v, 'Residents']} />
                    <Bar dataKey="residents" fill="#6B21A8" radius={[5, 5, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <Card title="Reintegration Rate" sub="Success % per month">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[80, 92]} tickFormatter={(v: any) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...TT} itemStyle={{ color: '#0D9488' }} formatter={(v: any) => [`${v}%`, 'Rate']} />
                    <Line type="monotone" dataKey="reintegrationRate" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 5, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Admissions vs. Reintegrations" sub="Inflow · Outflow">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gAdm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6B21A8" stopOpacity={0.13}/><stop offset="95%" stopColor="#6B21A8" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gRi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0D9488" stopOpacity={0.13}/><stop offset="95%" stopColor="#0D9488" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip {...TT} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#64748b' }} />
                    <Area type="monotone" dataKey="newAdmissions" name="New Admissions" stroke="#6B21A8" strokeWidth={2} fill="url(#gAdm)" dot={{ r: 3, fill: '#6B21A8', strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="reintegrations" name="Reintegrations" stroke="#0D9488" strokeWidth={2} fill="url(#gRi)" dot={{ r: 3, fill: '#0D9488', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {tab === 'Donations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Card title="Donation Trend" sub="Monthly revenue · USD">
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gDon2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.18}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: any) => `$${v/1000}K`} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip {...TT} itemStyle={{ color: '#D97706' }} formatter={(v: any) => [`$${v.toLocaleString()}`, 'Donations']} />
                  <Area type="monotone" dataKey="donations" stroke="#D97706" strokeWidth={3} fill="url(#gDon2)" dot={{ r: 5, fill: '#D97706', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <StatBox label="Total Raised (6 mo)" value={`$${(totalDonations/1000).toFixed(0)}K`} color="#D97706" bg="#fffbeb" border="#fde68a" />
              <StatBox label="Monthly Average"     value={`$${published.length > 0 ? (totalDonations / published.length / 1000).toFixed(0) : '0'}K`} color="#6B21A8" bg="#f5f3ff" border="#e9d5ff" />
              <StatBox label="Best Month"          value="$94K" color="#0D9488" bg="#f0fdf4" border="#bbf7d0" />
              <StatBox label="Reports Published"   value={String(published.length)} color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
            </div>
          </div>
        )}

        {tab === 'Residents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <Card title="Residents Served" sub="Monthly · active residents">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} barSize={28} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip {...TT} itemStyle={{ color: '#6B21A8' }} formatter={(v: any) => [v, 'Residents']} />
                    <Bar dataKey="residents" fill="#6B21A8" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Reintegration Rate %" sub="Monthly success rate">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[80, 92]} tickFormatter={(v: any) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...TT} itemStyle={{ color: '#0D9488' }} formatter={(v: any) => [`${v}%`, 'Rate']} />
                    <Line type="monotone" dataKey="reintegrationRate" stroke="#0D9488" strokeWidth={3} dot={{ r: 5, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <Card title="Reintegrations per Month" sub="Absolute count — radial view">
              <ResponsiveContainer width="100%" height={250}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="18%" outerRadius="88%" data={radialData} startAngle={180} endAngle={-180}>
                  <RadialBar dataKey="value" cornerRadius={6} label={false} />
                  <Tooltip contentStyle={TT.contentStyle} formatter={(v: any) => [v, 'Reintegrations']} />
                  <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.9' }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {tab === 'Volunteers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Card title="Volunteer Hours" sub="Monthly total hours contributed">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15}/><stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: any) => `${(v/1000).toFixed(0)}K`} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip {...TT} itemStyle={{ color: '#7C3AED' }} formatter={(v: any) => [v.toLocaleString(), 'Hours']} />
                  <Area type="monotone" dataKey="volunteerHours" stroke="#7C3AED" strokeWidth={3} fill="url(#gVol)" dot={{ r: 5, fill: '#7C3AED', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <Card title="Active Volunteers" sub="Monthly count">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartData} barSize={24} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                    <Tooltip {...TT} itemStyle={{ color: '#0D9488' }} formatter={(v: any) => [v.toLocaleString(), 'Volunteers']} />
                    <Bar dataKey="volunteers" fill="#0D9488" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Programs Completed" sub="Monthly">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartData} barSize={24} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip {...TT} itemStyle={{ color: '#D97706' }} formatter={(v: any) => [v, 'Programs']} />
                    <Bar dataKey="programs" fill="#D97706" radius={[5, 5, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
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
            Your donation creates the next data point.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            100% of contributions go directly to safehouse operations, programming, and resident support.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/#donate" className="hw-btn-magenta" style={{ padding: '0.75rem 2rem', borderRadius: 50, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', display: 'inline-block' }}>
              Donate Now →
            </a>
            <button className="hw-btn-ghost-white" style={{ padding: '0.75rem 2rem', borderRadius: 50, fontWeight: 600, fontSize: '0.9rem' }}>
              Subscribe to Reports
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
