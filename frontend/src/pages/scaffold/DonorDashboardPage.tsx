import { useEffect, useMemo, useState, useRef } from 'react';
import { fetchPaged } from '../../lib/apiClient';
import SectionContainer from '../../components/hw/SectionContainer';

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

function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
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

/* ── Components (following ImpactPage patterns) ──────────────── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add('hw-visible'); }, { threshold: 0.1 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return ref;
}

function StatBox({ label, value, color, bg, border, delay }: { label: string; value: string; color: string; bg: string; border: string; delay?: string }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`hw-fade-in ${delay}`} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: '1.25rem 1rem', textAlign: 'center', boxShadow: '0 4px 15px rgba(30,58,95,0.03)' }}>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '2.4rem', color, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color, opacity: 0.55, marginTop: 10 }}>{label}</div>
    </div>
  );
}

function Card({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`hw-fade-in bg-white rounded-[2rem] border border-stone-200 shadow-sm p-8 lg:p-10 ${className}`} style={{ boxShadow: '0 10px 40px rgba(30,58,95,0.03)' }}>
      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, color: '#1E3A5F', fontSize: '1.25rem', marginBottom: '2rem', letterSpacing: '-0.01em' }}>{title}</p>
      {children}
    </div>
  );
}

function ProgramImpactCard({ row, delay }: { row: ProgramImpactRow; delay: string }) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={`hw-fade-in ${delay} group rounded-3xl border border-stone-100 bg-white p-8 shadow-sm transition-all duration-700 hover:shadow-2xl hover:-translate-y-2 flex flex-col items-center text-center justify-center`}
      style={{ minHeight: '260px', boxShadow: '0 10px 40px rgba(30,58,95,0.02)' }}
    >
      <span className="inline-block px-4 py-1.5 bg-stone-50 text-[#6B21A8] rounded-full text-[10px] font-black uppercase tracking-[0.25em] mb-6">
        Program Funding
      </span>

      <h3 className="font-extrabold text-2xl text-[#1E3A5F] mb-3 group-hover:text-[#6B21A8] transition-colors leading-tight tracking-tight">
        {row.label}
      </h3>

      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl font-black text-[#0D9488] tabular-nums tracking-tighter">
          {formatMoney(row.totalAmount)}
        </span>
        <span className="text-stone-400 text-[11px] font-bold uppercase tracking-widest mt-1">
          from {row.giftCount} gift{row.giftCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

/* ── Main Page Component ─────────────────────────────────────── */
export default function DonorDashboardPage() {
  const [donations, setDonations] = useState<DonationMine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAllDonationsMine()
      .then((rows) => { if (!cancelled) setDonations(rows); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  return (
    <div style={{ fontFamily: 'var(--hw-font-body)', background: '#f8fafc', minHeight: '100vh' }}>
      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)', paddingTop: '6rem', paddingBottom: '9rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', textAlign: 'center' }}>
        <div ref={heroRef} className="hw-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
          <span className="hw-eyebrow" style={{ color: '#5eead4', fontSize: '0.8rem' }}>Supporter Portal</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: 'clamp(2.5rem, 6vw, 4rem)', color: '#fff', margin: '1rem 0 1.5rem', lineHeight: 1, letterSpacing: '-0.03em' }}>
            Your Giving & Impact
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.25rem', maxWidth: 700, lineHeight: 1.6, margin: '0 auto' }}>
            Because of your generosity, we are able to provide safe housing and restorative care to those who need it most.
            Thank you for being part of the HealingWings mission.
          </p>
        </div>
      </section>

      {/* ── KPI Grid (overlapping) ── */}
      <SectionContainer style={{ marginTop: '-4rem', position: 'relative', zIndex: 10 }}>
        <div className="grid grid-cols-3 gap-4">
          <StatBox
            label="Gifts"
            value={loading ? '—' : String(totals.count)}
            color="#6B21A8" bg="#fff" border="#e9d5ff" delay="hw-delay-100"
          />
          <StatBox
            label="Total Impact"
            value={loading ? '—' : formatMoney(totals.sum)}
            color="#0D9488" bg="#fff" border="#bbf7d0" delay="hw-delay-200"
          />
          <StatBox
            label="Areas Funded"
            value={loading ? '—' : String(programImpact.length)}
            color="#D97706" bg="#fff" border="#fde68a" delay="hw-delay-300"
          />
        </div>
      </SectionContainer>

      <SectionContainer className="py-20 lg:py-28">
        {loading && (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1E3A5F] border-t-transparent mb-6"></div>
            <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-xs">Synchronizing your giving data...</p>
          </div>
        )}

        {error && (
          <div className="hw-alert-error max-w-2xl mx-auto shadow-xl p-10 text-center" role="alert" style={{ borderRadius: '2rem' }}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
            </div>
            <h3 className="font-extrabold text-xl mb-2 text-[#991B1B]">Unable to load dashboard</h3>
            <p className="text-red-700/70">{error}</p>
          </div>
        )}

        {!loading && !error && donations && (
          <div className="space-y-32">
            {/* ── Program Area Impact ── */}
            <section>
              <div className="mb-12 text-left">
                <h2 className="hw-heading-font mt-2 text-3xl font-black md:text-4xl text-[#6B21A8] tracking-tight">Impact by Category</h2>
              </div>

              {programImpact.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-stone-200 p-16 text-center shadow-sm">
                  <p className="text-stone-400 font-medium italic m-0 text-lg">Your generosity will fuel measurable change across our programs.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {programImpact.map((row, idx) => (
                    <ProgramImpactCard
                      key={row.label}
                      row={row}
                      delay={`hw-delay-${(idx % 3 + 1) * 100}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── History Table ── */}
            <section>
              <div className="mb-10 text-left">
                <h2 className="hw-heading-font mt-2 text-3xl font-black md:text-4xl text-[#6B21A8] tracking-tight">Stewardship Record</h2>
              </div>

              {donations.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-stone-200 p-12 text-center">
                  <p className="text-stone-400 font-medium text-lg italic">No financial transactions found on your account.</p>
                </div>
              ) : (
                <Card title="Donation Ledger" className="overflow-hidden p-0 lg:p-0 border-none">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-stone-50/50 border-b border-stone-100">
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Date</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Amount (USD)</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Initiative</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 text-center">Plan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-50">
                        {donations.map((d) => (
                          <tr key={d.donationId} className="hover:bg-violet-50/30 transition-all group">
                            <td className="px-8 py-7 text-stone-500 font-semibold text-[0.95rem]">
                              {formatDate(d.donationDate)}
                            </td>
                            <td className="px-8 py-7">
                              <span className="font-black text-[#1E3A5F] text-xl tabular-nums tracking-tighter">
                                {formatMoney(d.amount)}
                              </span>
                              <span className="block text-[10px] text-stone-400 uppercase font-black mt-1.5 tracking-widest">{d.donationType || 'Gift'}</span>
                            </td>
                            <td className="px-8 py-7">
                              <span className="font-bold text-[#1E3A5F] text-[1.05rem] leading-snug block mb-1">{d.campaignName?.trim() || 'General Mission'}</span>
                              {d.impactUnit && <span className="inline-flex px-2 py-0.5 bg-teal-50 text-[#0D9488] text-[10px] font-bold uppercase rounded-md tracking-wider">{d.impactUnit}</span>}
                            </td>
                            <td className="px-8 py-7 text-center">
                              {d.isRecurring ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-100 text-[#6B21A8] text-[10px] font-black uppercase tracking-widest">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><polyline points="21 3 21 8 16 8" /></svg>
                                  Recurring
                                </span>
                              ) : (
                                <span className="inline-flex px-3 py-1.5 rounded-full bg-stone-100 text-stone-400 text-[10px] font-black uppercase tracking-widest">
                                  One-Time
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>
          </div>
        )}
      </SectionContainer>

      {/* ── Footer / CTA ── */}
      <section className="py-28 bg-[#1E3A5F] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#5eead4] rounded-full blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h3 className="hw-heading-font text-4xl font-black mb-6 tracking-tight italic" style={{ color: '#5eead4' }}>
            Continue your legacy of giving.
          </h3>
          <p className="text-white/60 text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-medium">Your continued support allows us to expand our outreach and bring hope to even more individuals.</p>
          <div className="flex justify-center">
            <a href="/#donate" className="hw-btn-magenta h-16 px-16 flex items-center justify-center rounded-full text-xl font-extrabold shadow-2xl hover:scale-105 transition-transform" style={{ minWidth: '280px' }}>
              Give Again Now →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
