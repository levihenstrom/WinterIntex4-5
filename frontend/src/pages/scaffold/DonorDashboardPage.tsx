import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { fetchPaged } from '../../lib/apiClient';
import NavBar from '../../components/hw/NavBar';
import MetricCard from '../../components/hw/MetricCard';
import SectionContainer from '../../components/hw/SectionContainer';
import 'bootstrap-icons/font/bootstrap-icons.css';

/* ── Types ───────────────────────────────────────────────────── */
interface DonationAllocationApi {
  programArea?: string | null;
  amountAllocated?: number | null;
}

interface DonationMine {
  donationId: number;
  donationDate?: string | null;
  amount?: number | null;
  currencyCode?: string | null;
  donationType?: string | null;
  campaignName?: string | null;
  impactUnit?: string | null;
  isRecurring?: boolean | null;
  channelSource?: string | null;
  donationAllocations?: DonationAllocationApi[] | null;
}

interface ProgramImpactRow {
  label: string;
  totalAmount: number;
  giftCount: number;
  outcomeNotes: string[];
}

/* ── API / Helpers ───────────────────────────────────────────── */
async function fetchAllDonationsMine(): Promise<DonationMine[]> {
  const pageSize = 100;
  const first = await fetchPaged<DonationMine>('/api/donations/mine', 1, pageSize);
  const items = [...first.items];
  let page = 2;
  while (items.length < first.totalCount && page <= first.totalPages) {
    const next = await fetchPaged<DonationMine>('/api/donations/mine', page, pageSize);
    items.push(...next.items);
    page += 1;
  }
  return items;
}

function formatMoney(amount: number | null | undefined, currencyCode = 'PHP'): string {
  if (amount == null) return '—';
  const code = currencyCode && currencyCode.length === 3 ? currencyCode : 'PHP';
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(0)}`;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildProgramImpact(donations: DonationMine[]): ProgramImpactRow[] {
  type Acc = { totalAmount: number; donationIds: Set<number>; hints: Set<string> };
  const map = new Map<string, Acc>();

  const bump = (key: string, donation: DonationMine, amount: number) => {
    const k = key.trim() || 'General Support';
    let acc = map.get(k);
    if (!acc) {
      acc = { totalAmount: 0, donationIds: new Set<number>(), hints: new Set<string>() };
      map.set(k, acc);
    }
    acc.totalAmount += amount;
    acc.donationIds.add(donation.donationId);
    if (donation.impactUnit?.trim()) acc.hints.add(donation.impactUnit.trim());
  };

  for (const d of donations) {
    const allocs = (d.donationAllocations ?? []).filter(Boolean);
    const amountBase = d.amount ?? 0;
    const withLabel = allocs.filter((a) => a.programArea != null && String(a.programArea).trim() !== '');

    if (withLabel.length > 0) {
      const withMoney = withLabel.filter((a) => a.amountAllocated != null && Number(a.amountAllocated) > 0);
      if (withMoney.length > 0) {
        for (const a of withMoney) bump(String(a.programArea), d, Number(a.amountAllocated));
        continue;
      }
      const share = amountBase / withLabel.length;
      for (const a of withLabel) bump(String(a.programArea), d, share);
      continue;
    }
    if (allocs.length > 0) {
      const share = amountBase / allocs.length;
      for (const _ of allocs) bump('Program Allocation', d, share);
      continue;
    }
    bump(d.campaignName?.trim() || 'General Support', d, amountBase);
  }

  return [...map.entries()]
    .map(([label, acc]) => ({
      label,
      totalAmount: acc.totalAmount,
      giftCount: acc.donationIds.size,
      outcomeNotes: [...acc.hints],
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/* ── ImpactPage-aligned visuals ──────────────────────────────── */
const CONTENT_MAX = 1100;

const CATEGORY_PILL_STYLES: { color: string; bg: string; border: string }[] = [
  { color: '#6B21A8', bg: '#f5f3ff', border: '#e9d5ff' },
  { color: '#0D9488', bg: '#f0fdf4', border: '#bbf7d0' },
  { color: '#D97706', bg: '#fffbeb', border: '#fde68a' },
  { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
  { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
];

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.classList.add('hw-visible');
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function DashboardCard({ title, sub, titleId, children }: { title: string; sub?: string; titleId?: string; children: React.ReactNode }) {
  const ref = useFadeIn();
  const TitleTag = titleId ? 'h3' : 'p';
  return (
    <div
      ref={ref}
      className="hw-fade-in"
      style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 16px rgba(30,58,95,0.07)', padding: '1.4rem 1.5rem' }}
    >
      <TitleTag
        id={titleId}
        style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: '#1E3A5F', fontSize: '0.9rem', margin: '0 0 2px' }}
      >
        {title}
      </TitleTag>
      {sub && (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 1rem' }}>{sub}</p>
      )}
      {!sub && <div style={{ marginBottom: '1rem' }} />}
      {children}
    </div>
  );
}

function KpiStripPlaceholder() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            borderRight: '1px solid rgba(255,255,255,0.1)',
            padding: '2.25rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <span className="hw-metric-num text-4xl font-extrabold text-white/40">—</span>
        </div>
      ))}
      <div style={{ padding: '2.25rem 1.5rem', textAlign: 'center' }}>
        <span className="hw-metric-num text-4xl font-extrabold text-white/40">—</span>
      </div>
    </div>
  );
}

/* ── Main Page Component ─────────────────────────────────────── */
export default function DonorDashboardPage() {
  const [donations, setDonations] = useState<DonationMine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDonations = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    return fetchAllDonationsMine()
      .then((rows) => {
        setDonations(rows);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    void loadDonations();
  }, [loadDonations]);

  const totals = useMemo(() => {
    if (!donations) return { count: 0, sum: 0 };
    let sum = 0;
    for (const d of donations) {
      if (d.amount != null) sum += Number(d.amount);
    }
    return { count: donations.length, sum };
  }, [donations]);

  const programImpact = useMemo(() => (donations ? buildProgramImpact(donations) : []), [donations]);

  const heroRef = useFadeIn();

  const impactTotalTarget = Math.max(0, Math.round(totals.sum));

  return (
    <div style={{ fontFamily: 'var(--hw-font-body)', minHeight: '100vh', background: '#f8fafc' }}>
      <NavBar />

      {/* ── Hero (ImpactPage-aligned) ── */}
      <section
        aria-label="Donor dashboard introduction"
        style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)',
          paddingTop: '7rem',
          paddingBottom: '5rem',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
        }}
      >
        <div ref={heroRef} className="hw-fade-in" style={{ maxWidth: CONTENT_MAX, margin: '0 auto' }}>
          <span className="hw-eyebrow">Supporter Portal</span>
          <h1
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              color: '#fff',
              margin: '0.5rem 0 0.75rem',
              lineHeight: 1.1,
            }}
          >
            Your Giving & Impact
          </h1>
          <p
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: '1.05rem',
              maxWidth: 520,
              lineHeight: 1.65,
              margin: '0 0 1.5rem',
            }}
          >
            Because of your generosity, we provide safe housing and restorative care. Thank you for being part of the HealingWings mission.
          </p>
        </div>
      </section>

      {/* ── KPI strip (same glass treatment as ImpactPage) ── */}
      <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '0 1.5rem' }}>
        <div
          style={{
            marginTop: -44,
            background: 'rgba(30,58,95,0.92)',
            backdropFilter: 'blur(14px)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.13)',
            boxShadow: '0 20px 60px rgba(30,58,95,0.28)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {loading || !donations ? (
            <KpiStripPlaceholder />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <MetricCard target={totals.count} label="Gifts" />
              </div>
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <MetricCard target={impactTotalTarget} prefix="₱" label="Total impact (PHP)" />
              </div>
              <div>
                <MetricCard target={programImpact.length} label="Areas funded" />
              </div>
            </div>
          )}
        </div>
      </div>

      <main id="donor-dashboard-main">
        <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>
          {loading && (
            <div style={{ padding: '3rem 0', textAlign: 'center' }} role="status" aria-live="polite" aria-busy="true">
              <div
                className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1E3A5F] border-t-transparent mb-4"
                aria-hidden="true"
              />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>
                Loading your giving data…
              </p>
            </div>
          )}

          {error && (
            <div
              className="hw-alert-error shadow-sm p-8 text-center"
              role="alert"
              style={{ borderRadius: 16, maxWidth: 560, margin: '0 auto' }}
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
              </div>
              <h2 className="font-extrabold text-lg mb-1 text-[#991B1B]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Unable to load dashboard
              </h2>
              <p className="text-red-700/80 mb-0" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
                {error}
              </p>
            </div>
          )}

          {!loading && !error && donations && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* ── Impact by category (ReportCard-style pills) ── */}
              <section aria-labelledby="impact-by-category-heading">
                <h2
                  id="impact-by-category-heading"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    color: '#0D9488',
                    margin: '0 0 1.25rem',
                  }}
                >
                  Impact by category
                </h2>

                {programImpact.length === 0 ? (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: '#64748b', margin: 0 }}>
                    Your generosity will fuel measurable change across our programs.
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      padding: '1rem 1.25rem',
                      background: '#fafaf9',
                      border: '1px solid #f1f5f9',
                      borderRadius: 16,
                    }}
                  >
                    {programImpact.map((row, idx) => {
                      const pal = CATEGORY_PILL_STYLES[idx % CATEGORY_PILL_STYLES.length];
                      return (
                        <div
                          key={row.label}
                          style={{
                            background: pal.bg,
                            border: `1px solid ${pal.border}`,
                            borderRadius: 12,
                            padding: '0.5rem 0.85rem',
                            textAlign: 'center',
                            minWidth: 100,
                          }}
                        >
                          <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: pal.color, lineHeight: 1 }}>
                            {formatMoney(row.totalAmount)}
                          </div>
                          <div
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                              color: pal.color,
                              opacity: 0.75,
                              marginTop: 4,
                            }}
                          >
                            {row.label}
                          </div>
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
                            {row.giftCount} gift{row.giftCount === 1 ? '' : 's'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ── Stewardship / ledger ── */}
              <section aria-labelledby="stewardship-record-heading">
                <h2
                  id="stewardship-record-heading"
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    color: '#0D9488',
                    margin: '0 0 1.25rem',
                  }}
                >
                  Stewardship record
                </h2>

                {donations.length === 0 ? (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: '#64748b', margin: 0 }}>
                    No financial transactions found on your account.
                  </p>
                ) : (
                  <DashboardCard title="Donation ledger" sub="Your gifts and initiatives" titleId="donation-ledger-heading">
                    <div style={{ margin: '-1.4rem -1.5rem 0', overflowX: 'auto' }}>
                      <table
                        style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
                        aria-labelledby="donation-ledger-heading"
                      >
                        <caption
                          style={{
                            position: 'absolute',
                            width: 1,
                            height: 1,
                            padding: 0,
                            margin: -1,
                            overflow: 'hidden',
                            clip: 'rect(0,0,0,0)',
                            whiteSpace: 'nowrap',
                            border: 0,
                          }}
                        >
                          Your donations with date, amount, initiative, and plan type
                        </caption>
                        <thead>
                          <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f1f5f9' }}>
                            {['Date', 'Amount', 'Initiative', 'Plan'].map((h, i) => (
                              <th
                                key={h}
                                style={{
                                  fontFamily: 'Inter, sans-serif',
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.14em',
                                  color: '#94a3b8',
                                  padding: '0.85rem 1.25rem',
                                  textAlign: i === 3 ? 'center' : 'left',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {donations.map((d) => (
                            <tr key={d.donationId} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ fontFamily: 'Inter, sans-serif', padding: '1rem 1.25rem', color: '#64748b', fontSize: '0.9rem' }}>
                                {formatDate(d.donationDate)}
                              </td>
                              <td style={{ padding: '1rem 1.25rem' }}>
                                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: '#1E3A5F' }}>
                                  {formatMoney(d.amount, d.currencyCode ?? 'PHP')}
                                </span>
                                <span
                                  style={{
                                    display: 'block',
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.62rem',
                                    fontWeight: 600,
                                    color: '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    marginTop: 4,
                                  }}
                                >
                                  {d.donationType || 'Gift'}
                                </span>
                              </td>
                              <td style={{ padding: '1rem 1.25rem' }}>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.92rem', color: '#1E3A5F', display: 'block', marginBottom: 4 }}>
                                  {d.campaignName?.trim() || 'General mission'}
                                </span>
                                {d.impactUnit && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      fontFamily: 'Inter, sans-serif',
                                      fontSize: '0.62rem',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.06em',
                                      background: '#f0fdf4',
                                      color: '#0D9488',
                                      padding: '0.2rem 0.45rem',
                                      borderRadius: 6,
                                    }}
                                  >
                                    {d.impactUnit}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                {d.isRecurring ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      fontFamily: 'Inter, sans-serif',
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.08em',
                                      background: '#f5f3ff',
                                      color: '#6B21A8',
                                      padding: '0.35rem 0.65rem',
                                      borderRadius: 999,
                                    }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                      <polyline points="21 3 21 8 16 8" />
                                    </svg>
                                    Recurring
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      fontFamily: 'Inter, sans-serif',
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.08em',
                                      background: '#f5f5f4',
                                      color: '#a8a29e',
                                      padding: '0.35rem 0.65rem',
                                      borderRadius: 999,
                                    }}
                                  >
                                    One-time
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DashboardCard>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* ── CTA (ImpactPage bottom band) ── */}
      <section style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)', padding: '4rem 1.5rem' }} aria-label="Continue giving">
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <span className="hw-eyebrow">Make a difference</span>
          <h2
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              color: '#fff',
              margin: '0.6rem 0 0.75rem',
            }}
          >
            Continue your legacy of giving
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            Your support expands outreach and brings hope to more individuals we serve.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/#donate"
              className="hw-btn-magenta"
              style={{
                padding: '0.75rem 2rem',
                borderRadius: 50,
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Give again now →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
