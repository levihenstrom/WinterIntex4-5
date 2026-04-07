import { useEffect, useMemo, useState } from 'react';
import { fetchPaged } from '../../lib/apiClient';

/**
 * DON-4 — Donor self-service: own donation history + impact by funded program areas.
 * Data comes only from GET /api/donations/mine (supporter scoped by claim on the server).
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
    <div className="hw-bg-offwhite pb-5">
      <div className="container py-4">
        <header className="mb-4">
          <p className="hw-eyebrow mb-1">Donor portal</p>
          <h1 className="hw-heading display-6">Your giving & impact</h1>
          <p className="text-muted mb-0 col-lg-9">
            This page shows only donations tied to your account. The server scopes results to your supporter
            profile—other donors never appear here. Resident outcomes are summarized by program area without
            identifying anyone.
          </p>
        </header>

        {loading && (
          <div className="py-5 text-center text-muted" aria-live="polite">
            Loading your dashboard…
          </div>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && donations && (
          <>
            <section className="row g-3 mb-4" aria-label="Summary">
              <div className="col-md-4">
                <div className="card h-100 border-0 shadow-sm hw-bg-lavender">
                  <div className="card-body">
                    <div className="small text-muted text-uppercase fw-semibold">Lifetime gifts</div>
                    <div className="h3 hw-text-purple mb-0">{totals.count}</div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-body">
                    <div className="small text-muted text-uppercase fw-semibold">Total amount</div>
                    <div className="h3 hw-text-teal mb-0">
                      {totals.count === 0 ? '—' : formatMoney(totals.sum, totals.currency)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card h-100 border-0 shadow-sm">
                  <div className="card-body">
                    <div className="small text-muted text-uppercase fw-semibold">Program areas supported</div>
                    <div className="h3 hw-text-purple mb-0">{programImpact.length}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-5" aria-labelledby="impact-heading">
              <h2 id="impact-heading" className="h4 hw-heading mb-3">
                Impact by program area
              </h2>
              <p className="text-muted small col-lg-10 mb-3">
                Amounts roll up to the campaigns and allocations linked to your gifts. When the API includes
                allocation rows, we group by program area; otherwise we group by campaign name. Impact notes
                come from your gift metadata (for example units of service)—never resident identities.
              </p>

              {programImpact.length === 0 ? (
                <div className="card border-0 shadow-sm">
                  <div className="card-body text-muted">
                    No program-level breakdown yet. When you have recorded gifts, they will appear here.
                  </div>
                </div>
              ) : (
                <div className="row g-3">
                  {programImpact.map((row) => (
                    <div key={row.label} className="col-md-6 col-lg-4">
                      <div className="card h-100 border-0 shadow-sm">
                        <div className="card-body">
                          <h3 className="h6 hw-text-teal">{row.label}</h3>
                          <p className="mb-1">
                            <strong>{formatMoney(row.totalAmount, totals.currency)}</strong>
                            <span className="text-muted small ms-2">
                              · {row.giftCount} gift{row.giftCount === 1 ? '' : 's'}
                            </span>
                          </p>
                          {row.outcomeNotes.length > 0 ? (
                            <p className="small text-muted mb-0 mt-2">
                              <span className="fw-semibold text-secondary">Aggregate impact notes: </span>
                              {row.outcomeNotes.join(' · ')}
                            </p>
                          ) : (
                            <p className="small text-muted mb-0 mt-2">
                              Outcomes for this area are tracked in aggregate to protect resident privacy.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="history-heading">
              <h2 id="history-heading" className="h4 hw-heading mb-3">
                Donation history
              </h2>
              {donations.length === 0 ? (
                <p className="text-muted">
                  No donations on file for your supporter profile yet. If you recently gave, allow time for
                  processing.
                </p>
              ) : (
                <div className="table-responsive card border-0 shadow-sm">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Type</th>
                        <th scope="col">Campaign / program</th>
                        <th scope="col">Recurring</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donations.map((d) => (
                        <tr key={d.donationId}>
                          <td>{formatDate(d.donationDate)}</td>
                          <td className="fw-semibold">{formatMoney(d.amount, d.currencyCode)}</td>
                          <td>{d.donationType?.trim() || '—'}</td>
                          <td>{d.campaignName?.trim() || '—'}</td>
                          <td>
                            {d.isRecurring === true ? (
                              <span className="badge text-bg-secondary">Yes</span>
                            ) : d.isRecurring === false ? (
                              <span className="badge text-bg-light text-muted border">No</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
