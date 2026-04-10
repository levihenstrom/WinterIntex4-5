import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { fetchJson } from '../../lib/apiClient';
import { ErrorState, LoadingState } from '../../components/common/AsyncStatus';
import { formatAmountMaybePhpAndUsd, formatUsdThousandsFromPhp } from '../../lib/currency';


const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  padding: '22px 24px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 2px 12px rgba(30,58,95,0.06)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 20,
  fontWeight: 700,
  color: '#1E3A5F',
  marginBottom: 6,
  marginTop: 0,
};

const CHART_COLORS = ['#0D9488', '#1E3A5F', '#7C3AED', '#D97706', '#DC2626', '#2563EB', '#059669'];

function buildQuery(params: Record<string, string | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

function fmtMoney(n: number) {
  return formatAmountMaybePhpAndUsd(n, 'PHP');
}

function fmtMoneyChart(n: number) {
  return formatUsdThousandsFromPhp(n);
}

/* ── Impact-snapshot helpers (mirrored from ImpactPage) ─────── */

interface ApiImpactSnapshot {
  snapshotId: number;
  snapshotDate?: string | null;
  metricPayloadJson?: string | null;
  isPublished?: boolean | null;
}

interface MetricPayload {
  total_residents: number;
  donations_total_for_month: number;
  avg_health_score: number;
  avg_education_progress: number;
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseMetricPayload(raw: string): MetricPayload {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    try { parsed = JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>; } catch { parsed = {}; }
  }
  return {
    total_residents: asNum(parsed.total_residents ?? parsed.residents_served),
    donations_total_for_month: asNum(parsed.donations_total_for_month ?? parsed.donations_received_usd ?? parsed.donations_total),
    avg_health_score: asNum(parsed.avg_health_score),
    avg_education_progress: asNum(parsed.avg_education_progress),
  };
}

const fmtShortMonth = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

const CHART_SNAPSHOT_LAST_INCLUSIVE = '2026-02-15';

function snapshotIncludedInCharts(d: string): boolean {
  return Boolean(d && d <= CHART_SNAPSHOT_LAST_INCLUSIVE);
}

const impactTT = {
  contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontFamily: 'Inter, sans-serif', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
  labelStyle: { color: '#1E3A5F', fontWeight: 700 as const },
};

interface NamedAmount {
  name: string;
  amount: number;
  count: number;
}

interface TimePoint {
  periodLabel: string;
  totalAmount: number;
  count: number;
}

interface SafehouseAmt {
  safehouseId: number;
  safehouseName: string;
  amount: number;
  allocationCount: number;
}

interface SafehouseOpt {
  safehouseId: number;
  name: string;
}

interface DonationTrends {
  grandTotal: number;
  donationCount: number;
  byMonth: TimePoint[];
  byDonationTypeFinancial: NamedAmount[];
  byDonationTypeVolunteerHours: NamedAmount[];
  bySupporterTypeFinancial: NamedAmount[];
  bySupporterTypeVolunteerHours: NamedAmount[];
  byProgramArea: NamedAmount[];
  bySafehouse: SafehouseAmt[];
  filterOptions: { safehouses: SafehouseOpt[]; donationTypes: string[] };
}

interface NamedCount {
  name: string;
  count: number;
}

interface DomainServices {
  label: string;
  serviceUnits: number;
  detail: string;
}

interface SafehouseOutcomeRow {
  safehouseId: number;
  safehouseName: string;
  residentCount: number;
  reintegrationCompleted: number;
  reintegrationAttempted: number;
  reintegrationSuccessRate: number | null;
  avgEducationProgressPercent: number | null;
  avgHealthScore: number | null;
}

interface OutcomeSummary {
  totalResidents: number;
  activeCases: number;
  closedCases: number;
  reintegrationAttempted: number;
  reintegrationCompleted: number;
  reintegrationSuccessRate: number | null;
  education: {
    educationRecordCount: number;
    avgProgressPercent: number | null;
    enrollmentBreakdown: NamedCount[];
  };
  health: {
    healthRecordCount: number;
    avgGeneralHealthScore: number | null;
    medicalCheckupRate: number | null;
    dentalCheckupRate: number | null;
  };
  annualAccomplishment: {
    caring: DomainServices;
    healing: DomainServices;
    teaching: DomainServices;
  };
  safehouseRows: SafehouseOutcomeRow[];
  filterOptions: { safehouses: SafehouseOpt[]; donationTypes: string[] };
}

function KPI({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: `${accent}10`,
        borderRadius: 12,
        padding: '14px 16px',
        border: `1px solid ${accent}30`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#1E293B' }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export default function ReportsAnalyticsPage() {
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const defaultTo = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [safehouseId, setSafehouseId] = useState('');
  const [donationType, setDonationType] = useState('');

  const [donLoading, setDonLoading] = useState(true);
  const [donError, setDonError] = useState<string | null>(null);
  const [donData, setDonData] = useState<DonationTrends | null>(null);

  const fetchDonations = useCallback(
    async (f: string, t: string, sh: string, typ: string) => {
      setDonLoading(true);
      setDonError(null);
      try {
        const q = buildQuery({
          from: f || undefined,
          to: t || undefined,
          safehouseId: sh || undefined,
          donationType: typ || undefined,
        });
        const data = await fetchJson<DonationTrends>(`/api/reports/donation-trends${q}`);
        setDonData(data);
      } catch (e) {
        setDonError(e instanceof Error ? e.message : 'Unable to load giving data.');
        setDonData(null);
      } finally {
        setDonLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchDonations(from, to, safehouseId, donationType);
  }, [fetchDonations, from, to, safehouseId, donationType]);

  const [outLoading, setOutLoading] = useState(true);
  const [outError, setOutError] = useState<string | null>(null);
  const [outData, setOutData] = useState<OutcomeSummary | null>(null);
  const loadOutcomes = useCallback(async (selectedSafehouseId: string) => {
    setOutLoading(true);
    setOutError(null);
    try {
      const q = buildQuery({ safehouseId: selectedSafehouseId || undefined });
      const data = await fetchJson<OutcomeSummary>(`/api/reports/outcome-summary${q}`);
      setOutData(data);
    } catch (e) {
      setOutError(e instanceof Error ? e.message : 'Unable to load outcome data.');
      setOutData(null);
    } finally {
      setOutLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOutcomes(safehouseId);
  }, [loadOutcomes, safehouseId]);

  const safehouseOptions = useMemo(() => {
    const merged = new Map<number, string>();
    for (const s of donData?.filterOptions.safehouses ?? []) merged.set(s.safehouseId, s.name);
    for (const s of outData?.filterOptions.safehouses ?? []) merged.set(s.safehouseId, s.name);
    return Array.from(merged.entries())
      .map(([id, name]) => ({ safehouseId: id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [donData?.filterOptions.safehouses, outData?.filterOptions.safehouses]);

  const donationTypeOptions = useMemo(() => {
    const merged = new Set<string>(donData?.filterOptions.donationTypes ?? []);
    for (const t of outData?.filterOptions.donationTypes ?? []) merged.add(t);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [donData?.filterOptions.donationTypes, outData?.filterOptions.donationTypes]);

  function resetGlobalFilters() {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setSafehouseId('');
    setDonationType('');
  }

  const monthChartData = useMemo(
    () =>
      (donData?.byMonth ?? []).map((m) => ({
        name: m.periodLabel,
        amount: Number(m.totalAmount),
        gifts: m.count,
      })),
    [donData],
  );

  /** Share of total USD by contribution type — for pie chart. */
  const financialMixPie = useMemo(() => {
    const rows = donData?.byDonationTypeFinancial ?? [];
    const total = rows.reduce((s, x) => s + Number(x.amount), 0);
    if (total <= 0) return [];
    return rows.map((x) => ({
      name: x.name,
      value: Number(x.amount),
    }));
  }, [donData]);

  const [impactChartData, setImpactChartData] = useState<
    { month: string; donations: number; healthScore: number; educationProgress: number }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchJson<ApiImpactSnapshot[]>('/api/public-impact/snapshots');
        if (cancelled) return;
        const published = rows
          .filter((s) => s.isPublished)
          .sort((a, b) => new Date(b.snapshotDate ?? '').getTime() - new Date(a.snapshotDate ?? '').getTime());
        const valid = [...published].reverse().filter((s) => {
          const p = parseMetricPayload(s.metricPayloadJson ?? '{}');
          return p.avg_health_score > 0 || p.donations_total_for_month > 0;
        });
        const charted = valid.filter((s) => snapshotIncludedInCharts(s.snapshotDate ? new Date(s.snapshotDate).toISOString().slice(0, 10) : ''));
        setImpactChartData(
          charted.map((s) => {
            const d = s.snapshotDate ? new Date(s.snapshotDate).toISOString().slice(0, 10) : '';
            const p = parseMetricPayload(s.metricPayloadJson ?? '{}');
            return { month: fmtShortMonth(d), donations: p.donations_total_for_month, healthScore: p.avg_health_score, educationProgress: p.avg_education_progress };
          }),
        );
      } catch { /* non-critical — charts simply stay empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadingAny = donLoading || outLoading;

  return (
    <div className="py-4 reports-analytics-print-root" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <style>{`
        @media print {
          .no-print-reports { display: none !important; }
          .reports-analytics-print-root { background: #fff !important; padding: 12px 0 !important; }
        }
      `}</style>

      <div className="container-xl">
        <header className="mb-5 border-bottom pb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderColor: '#E2E8F0' }}>
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
              Reports &amp; Analytics
            </h1>
            <p className="text-muted mb-0" style={{ fontSize: 14, maxWidth: 640 }}>
              Aggregated insights and trends for decision-making: giving over time, beneficiary and program outcomes, site-level
              performance, and reintegration results—organized alongside annual accomplishment themes (caring, healing, teaching)
              used in Philippine social welfare reporting.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print-reports"
            aria-label="Print this page"
            style={{
              background: '#fff',
              color: '#1E3A5F',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Print
          </button>
        </header>

        {loadingAny && !donData && !outData ? <LoadingState message="Loading reports and analytics…" /> : null}

        <div style={{ ...card, marginBottom: 22 }} className="no-print-reports">
          <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>Global report filters</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748B' }}>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748B' }}>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748B' }}>
              Safehouse
              <select
                value={safehouseId}
                onChange={(e) => setSafehouseId(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', minWidth: 200, width: '100%' }}
              >
                <option value="">All in scope</option>
                {safehouseOptions.map((s) => (
                  <option key={s.safehouseId} value={String(s.safehouseId)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748B' }}>
              Contribution type
              <select
                value={donationType}
                onChange={(e) => setDonationType(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', minWidth: 170, width: '100%' }}
              >
                <option value="">All types</option>
                {donationTypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={resetGlobalFilters}
              style={{
                background: '#fff',
                color: '#475569',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                padding: '10px 18px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset filters
            </button>
          </div>
        </div>

        <section id="giving" style={{ marginBottom: 36 }}>
          <h2 style={sectionTitle}>Financial giving</h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
            Donation totals and allocations across the selected period. Global filters refresh all report sections instantly.
          </p>

          {donLoading && donData && <LoadingState message="Refreshing giving charts…" size="compact" />}
          {donError && <ErrorState message={donError} />}

          {donData && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <KPI label="Gifts (current filters)" value={String(donData.donationCount)} accent="#1E3A5F" />
                <KPI label="Total value (USD)" value={fmtMoney(Number(donData.grandTotal))} sub="Cash & in-kind in scope" accent="#0D9488" />
                <KPI label="Avg. gift value" value={donData.donationCount > 0 ? fmtMoney(Number(donData.grandTotal) / donData.donationCount) : '—'} sub="USD per gift" accent="#7C3AED" />
              </div>

              <p style={{ color: '#64748B', fontSize: 13, marginBottom: 14, maxWidth: 720 }}>
                Four views: monthly value and gift volume, where contributions come from by type, then how allocations flow to programs and sites.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div style={card}>
                  <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 17, color: '#1E3A5F', marginBottom: 4 }}>
                    Monthly value &amp; gift volume
                  </h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                    Bars = USD value per month; line = number of gifts (same filters).
                  </p>
                  {monthChartData.length > 0 ? (
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer>
                        <ComposedChart data={monthChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis
                            yAxisId="usd"
                            tickFormatter={(v: any) => fmtMoneyChart(Number(v))}
                            width={82}
                            tick={{ fontSize: 10 }}
                            label={{ value: 'USD', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }}
                          />
                          <YAxis
                            yAxisId="gifts"
                            orientation="right"
                            allowDecimals={false}
                            width={44}
                            tick={{ fontSize: 10 }}
                            label={{ value: 'Gifts', angle: 90, position: 'insideRight', fill: '#64748B', fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => {
                              const n = String(name ?? '');
                              if (n === 'USD value' || n === 'amount') {
                                return [fmtMoney(Number(value)), 'USD value'] as [string, string];
                              }
                              return [String(value ?? ''), n || 'Gifts'] as [string, string];
                            }}
                            labelStyle={{ color: '#334155' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar yAxisId="usd" dataKey="amount" name="USD value" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={48} />
                          <Line
                            yAxisId="gifts"
                            type="monotone"
                            dataKey="gifts"
                            name="Gifts"
                            stroke="#1E3A5F"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 13, minHeight: 200 }}>No monthly data for the selected filters.</p>
                  )}
                </div>

                <div style={card}>
                  <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 17, color: '#1E3A5F', marginBottom: 4 }}>
                    Financial mix by contribution type
                  </h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Share of total USD in scope (cash &amp; in-kind).</p>
                  {financialMixPie.length > 0 ? (
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={financialMixPie}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={100}
                            paddingAngle={2}
                            labelLine={{ stroke: '#94A3B8' }}
                            label={({ name, percent }) =>
                              `${name} ${percent != null ? `${(percent * 100).toFixed(0)}%` : ''}`
                            }
                          >
                            {financialMixPie.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => fmtMoney(Number(v ?? 0))} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 13, minHeight: 200, display: 'flex', alignItems: 'center' }}>
                      No financial contributions in this period for the selected filters.
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                <div style={card}>
                  <h3 style={{ fontSize: 15, color: '#1E3A5F', marginBottom: 12 }}>Allocations by program area</h3>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={donData.byProgramArea.map((x) => ({ name: x.name, amount: Number(x.amount) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v: any) => fmtMoneyChart(Number(v))} width={80} />
                        <Tooltip formatter={(v: any) => fmtMoney(Number(v ?? 0))} />
                        <Bar dataKey="amount" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={card}>
                  <h3 style={{ fontSize: 15, color: '#1E3A5F', marginBottom: 12 }}>Funds allocated to sites</h3>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={donData.bySafehouse.map((x) => ({ name: x.safehouseName, amount: Number(x.amount) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={72} tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v: any) => fmtMoneyChart(Number(v))} width={80} />
                        <Tooltip formatter={(v: any) => fmtMoney(Number(v ?? 0))} />
                        <Bar dataKey="amount" fill="#D97706" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section id="services" style={{ marginBottom: 36 }}>
          <h2 style={sectionTitle}>Services delivered</h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
            Volume of documented services grouped as caring (psychosocial and field contact), healing (health), and teaching
            (education)—consistent with annual accomplishment reporting.
          </p>

          {outLoading && <LoadingState message="Updating services and outcomes…" size="compact" />}
          {outError && <ErrorState message={outError} />}

          {outData && !outLoading && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 28 }}>
                <div style={{ ...card, borderTop: '4px solid #0D9488' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', marginBottom: 6 }}>Caring</div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>{outData.annualAccomplishment.caring.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1E293B' }}>{outData.annualAccomplishment.caring.serviceUnits.toLocaleString()} service units</div>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>{outData.annualAccomplishment.caring.detail}</p>
                </div>
                <div style={{ ...card, borderTop: '4px solid #7C3AED' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 6 }}>Healing</div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>{outData.annualAccomplishment.healing.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1E293B' }}>{outData.annualAccomplishment.healing.serviceUnits.toLocaleString()} health records</div>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>{outData.annualAccomplishment.healing.detail}</p>
                </div>
                <div style={{ ...card, borderTop: '4px solid #D97706' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', marginBottom: 6 }}>Teaching</div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>{outData.annualAccomplishment.teaching.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1E293B' }}>{outData.annualAccomplishment.teaching.serviceUnits.toLocaleString()} education updates</div>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>{outData.annualAccomplishment.teaching.detail}</p>
                </div>
              </div>

              <h2 style={{ ...sectionTitle, fontSize: 18, marginTop: 8 }} id="beneficiaries">
                Beneficiaries &amp; program outcomes
              </h2>
              <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16 }}>Case counts and reintegration results for the selected scope.</p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 14,
                  marginBottom: 24,
                }}
              >
                <KPI label="Residents" value={String(outData.totalResidents)} accent="#1E3A5F" />
                <KPI label="Active cases" value={String(outData.activeCases)} accent="#0D9488" />
                <KPI label="Closed cases" value={String(outData.closedCases)} accent="#64748B" />
                <KPI
                  label="Reintegration success rate"
                  value={outData.reintegrationSuccessRate != null ? `${outData.reintegrationSuccessRate}%` : '—'}
                  sub={
                    outData.reintegrationAttempted > 0
                      ? `${outData.reintegrationCompleted} completed of ${outData.reintegrationAttempted} with a documented status`
                      : undefined
                  }
                  accent="#7C3AED"
                />
              </div>

              <h2 style={{ ...sectionTitle, fontSize: 18 }} id="sites">
                Site performance
              </h2>
              <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16 }}>
                Side-by-side view of census, reintegration, learning progress, and health scores by safehouse.
              </p>

              <div style={card}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                        <th style={{ padding: '10px 8px' }}>Site</th>
                        <th style={{ padding: '10px 8px' }}>Residents</th>
                        <th style={{ padding: '10px 8px' }}>Reintegration success</th>
                        <th style={{ padding: '10px 8px' }}>Avg. learning progress</th>
                        <th style={{ padding: '10px 8px' }}>Avg. health score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outData.safehouseRows.map((row) => (
                        <tr key={row.safehouseId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#1E293B' }}>{row.safehouseName}</td>
                          <td style={{ padding: '10px 8px' }}>{row.residentCount}</td>
                          <td style={{ padding: '10px 8px' }}>{row.reintegrationSuccessRate != null ? `${row.reintegrationSuccessRate}%` : '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{row.avgEducationProgressPercent != null ? `${row.avgEducationProgressPercent}%` : '—'}</td>
                          <td style={{ padding: '10px 8px' }}>{row.avgHealthScore ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {impactChartData.length > 0 && (
                <>
                  <h2 style={{ ...sectionTitle, fontSize: 18, marginTop: 28 }} id="resident-trends">
                    Resident health &amp; education trends
                  </h2>
                  <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
                    Monthly snapshot trends for donations, wellness scores, and education progress across all residents.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
                    <div style={card}>
                      <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, color: '#1E3A5F', marginBottom: 2 }}>Donations Raised</h3>
                      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Monthly &middot; USD</p>
                      <ResponsiveContainer width="100%" height={210}>
                        <AreaChart data={impactChartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="gDonR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D97706" stopOpacity={0.18}/><stop offset="95%" stopColor="#D97706" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={(v) => formatUsdThousandsFromPhp(Number(v), 1)} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                          <Tooltip {...impactTT} itemStyle={{ color: '#D97706' }} formatter={(v) => [formatAmountMaybePhpAndUsd(Number(v), 'PHP'), 'Donations']} />
                          <Area type="monotone" dataKey="donations" stroke="#D97706" strokeWidth={2.5} fill="url(#gDonR)" dot={{ r: 4, fill: '#D97706', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={card}>
                      <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, color: '#1E3A5F', marginBottom: 2 }}>Average Health Score</h3>
                      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Monthly avg &middot; 1&ndash;5 scale</p>
                      <ResponsiveContainer width="100%" height={210}>
                        <LineChart data={impactChartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[2.5, 4.5]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                          <Tooltip {...impactTT} itemStyle={{ color: '#0D9488' }} formatter={(v) => [String(v), 'Wellness Score']} />
                          <Line type="monotone" dataKey="healthScore" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 5, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                    <div style={card}>
                      <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, color: '#1E3A5F', marginBottom: 2 }}>Education Progress</h3>
                      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Monthly avg completion %</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={impactChartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="gEduR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6B21A8" stopOpacity={0.16}/><stop offset="95%" stopColor="#6B21A8" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 105]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                          <Tooltip {...impactTT} itemStyle={{ color: '#6B21A8' }} formatter={(v) => [`${v}%`, 'Progress']} />
                          <Area type="monotone" dataKey="educationProgress" stroke="#6B21A8" strokeWidth={2} fill="url(#gEduR)" dot={{ r: 4, fill: '#6B21A8', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={card}>
                      <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, color: '#1E3A5F', marginBottom: 2 }}>Health &amp; Education Trends</h3>
                      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Dual-axis &middot; score &amp; progress</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={impactChartData} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="left" domain={[0, 105]} tickFormatter={(v) => `${v}%`} tick={{ fill: '#6B21A8', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                          <YAxis yAxisId="right" orientation="right" domain={[2.5, 4.5]} tick={{ fill: '#0D9488', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                          <Tooltip {...impactTT} />
                          <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#64748b' }} />
                          <Line yAxisId="left" type="monotone" dataKey="educationProgress" name="Education %" stroke="#6B21A8" strokeWidth={2} dot={{ r: 3, fill: '#6B21A8', strokeWidth: 0 }} />
                          <Line yAxisId="right" type="monotone" dataKey="healthScore" name="Health score" stroke="#0D9488" strokeWidth={2} dot={{ r: 3, fill: '#0D9488', strokeWidth: 0 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
