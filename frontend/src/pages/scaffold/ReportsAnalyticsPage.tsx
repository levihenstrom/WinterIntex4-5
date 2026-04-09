import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { fetchJson } from '../../lib/apiClient';
import { ErrorState, LoadingState } from '../../components/common/AsyncStatus';


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
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
}

function fmtHours(n: number) {
  if (!Number.isFinite(n)) return '—';
  const v = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${v.toLocaleString('en-PH')} hrs`;
}

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
  const [dSafehouse, setDSafehouse] = useState('');
  const [dType, setDType] = useState('');

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
    void fetchDonations(defaultFrom, defaultTo, '', '');
    // Initial load only; further refreshes use Apply or Reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyGivingFilters = () => {
    void fetchDonations(from, to, dSafehouse, dType);
  };

  const resetGivingFilters = () => {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setDSafehouse('');
    setDType('');
    void fetchDonations(defaultFrom, defaultTo, '', '');
  };

  const [outLoading, setOutLoading] = useState(true);
  const [outError, setOutError] = useState<string | null>(null);
  const [outData, setOutData] = useState<OutcomeSummary | null>(null);
  const [oSafehouse, setOSafehouse] = useState('');

  const loadOutcomes = useCallback(async () => {
    setOutLoading(true);
    setOutError(null);
    try {
      const q = buildQuery({ safehouseId: oSafehouse || undefined });
      const data = await fetchJson<OutcomeSummary>(`/api/reports/outcome-summary${q}`);
      setOutData(data);
    } catch (e) {
      setOutError(e instanceof Error ? e.message : 'Unable to load outcome data.');
      setOutData(null);
    } finally {
      setOutLoading(false);
    }
  }, [oSafehouse]);

  useEffect(() => {
    void loadOutcomes();
  }, [loadOutcomes]);

  const monthChartData = useMemo(
    () =>
      (donData?.byMonth ?? []).map((m) => ({
        name: m.periodLabel,
        amount: Number(m.totalAmount),
        gifts: m.count,
      })),
    [donData],
  );

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

        <section id="giving" style={{ marginBottom: 36 }}>
          <h2 style={sectionTitle}>Financial giving</h2>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
            Donation totals and allocations across the selected period. Adjust filters and select Apply to refresh charts.
          </p>

          <div style={{ ...card, marginBottom: 20 }} className="no-print-reports">
            <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>Giving filters</div>
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
                  value={dSafehouse}
                  onChange={(e) => setDSafehouse(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', minWidth: 180 }}
                >
                  <option value="">All in scope</option>
                  {(donData?.filterOptions.safehouses ?? []).map((s) => (
                    <option key={s.safehouseId} value={String(s.safehouseId)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748B' }}>
                Contribution type
                <select
                  value={dType}
                  onChange={(e) => setDType(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', minWidth: 160 }}
                >
                  <option value="">All types</option>
                  {(donData?.filterOptions.donationTypes ?? []).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={applyGivingFilters}
                style={{
                  background: '#0D9488',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
              <button
                type="button"
                onClick={resetGivingFilters}
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
                Reset
              </button>
            </div>
          </div>

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
                <KPI label="Total value (PHP)" value={fmtMoney(Number(donData.grandTotal))} sub="Cash & in-kind; volunteer hours below" accent="#0D9488" />
                <KPI label="Period buckets" value={String(donData.byMonth.length)} sub="Months in chart" accent="#7C3AED" />
              </div>

              <div style={{ ...card, marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 17, color: '#1E3A5F', marginBottom: 16 }}>Giving over time</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={monthChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v: any) => fmtMoney(Number(v))} width={88} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => fmtMoney(Number(v ?? 0))} labelStyle={{ color: '#334155' }} />
                      <Line type="monotone" dataKey="amount" name="Amount" stroke="#0D9488" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <p style={{ color: '#64748B', fontSize: 13, marginBottom: 14, maxWidth: 720 }}>
                Financial charts use peso value (cash and in-kind estimates). Volunteer time uses recorded hours only—never combined with money on the same axis.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div style={card}>
                  <h3 style={{ fontSize: 15, color: '#1E3A5F', marginBottom: 4 }}>Financial value by contribution type</h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>PHP (cash & in-kind)</p>
                  {donData.byDonationTypeFinancial.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={donData.byDonationTypeFinancial.map((x) => ({ name: x.name, amount: Number(x.amount) }))}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis type="number" tickFormatter={(v: any) => fmtMoney(Number(v))} />
                          <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => fmtMoney(Number(v ?? 0))} />
                          <Bar dataKey="amount" name="PHP" radius={[0, 4, 4, 0]}>
                            {donData.byDonationTypeFinancial.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 13, minHeight: 200, display: 'flex', alignItems: 'center' }}>
                      No financial contributions in this period for the selected filters.
                    </p>
                  )}
                </div>
                <div style={card}>
                  <h3 style={{ fontSize: 15, color: '#1E3A5F', marginBottom: 4 }}>Financial value by donor segment</h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>PHP (cash & in-kind)</p>
                  {donData.bySupporterTypeFinancial.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={donData.bySupporterTypeFinancial.map((x) => ({ name: x.name, amount: Number(x.amount) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={64} />
                          <YAxis tickFormatter={(v: any) => fmtMoney(Number(v))} width={72} />
                          <Tooltip formatter={(v: any) => fmtMoney(Number(v ?? 0))} />
                          <Bar dataKey="amount" fill="#1E3A5F" name="PHP" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 13, minHeight: 200, display: 'flex', alignItems: 'center' }}>
                      No financial contributions in this period for the selected filters.
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div style={card}>
                  <h3 style={{ fontSize: 15, color: '#1E3A5F', marginBottom: 4 }}>Volunteer time by contribution type</h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Hours (Time / Skills)</p>
                  {donData.byDonationTypeVolunteerHours.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={donData.byDonationTypeVolunteerHours.map((x) => ({ name: x.name, hours: Number(x.amount) }))}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis type="number" tickFormatter={(v: any) => fmtHours(Number(v))} />
                          <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => fmtHours(Number(v ?? 0))} />
                          <Bar dataKey="hours" name="Hours" radius={[0, 4, 4, 0]}>
                            {donData.byDonationTypeVolunteerHours.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 13, minHeight: 200, display: 'flex', alignItems: 'center' }}>
                      No volunteer hours recorded for this period (or scope filters out time/skills gifts).
                    </p>
                  )}
                </div>
                <div style={card}>
                  <h3 style={{ fontSize: 15, color: '#1E3A5F', marginBottom: 4 }}>Volunteer time by donor segment</h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10 }}>Hours (Time / Skills)</p>
                  {donData.bySupporterTypeVolunteerHours.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={donData.bySupporterTypeVolunteerHours.map((x) => ({ name: x.name, hours: Number(x.amount) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={64} />
                          <YAxis tickFormatter={(v: any) => fmtHours(Number(v))} width={76} />
                          <Tooltip formatter={(v: any) => fmtHours(Number(v ?? 0))} />
                          <Bar dataKey="hours" fill="#059669" name="Hours" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p style={{ color: '#94A3B8', fontSize: 13, minHeight: 200, display: 'flex', alignItems: 'center' }}>
                      No volunteer hours recorded for this period (or scope filters out time/skills gifts).
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
                        <YAxis tickFormatter={(v: any) => fmtMoney(Number(v))} width={80} />
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
                        <YAxis tickFormatter={(v: any) => fmtMoney(Number(v))} width={80} />
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

          <div style={{ ...card, marginBottom: 20 }} className="no-print-reports">
            <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>Outcome scope</div>
            <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748B' }}>
              Limit to safehouse
              <select
                value={oSafehouse}
                onChange={(e) => setOSafehouse(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', minWidth: 220 }}
              >
                <option value="">All sites in scope</option>
                {(outData?.filterOptions.safehouses ?? []).map((s) => (
                  <option key={s.safehouseId} value={String(s.safehouseId)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
            </>
          )}
        </section>
      </div>
    </div>
  );
}
