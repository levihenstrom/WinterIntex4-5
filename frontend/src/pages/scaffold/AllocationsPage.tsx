import { useEffect, useMemo, useState } from 'react';
import { deleteJson, fetchAllPaged, postJson, putJson } from '../../lib/apiClient';
import AdminKpiStrip from '../../components/admin/AdminKpiStrip';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { ErrorState, LoadingState } from '../../components/common/AsyncStatus';
import { useAuth } from '../../context/AuthContext';
import { formatAmountMaybePhpAndUsd } from '../../lib/currency';
import 'bootstrap-icons/font/bootstrap-icons.css';

interface DonationAllocationRow {
  allocationId: number;
  donationId: number;
  safehouseId: number;
  amountAllocated?: number | null;
  programArea?: string | null;
  allocationDate?: string | null;
  allocationNotes?: string | null;
  donation?: {
    supporter?: { displayName?: string | null; organizationName?: string | null } | null;
  } | null;
  safehouse?: { name?: string | null; safehouseCode?: string | null } | null;
}

interface SafehouseOption {
  safehouseId: number;
  name?: string | null;
  safehouseCode?: string | null;
}

interface AllocForm {
  safehouseId: number;
  donationId: number;
  programArea: string;
  amountAllocated: string;
  allocationDate: string;
  allocationNotes: string;
}

/** Strip "Lighthouse " prefix for display. */
const fmt = (name: string | null | undefined): string =>
  (name ?? '').replace(/^Lighthouse\s+/i, '') || name || '—';

function fmtMoney(amount: number | null | undefined): string {
  return formatAmountMaybePhpAndUsd(amount);
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

function emptyForm(): AllocForm {
  return { safehouseId: 0, donationId: 0, programArea: '', amountAllocated: '', allocationDate: '', allocationNotes: '' };
}

function rowToForm(a: DonationAllocationRow): AllocForm {
  return {
    safehouseId: a.safehouseId,
    donationId: a.donationId,
    programArea: a.programArea ?? '',
    amountAllocated: a.amountAllocated != null ? String(a.amountAllocated) : '',
    allocationDate: a.allocationDate ? a.allocationDate.split('T')[0] : '',
    allocationNotes: a.allocationNotes ?? '',
  };
}

export default function AllocationsPage() {
  const { authSession } = useAuth();
  const isAdmin = authSession.roles.includes('Admin');

  const PAGE_SIZE = 20;
  const [rows, setRows] = useState<DonationAllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [safehouseFilter, setSafehouseFilter] = useState('All');
  const [programFilter, setProgramFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [detailRow, setDetailRow] = useState<DonationAllocationRow | null>(null);
  const [page, setPage] = useState(1);

  // CRUD state (admin only)
  const [editTarget, setEditTarget] = useState<DonationAllocationRow | 'new' | null>(null);
  const [form, setForm] = useState<AllocForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DonationAllocationRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const safehouses = useMemo<SafehouseOption[]>(() => {
    const map = new Map<number, SafehouseOption>();
    for (const a of rows) {
      if (a.safehouseId && !map.has(a.safehouseId)) {
        map.set(a.safehouseId, { safehouseId: a.safehouseId, name: a.safehouse?.name, safehouseCode: a.safehouse?.safehouseCode });
      }
    }
    return Array.from(map.values()).sort((x, y) => x.safehouseId - y.safehouseId);
  }, [rows]);

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
  }, [reloadToken]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => { setPage(1); }, [safehouseFilter, programFilter, search]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

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
    return { totalPhp, count: rows.length, safehouses: sh.size, programs: pr.size };
  }, [rows]);

  useEffect(() => {
    if (!detailRow) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailRow(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailRow]);

  useEffect(() => {
    if (!editTarget) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditTarget(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editTarget]);

  function openNew() {
    setForm(emptyForm());
    setFormError(null);
    setEditTarget('new');
  }

  function openEdit(a: DonationAllocationRow) {
    setForm(rowToForm(a));
    setFormError(null);
    setEditTarget(a);
    setDetailRow(null);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        safehouseId: Number(form.safehouseId),
        donationId: Number(form.donationId),
        programArea: form.programArea || null,
        amountAllocated: form.amountAllocated ? Number(form.amountAllocated) : null,
        allocationDate: form.allocationDate || null,
        allocationNotes: form.allocationNotes || null,
      };
      if (editTarget === 'new') {
        await postJson('/api/donation-allocations', payload);
      } else if (editTarget) {
        await putJson(`/api/donation-allocations/${editTarget.allocationId}`, {
          ...payload,
          allocationId: editTarget.allocationId,
        });
      }
      setEditTarget(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteJson(`/api/donation-allocations/${deleteTarget.allocationId}`);
      setDeleteTarget(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleteBusy(false);
    }
  }

  const isEditing = editTarget !== 'new' && editTarget !== null;

  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">
        <div className="mb-5 d-flex align-items-start justify-content-between gap-3 flex-wrap">
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
              Donors &amp; Contributions
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
              Donation allocations
            </h1>
            <p className="text-muted mb-0" style={{ fontSize: 14 }}>
              Live data from your database: gifts routed to safehouses and program areas (staff scope applies).
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-sm fw-semibold flex-shrink-0"
              style={{ background: 'var(--hw-purple)', color: 'white', borderRadius: 8, marginTop: 28 }}
              onClick={openNew}
            >
              <i className="bi bi-plus-lg me-1" />
              New Allocation
            </button>
          )}
        </div>

        {loading && <LoadingState message="Loading allocations…" />}
        {error && <ErrorState message={error} />}

        {!loading && !error && (
          <>
            <AdminKpiStrip
              items={[
                { label: 'Total allocated (USD)', value: fmtMoney(allocationKpis.totalPhp), sub: 'all loaded rows', accent: '#059669', icon: 'cash-stack' },
                { label: 'Allocation rows', value: String(allocationKpis.count), accent: '#1E3A5F', icon: 'list-ul' },
                { label: 'Sites', value: String(allocationKpis.safehouses), sub: 'distinct safehouses', accent: '#0D9488', icon: 'building' },
                { label: 'Program areas', value: String(allocationKpis.programs), sub: 'distinct labels', accent: '#7C3AED', icon: 'diagram-3' },
              ]}
            />

            {/* By safehouse — horizontal bar chart, click to filter table */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h6 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, color: '#1E3A5F', margin: 0 }}>Allocation by safehouse</h6>
                {safehouseFilter !== 'All' && (
                  <button onClick={() => setSafehouseFilter('All')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
                    Clear filter ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bySafehouse.map(([name, total]) => {
                  const grand = bySafehouse.reduce((s, x) => s + x[1], 0);
                  const pct = grand > 0 ? Math.round((total / grand) * 100) : 0;
                  const isActive = safehouseFilter === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => { setSafehouseFilter(isActive ? 'All' : name); setPage(1); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ fontWeight: isActive ? 700 : 600, color: isActive ? '#0D9488' : '#475569' }}>{fmt(name)}</span>
                        <span style={{ color: '#1E3A5F', fontWeight: 700 }}>
                          {fmtMoney(total)} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div style={{ background: '#F1F5F9', borderRadius: 4, height: 10, overflow: 'hidden', border: isActive ? '1.5px solid #0D9488' : 'none' }}>
                        <div style={{ background: isActive ? 'linear-gradient(90deg, #0D9488, #059669)' : 'linear-gradient(90deg, var(--hw-purple, #6B21A8), #1E3A5F)', width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)', marginBottom: 24 }}>
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
                boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
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
                    {s === 'All' ? 'All safehouses' : fmt(s)}
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
                <strong style={{ color: '#1E3A5F' }}>{fmtMoney(totalFiltered)}</strong> filtered · page {page} of {totalPages}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)', overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
                  <p style={{ fontWeight: 600 }}>No allocations match your filters.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        {['Donation #', 'Supporter', 'Amount', 'Site', 'Program', 'Allocated on', 'Notes', ...(isAdmin ? [''] : [])].map((h) => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((a, i) => (
                        <tr
                          key={a.allocationId}
                          tabIndex={0}
                          title="View allocation details"
                          style={{
                            background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                          }}
                          onClick={() => setDetailRow(a)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailRow(a); }
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#6B21A8', fontSize: 12 }}>{a.donationId}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E3A5F' }}>{supporterLabel(a)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#166534' }}>
                            {fmtMoney(Number(a.amountAllocated ?? 0))}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{fmt(a.safehouse?.name ?? a.safehouse?.safehouseCode)}</td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{a.programArea ?? '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>
                            {a.allocationDate
                              ? new Date(a.allocationDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 11, maxWidth: 220 }}>{a.allocationNotes ?? '—'}</td>
                          {isAdmin && (
                            <td
                              style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1"
                                title="Edit"
                                onClick={() => openEdit(a)}
                              >
                                <i className="bi bi-pencil" style={{ color: '#64748B' }} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1"
                                title="Delete"
                                onClick={() => setDeleteTarget(a)}
                              >
                                <i className="bi bi-trash" style={{ color: '#dc2626' }} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3">
              <div style={{ fontSize: 12, color: '#94A3B8' }}>
                Showing {pageRows.length} of {filtered.length} filtered allocation rows
              </div>
              {filtered.length > 0 && (
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: 12, color: '#64748B', minWidth: 120, textAlign: 'center' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Detail modal */}
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
                          <dd className="mb-0 mt-1">{fmt(detailRow.safehouse?.name ?? detailRow.safehouse?.safehouseCode)}</dd>
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
                      {isAdmin && (
                        <button type="button" className="btn btn-primary" onClick={() => openEdit(detailRow)}>
                          Edit
                        </button>
                      )}
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailRow(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit / New Allocation modal */}
            {editTarget !== null && (
              <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true" aria-labelledby="allocEditTitle">
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                  <div className="modal-content">
                    <div className="modal-header border-bottom">
                      <h5 className="modal-title fw-bold text-dark mb-0" id="allocEditTitle">
                        {isEditing ? 'Edit allocation' : 'New allocation'}
                      </h5>
                      <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditTarget(null)} />
                    </div>
                    <div className="modal-body">
                      {formError && <div className="alert alert-danger small">{formError}</div>}
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Safehouse</label>
                          {safehouses.length > 0 ? (
                            <select
                              className="form-select form-select-sm"
                              value={form.safehouseId}
                              onChange={(e) => setForm((f) => ({ ...f, safehouseId: Number(e.target.value) }))}
                            >
                              <option value={0}>Select…</option>
                              {safehouses.map((s) => (
                                <option key={s.safehouseId} value={s.safehouseId}>
                                  {fmt(s.name ?? s.safehouseCode)} (ID {s.safehouseId})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="Safehouse ID"
                              value={form.safehouseId || ''}
                              onChange={(e) => setForm((f) => ({ ...f, safehouseId: Number(e.target.value) }))}
                            />
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Donation ID</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="e.g. 42"
                            value={form.donationId || ''}
                            onChange={(e) => setForm((f) => ({ ...f, donationId: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Program area</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Education"
                            value={form.programArea}
                            onChange={(e) => setForm((f) => ({ ...f, programArea: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Amount allocated</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="e.g. 5000"
                            value={form.amountAllocated}
                            onChange={(e) => setForm((f) => ({ ...f, amountAllocated: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold small">Allocation date</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={form.allocationDate}
                            onChange={(e) => setForm((f) => ({ ...f, allocationDate: e.target.value }))}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label fw-semibold small">Notes</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={3}
                            value={form.allocationNotes}
                            onChange={(e) => setForm((f) => ({ ...f, allocationNotes: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer border-top">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                      <button
                        type="button"
                        className="btn btn-primary px-4"
                        onClick={() => void handleSave()}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create allocation'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `allocation #${deleteTarget.allocationId}` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
