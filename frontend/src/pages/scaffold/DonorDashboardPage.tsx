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

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '—';
  const c = (currency && currency.trim()) || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(amount);
  } catch {
    return `${amount} ${c}`;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildProgramImpact(donations: DonationMine[]): ProgramImpactRow[] {
  type Acc = { totalAmount: number; donationIds: Set<number>; hints: Set<string> };
  const map = new Map<string, Acc>();

  const bump = (key: string, donation: DonationMine, amount: number) => {
    const k = key.trim() || 'General support';
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
      for (const _ of allocs) bump('Program allocation', d, share);
      continue;
    }
    bump(d.campaignName?.trim() || 'General support', d, amountBase);
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
    <div ref={ref} className={`hw-fade-in ${delay}`} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: '1.5rem', textAlign: 'center', boxShadow: '0 4px 12px rgba(30,58,95,0.06)' }}>
      <div style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '2.4rem', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color, opacity: 0.7, marginTop: 10 }}>{label}</div>
    </div>
  );
}

function Card({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`hw-fade-in bg-white rounded-2xl border border-stone-200 shadow-md p-6 lg:p-8 ${className}`} style={{ boxShadow: '0 4px 20px rgba(30,58,95,0.04)' }}>
      <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, color: '#1E3A5F', fontSize: '1.1rem', marginBottom: '1.5rem' }}>{title}</p>
      {children}
    </div>
  );
}

function ProgramImpactCard({ row, currency, delay }: { row: ProgramImpactRow; currency: string; delay: string }) {
  const ref = useFadeIn();
  return (
    <div 
      ref={ref}
      className={`hw-fade-in ${delay} group rounded-2xl border border-stone-200 bg-white p-7 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
    >
       <div className="mb-4">
         <span className="inline-block px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-[10px] uppercase font-bold tracking-wider mb-3">
           Allocated Funding
         </span>
         <h3 className="font-bold text-xl text-[#6B21A8] mb-1 group-hover:text-[#0D9488] transition-colors">{row.label}</h3>
         <div className="flex items-baseline gap-2 mt-2">
           <span className="text-3xl font-black text-[#1E3A5F] tabular-nums">
             {formatMoney(row.totalAmount, currency)}
           </span>
           <span className="text-stone-400 text-sm font-medium">· {row.giftCount} gift{row.giftCount === 1 ? '' : 's'}</span>
         </div>
       </div>
       
       <div className="pt-4 border-t border-stone-100">
         <p className="text-sm leading-relaxed text-stone-600">
           {row.outcomeNotes.length > 0 ? (
             <>
               <span className="font-semibold text-stone-800">Your legacy: </span>
               {row.outcomeNotes.join(' · ')}
             </>
           ) : (
             "These funds are pooled to provide essential resident resources and staffing."
           )}
         </p>
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
    if (!donations) return { count: 0, sum: 0, currency: 'USD' };
    let sum = 0;
    let currency: string | undefined;
    for (const d of donations) {
      if (d.amount != null) sum += Number(d.amount);
      if (d.currencyCode) currency = d.currencyCode;
    }
    return { count: donations.length, sum, currency: currency || 'USD' };
  }, [donations]);

  const programImpact = useMemo(() => (donations ? buildProgramImpact(donations) : []), [donations]);

  const heroRef = useFadeIn();

  return (
    <div style={{ fontFamily: 'var(--hw-font-body)', background: '#f8fafc', minHeight: '100vh' }}>
      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #0f2744 100%)', paddingTop: '4rem', paddingBottom: '6rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div ref={heroRef} className="hw-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <span className="hw-eyebrow" style={{ color: '#5eead4' }}>Donor Dashboard</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3rem)', color: '#fff', margin: '0.5rem 0 1rem', lineHeight: 1.1 }}>
            Your Giving Journey
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', maxWidth: 640, lineHeight: 1.6, margin: 0 }}>
            Every contribution you've made has helped provide safe housing and restorative care.
            This dashboard summarizes your personal impact and history with HealingWings.
          </p>
        </div>
      </section>

      {/* ── KPI Grid (overlapping) ── */}
      <SectionContainer style={{ marginTop: '-3rem', position: 'relative', zIndex: 10 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatBox 
            label="Lifetime Gifts" 
            value={loading ? '...' : String(totals.count)} 
            color="#6B21A8" bg="#f5f3ff" border="#e9d5ff" delay="hw-delay-100" 
          />
          <StatBox 
            label="Total Impact" 
            value={loading ? '...' : formatMoney(totals.sum, totals.currency)} 
            color="#0D9488" bg="#f0fdf4" border="#bbf7d0" delay="hw-delay-200" 
          />
          <StatBox 
            label="Causes Funded" 
            value={loading ? '...' : String(programImpact.length)} 
            color="#D97706" bg="#fffbeb" border="#fde68a" delay="hw-delay-300" 
          />
        </div>
      </SectionContainer>

      <SectionContainer className="py-12 lg:py-16">
        {loading && (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#1E3A5F] border-t-transparent mb-4"></div>
            <p className="text-stone-500 font-medium">Quantifying your impact...</p>
          </div>
        )}

        {error && (
          <div className="hw-alert-error max-w-2xl mx-auto shadow-sm" role="alert">
            <span className="font-bold block mb-1">Error fetching data</span>
            {error}
          </div>
        )}

        {!loading && !error && donations && (
          <div className="space-y-12">
            {/* ── Program Area Impact ── */}
            <section>
              <div className="mb-8">
                <span className="hw-eyebrow">Direct Impact</span>
                <h2 className="hw-heading mt-2 text-2xl font-extrabold md:text-3xl text-[#1E3A5F]">By Program Area</h2>
              </div>

              {programImpact.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center shadow-sm">
                  <p className="text-stone-500 italic m-0">Your first donation will ignite measurable change here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {programImpact.map((row, idx) => (
                    <ProgramImpactCard 
                      key={row.label} 
                      row={row} 
                      currency={totals.currency} 
                      delay={`hw-delay-${(idx % 3 + 1) * 100}`} 
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── History Table ── */}
            <section>
              <div className="mb-8">
                <span className="hw-eyebrow">Financial Record</span>
                <h2 className="hw-heading mt-2 text-2xl font-extrabold md:text-3xl text-[#1E3A5F]">Giving History</h2>
              </div>

              {donations.length === 0 ? (
                <p className="text-stone-500">No records found.</p>
              ) : (
                <Card title="Detailed Transactions" className="overflow-hidden p-0 lg:p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200">
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Date</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Amount</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Project / Campaign</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 text-center">Plan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {donations.map((d) => (
                          <tr key={d.donationId} className="hover:bg-violet-50/40 transition-colors group">
                            <td className="px-6 py-5 text-stone-600 font-medium">
                              {formatDate(d.donationDate)}
                            </td>
                            <td className="px-6 py-5">
                              <span className="font-bold text-[#1E3A5F] text-lg tabular-nums">
                                {formatMoney(d.amount, d.currencyCode)}
                              </span>
                              <span className="block text-[10px] text-stone-400 uppercase font-bold mt-0.5">{d.donationType || 'Standard'}</span>
                            </td>
                            <td className="px-6 py-5 text-stone-700">
                              <span className="font-semibold">{d.campaignName?.trim() || 'General Fund'}</span>
                              {d.impactUnit && <span className="block text-xs text-[#0D9488] mt-1">{d.impactUnit}</span>}
                            </td>
                            <td className="px-6 py-5 text-center">
                              {d.isRecurring ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#6B21A8] text-[11px] font-bold uppercase tracking-tight">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m3 2 19 19m-5 1 5-5-5-5M2 9l5 5 5-5" /></svg>
                                  Recurring
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-1 rounded-full bg-stone-100 text-stone-400 text-[11px] font-bold uppercase tracking-tight">
                                  One-time
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
      <section className="py-20 bg-stone-50 border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
           <h3 className="hw-heading-font text-3xl font-black text-[#1E3A5F] mb-4">Want to further your impact?</h3>
           <p className="text-stone-500 text-lg mb-10">Your next gift could be the turning point for another resident waiting for care.</p>
           <div className="flex flex-wrap justify-center gap-4">
              <a href="/#donate" className="hw-btn-magenta h-14 px-10 flex items-center justify-center rounded-full text-lg font-bold">
                Give Again →
              </a>
              <button className="hw-btn-ghost-purple h-14 px-10 flex items-center justify-center rounded-full text-lg font-bold bg-white">
                Download Annual Receipt
              </button>
           </div>
        </div>
      </section>
    </div>
  );
}
