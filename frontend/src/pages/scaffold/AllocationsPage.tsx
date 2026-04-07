import { useEffect, useMemo, useState } from 'react';
import { fetchAllPaged } from '../../lib/apiClient';
import AdminKpiStrip from '../../components/admin/AdminKpiStrip';

interface DonationAllocationRow {
  allocationId: number;
  donationId: number;
  amountAllocated?: number | null;
  programArea?: string | null;
  allocationDate?: string | null;
  allocationNotes?: string | null;
  donation?: {
    supporter?: { displayName?: string | null; organizationName?: string | null } | null;
  } | null;
  safehouse?: { name?: string | null; safehouseCode?: string | null } | null;
}

function fmtMoney(n: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

function supporterLabel(a: DonationAllocationRow): string {
  const s = a.donation?.supporter;
  const name = s?.displayName?.trim() || s?.organizationName?.trim();
  return name || '—';
}

function fmtAllocDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AllocationsPage() {
  const [rows, setRows] = useState<DonationAllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [safehouseFilter, setSafehouseFilter] = useState('All');
  const [programFilter, setProgramFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [detailRow, setDetailRow] = useState<DonationAllocationRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAllPaged<DonationAllocationRow>('/api/donation-allocations', 200)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const safehouseNames = useMemo(() => {
    const set = new Set<string>();
    for (const a of rows) {
      const n = a.safehouse?.name ?? a.safehouse?.safehouseCode;
      if (n) set.add(n);
    }
    return ['All', ...Array.from(set).sort()];
  }, [rows]);

  const programNames = useMemo(() => {
    const set = new Set<string>();
    for (const a of rows) {
      if (a.programArea) set.add(a.programArea);
    }
    return ['All', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((a) => {
      const sh = a.safehouse?.name ?? a.safehouse?.safehouseCode ?? '';
      const matchSh = safehouseFilter === 'All' || sh === safehouseFilter;
      const matchPr = programFilter === 'All' || (a.programArea ?? '') === programFilter;
      const sup = supporterLabel(a).toLowerCase();
      const matchSearch = !q || sup.includes(q) || String(a.donationId).includes(q);
      return matchSh && matchPr && matchSearch;
    });
  }, [rows, safehouseFilter, programFilter, search]);

  const bySafehouse = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of rows) {
      const name = a.safehouse?.name ?? a.safehouse?.safehouseCode ?? 'Unknown';
      map.set(name, (map.get(name) ?? 0) + Number(a.amountAllocated ?? 0));
    }
    return Array.from(map.entries()).sort((x, y) => y[1] - x[1]);
  }, [rows]);

  const byProgram = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of rows) {
      const p = a.programArea?.trim() || 'General';
      map.set(p, (map.get(p) ?? 0) + Number(a.amountAllocated ?? 0));
    }
    return Array.from(map.entries()).sort((x, y) => y[1] - x[1]);
  }, [rows]);

  const totalFiltered = filtered.reduce((s, a) => s + Number(a.amountAllocated ?? 0), 0);

  const allocationKpis = useMemo(() => {
    const totalPhp = rows.reduce((s, a) => s + Number(a.amountAllocated ?? 0), 0);
    const sh = new Set(rows.map((a) => a.safehouse?.name ?? a.safehouse?.safehouseCode).filter(Boolean));
    const pr = new Set(rows.map((a) => a.programArea?.trim() || 'General'));
    return {
      totalPhp,
      count: rows.length,
      safehouses: sh.size,
      programs: pr.size,
    };
  }, [rows]);

  useEffect(() => {
    if (!detailRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailRow(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailRow]);

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Donors &amp; Contributions</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
            Donation allocations
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
            Live data from your database: gifts routed to safehouses and program areas (staff scope applies).
          </p>
        </div>

        {loading && <p className="text-muted">Loading allocations…</p>}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && (
          <>
            <AdminKpiStrip
              items={[
                { label: 'Total allocated (PHP)', value: fmtMoney(allocationKpis.totalPhp), sub: 'all loaded rows', accent: '#059669' },
                { label: 'Allocation rows', value: String(allocationKpis.count), accent: '#1E3A5F' },
                { label: 'Sites', value: String(allocationKpis.safehouses), sub: 'distinct safehouses', accent: '#0D9488' },
                { label: 'Program areas', value: String(allocationKpis.programs), sub: 'distinct labels', accent: '#7C3AED' },
              ]}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
              {bySafehouse.slice(0, 8).map(([name, total]) => (
                <div
                  key={name}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: '18px 20px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', marginBottom: 8 }}>{name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A5F' }}>{fmtMoney(total)}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>total allocated</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(30,58,95,0.06)', marginBottom: 24 }}>
              <h6 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, color: '#1E3A5F', marginBottom: 16 }}>By program area</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {byProgram.map(([name, total]) => {
                  const grand = byProgram.reduce((s, x) => s + x[1], 0);
                  const pct = grand > 0 ? Math.round((total / grand) * 100) : 0;
                  return (
                    <div key={name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, color: '#475569' }}>{name}</span>
                        <span style={{ color: '#1E3A5F', fontWeight: 700 }}>
                          {fmtMoney(total)} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div style={{ background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg, #1E3A5F, #0D9488)', width: `${pct}%`, height: '100%', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '16px 20px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(30,58,95,0.05)',
                marginBottom: 20,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                placeholder="Search supporter or donation #…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: '1 1 200px', padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
              <select
                value={safehouseFilter}
                onChange={(e) => setSafehouseFilter(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}
              >
                {safehouseNames.map((s) => (
                  <option key={s} value={s}>
                    {s === 'All' ? 'All safehouses' : s}
                  </option>
                ))}
              </select>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}
              >
                {programNames.map((p) => (
                  <option key={p} value={p}>
                    {p === 'All' ? 'All programs' : p}
                  </option>
                ))}
              </select>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>
                <strong style={{ color: '#1E3A5F' }}>{fmtMoney(totalFiltered)}</strong> filtered
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
                  <p style={{ fontWeight: 600 }}>No allocations match your filters.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        {['Donation #', 'Supporter', 'Amount', 'Site', 'Program', 'Allocated on', 'Notes'].map((h) => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a, i) => (
                        <tr
                          key={a.allocationId}
                          role="button"
                          tabIndex={0}
                          title="View allocation details"
                          style={{
                            background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                          }}
                          onClick={() => setDetailRow(a)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDetailRow(a);
                            }
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#6B21A8', fontSize: 12 }}>{a.donationId}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E3A5F' }}>{supporterLabel(a)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#166534' }}>
                            {fmtMoney(Number(a.amountAllocated ?? 0))}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{a.safehouse?.name ?? a.safehouse?.safehouseCode ?? '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{a.programArea ?? '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                            {a.allocationDate
                              ? new Date(a.allocationDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 11, maxWidth: 220 }}>{a.allocationNotes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8', textAlign: 'right' }}>
              Showing {filtered.length} of {rows.length} allocation rows
            </div>

            {detailRow && (
              <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true" aria-labelledby="allocDetailTitle">
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                  <div className="modal-content">
                    <div className="modal-header border-bottom">
                      <div>
                        <h5 className="modal-title fw-bold text-dark mb-0" id="allocDetailTitle">
                          Allocation details
                        </h5>
                        <p className="small text-muted mb-0">Allocation ID {detailRow.allocationId}</p>
                      </div>
                      <button type="button" className="btn-close" aria-label="Close" onClick={() => setDetailRow(null)} />
                    </div>
                    <div className="modal-body">
                      <h6 className="text-uppercase small fw-bold text-secondary">Allocation</h6>
                      <dl className="row small mb-4">
                        <div className="col-sm-6 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Amount allocated</dt>
                          <dd className="mb-0 mt-1 fw-semibold text-success">{fmtMoney(Number(detailRow.amountAllocated ?? 0))}</dd>
                        </div>
                        <div className="col-sm-6 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Allocated on</dt>
                          <dd className="mb-0 mt-1">{fmtAllocDate(detailRow.allocationDate)}</dd>
                        </div>
                        <div className="col-sm-6 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Program area</dt>
                          <dd className="mb-0 mt-1">{detailRow.programArea ?? '—'}</dd>
                        </div>
                        <div className="col-sm-6 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Safehouse</dt>
                          <dd className="mb-0 mt-1">{detailRow.safehouse?.name ?? detailRow.safehouse?.safehouseCode ?? '—'}</dd>
                        </div>
                        <div className="col-12 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Notes</dt>
                          <dd className="mb-0 mt-1 text-break">{detailRow.allocationNotes?.trim() || '—'}</dd>
                        </div>
                      </dl>
                      <h6 className="text-uppercase small fw-bold text-secondary">Linked gift</h6>
                      <dl className="row small mb-0">
                        <div className="col-sm-6 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Donation ID</dt>
                          <dd className="mb-0 mt-1">{detailRow.donationId}</dd>
                        </div>
                        <div className="col-sm-6 py-2 border-bottom">
                          <dt className="text-uppercase fw-semibold text-muted" style={{ fontSize: 10, letterSpacing: '0.04em' }}>Supporter</dt>
                          <dd className="mb-0 mt-1">{supporterLabel(detailRow)}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="modal-footer border-top">
                      <button type="button" className="btn btn-primary" onClick={() => setDetailRow(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
