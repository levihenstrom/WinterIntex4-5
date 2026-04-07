import { useEffect, useMemo, useState } from 'react';
import { fetchPaged } from '../../lib/apiClient';
import SectionContainer from '../../components/hw/SectionContainer';

/**
 * DON-4 — Donor self-service: own donation history + impact by funded program areas.
 * Data comes only from GET /api/donations/mine (supporter scoped by claim on the server).
 * Visual language matches HealingWingsHome + hw.css tokens.
 */

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
  /** Distinct donations that funded this program area (or campaign bucket). */
  giftCount: number;
  outcomeNotes: string[];
}

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

/** Build impact rows: prefer allocation program areas; otherwise group by campaign / general. */
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
    const hint = donation.impactUnit;
    if (hint && hint.trim()) acc.hints.add(hint.trim());
  };

  for (const d of donations) {
    const allocs = (d.donationAllocations ?? []).filter(Boolean);
    const amountBase = d.amount ?? 0;

    const withLabel = allocs.filter((a) => a.programArea != null && String(a.programArea).trim() !== '');

    if (withLabel.length > 0) {
      const withMoney = withLabel.filter(
        (a) => a.amountAllocated != null && Number(a.amountAllocated) > 0,
      );
      if (withMoney.length > 0) {
        for (const a of withMoney) {
          bump(String(a.programArea), d, Number(a.amountAllocated));
        }
        continue;
      }
      const share = withLabel.length > 0 ? amountBase / withLabel.length : amountBase;
      for (const a of withLabel) {
        bump(String(a.programArea), d, share);
      }
      continue;
    }

    if (allocs.length > 0) {
      const share = amountBase / allocs.length;
      for (const _ of allocs) {
        bump('Program allocation', d, share);
      }
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

function DonorMetricCell({
  value,
  label,
  isMoney,
}: {
  value: string | number;
  label: string;
  isMoney?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center sm:py-10">
      <span
        className={`hw-metric-num font-extrabold leading-none text-white ${isMoney ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-4xl sm:text-5xl md:text-6xl'}`}
      >
        {value}
      </span>
      <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#5eead4' }}>
        {label}
      </span>
    </div>
  );
}

export default function DonorDashboardPage() {
  const [donations, setDonations] = useState<DonationMine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAllDonationsMine()
      .then((rows) => {
        if (!cancelled) setDonations(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    if (!donations) return { count: 0, sum: 0, currency: 'USD' as string | undefined };
    let sum = 0;
    let currency: string | undefined;
    for (const d of donations) {
      if (d.amount != null) sum += Number(d.amount);
      if (d.currencyCode) currency = d.currencyCode;
    }
    return { count: donations.length, sum, currency };
  }, [donations]);

  const programImpact = useMemo(() => (donations ? buildProgramImpact(donations) : []), [donations]);

  return (
    <div className="hw-bg-offwhite min-h-[50vh] pb-16" style={{ fontFamily: 'var(--hw-font-body)' }}>
      <SectionContainer className="py-10 lg:py-14">
        <header className="mb-10 max-w-3xl">
          <span className="hw-eyebrow">Donor portal</span>
          <h1 className="hw-heading mt-3 text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            Your giving & impact
          </h1>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-stone-600">
            <p>
              This page shows only donations tied to your account. The server scopes results to your supporter
              profile—other donors never appear here.
            </p>
            <p className="mb-0">
              Resident outcomes are summarized by program area without identifying anyone.
            </p>
          </div>
        </header>

        {loading && (
          <div className="py-16 text-center text-stone-500" aria-live="polite">
            Loading your dashboard…
          </div>
        )}

        {error && (
          <div className="hw-alert-error max-w-2xl" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && donations && (
          <>
            {/* Summary strip — same glass / navy language as HealingWingsHome ImpactBar */}
            <section
              className="relative z-10 mx-auto mb-12 w-full max-w-7xl rounded-[2rem] border border-white/20 bg-[#1E3A5F]/75 shadow-2xl backdrop-blur-xl"
              aria-label="Giving summary"
            >
              <div className="grid grid-cols-1 divide-y divide-white/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <DonorMetricCell value={totals.count} label="Lifetime gifts" />
                <DonorMetricCell
                  value={totals.count === 0 ? '—' : formatMoney(totals.sum, totals.currency)}
                  label="Total amount"
                  isMoney
                />
                <DonorMetricCell value={programImpact.length} label="Program areas supported" />
              </div>
            </section>

            <section className="mb-12" aria-labelledby="impact-heading">
              <div className="mb-6 max-w-3xl">
                <span className="hw-eyebrow">Your impact</span>
                <h2 id="impact-heading" className="hw-heading mt-3 text-2xl font-extrabold md:text-3xl">
                  By program area
                </h2>
                <p className="mt-4 text-stone-600">
                  Amounts roll up to campaigns and allocations linked to your gifts. When the API includes
                  allocation rows, we group by program area; otherwise we group by campaign name. Impact notes
                  come from your gift metadata (for example units of service)—never resident identities.
                </p>
              </div>

              {programImpact.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-md">
                  <p className="mb-0 text-stone-500">
                    No program-level breakdown yet. When you have recorded gifts, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {programImpact.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-md transition-shadow duration-300 hover:shadow-xl"
                    >
                      <div className="border-l-4 border-[#6B21A8] pl-4">
                        <h3 className="hw-heading-font text-lg font-bold text-[#0D9488]">{row.label}</h3>
                        <p className="mt-2 text-stone-900">
                          <span className="text-2xl font-extrabold tabular-nums">
                            {formatMoney(row.totalAmount, totals.currency)}
                          </span>
                          <span className="ml-2 text-sm text-stone-500">
                            · {row.giftCount} gift{row.giftCount === 1 ? '' : 's'}
                          </span>
                        </p>
                        {row.outcomeNotes.length > 0 ? (
                          <p className="mt-3 text-sm leading-relaxed text-stone-600">
                            <span className="font-semibold text-stone-800">Aggregate impact notes: </span>
                            {row.outcomeNotes.join(' · ')}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm leading-relaxed text-stone-600">
                            Outcomes for this area are tracked in aggregate to protect resident privacy.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="history-heading">
              <div className="mb-6">
                <span className="hw-eyebrow">Record</span>
                <h2 id="history-heading" className="hw-heading mt-3 text-2xl font-extrabold md:text-3xl">
                  Donation history
                </h2>
              </div>

              {donations.length === 0 ? (
                <p className="text-stone-600">
                  No donations on file for your supporter profile yet. If you recently gave, allow time for
                  processing.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 bg-[#FAFAF9]">
                          <th scope="col" className="hw-heading-font px-5 py-4 font-bold text-stone-800">
                            Date
                          </th>
                          <th scope="col" className="hw-heading-font px-5 py-4 font-bold text-stone-800">
                            Amount
                          </th>
                          <th scope="col" className="hw-heading-font px-5 py-4 font-bold text-stone-800">
                            Type
                          </th>
                          <th scope="col" className="hw-heading-font px-5 py-4 font-bold text-stone-800">
                            Campaign / program
                          </th>
                          <th scope="col" className="hw-heading-font px-5 py-4 font-bold text-stone-800">
                            Recurring
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {donations.map((d) => (
                          <tr key={d.donationId} className="transition-colors hover:bg-[#F5F3FF]/60">
                            <td className="whitespace-nowrap px-5 py-4 text-stone-700">
                              {formatDate(d.donationDate)}
                            </td>
                            <td className="px-5 py-4 font-semibold tabular-nums text-[#1E3A5F]">
                              {formatMoney(d.amount, d.currencyCode)}
                            </td>
                            <td className="px-5 py-4 text-stone-700">{d.donationType?.trim() || '—'}</td>
                            <td className="px-5 py-4 text-stone-700">{d.campaignName?.trim() || '—'}</td>
                            <td className="px-5 py-4">
                              {d.isRecurring === true ? (
                                <span className="inline-flex rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-semibold text-[#6B21A8]">
                                  Yes
                                </span>
                              ) : d.isRecurring === false ? (
                                <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                                  No
                                </span>
                              ) : (
                                <span className="text-stone-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </SectionContainer>
    </div>
  );
}
