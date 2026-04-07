import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteJson, fetchAllPaged, postJson } from '../../lib/apiClient';

interface SupporterOpt {
  supporterId: number;
  displayName?: string | null;
  organizationName?: string | null;
}

interface DonationRow {
  donationId: number;
  supporterId: number;
  donationType?: string | null;
  donationDate?: string | null;
  amount?: number | null;
  estimatedValue?: number | null;
  currencyCode?: string | null;
  campaignName?: string | null;
  channelSource?: string | null;
  notes?: string | null;
  impactUnit?: string | null;
  supporter?: SupporterOpt | null;
}

function fmtMoney(n: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

function supporterName(s: SupporterOpt | null | undefined): string {
  if (!s) return '—';
  return (s.displayName ?? s.organizationName ?? `#${s.supporterId}`).trim();
}

export default function ContributionsPage() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [supporters, setSupporters] = useState<SupporterOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supporterId: '',
    donationType: 'Monetary',
    amount: '',
    donationDate: new Date().toISOString().slice(0, 10),
    campaignName: '',
    notes: '',
    currencyCode: 'PHP',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRows, sRows] = await Promise.all([
        fetchAllPaged<DonationRow>('/api/donations', 200),
        fetchAllPaged<SupporterOpt>('/api/supporters', 500),
      ]);
      setDonations(dRows);
      setSupporters(sRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const d of donations) {
      if (d.donationType) set.add(d.donationType);
    }
    return ['All', ...Array.from(set).sort()];
  }, [donations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return donations.filter((d) => {
      const matchType = typeFilter === 'All' || (d.donationType ?? '') === typeFilter;
      const name = supporterName(d.supporter ?? undefined).toLowerCase();
      const matchSearch =
        !q ||
        name.includes(q) ||
        (d.campaignName ?? '').toLowerCase().includes(q) ||
        String(d.donationId).includes(q);
      return matchType && matchSearch;
    });
  }, [donations, typeFilter, search]);

  const kpis = useMemo(() => {
    const monetary = donations.filter((d) => d.donationType === 'Monetary');
    const sum = monetary.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    return {
      monetarySum: sum,
      count: donations.length,
      monetaryCount: monetary.length,
    };
  }, [donations]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const sid = Number(form.supporterId);
    if (!Number.isFinite(sid) || sid < 1) {
      setError('Select a supporter.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await postJson<DonationRow>('/api/donations', {
        supporterId: sid,
        donationType: form.donationType,
        donationDate: form.donationDate ? new Date(form.donationDate).toISOString() : new Date().toISOString(),
        amount: form.donationType === 'Monetary' ? Number(form.amount) : null,
        estimatedValue:
          form.donationType === 'Monetary'
            ? Number(form.amount)
            : form.amount
              ? Number(form.amount)
              : null,
        currencyCode: form.currencyCode,
        campaignName: form.campaignName || null,
        notes: form.notes || null,
        isRecurring: false,
        channelSource: 'AdminPortal',
      });
      setShowForm(false);
      setForm({
        supporterId: '',
        donationType: 'Monetary',
        amount: '',
        donationDate: new Date().toISOString().slice(0, 10),
        campaignName: '',
        notes: '',
        currencyCode: 'PHP',
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this contribution record?')) return;
    try {
      await deleteJson(`/api/donations/${id}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>
            Donors &amp; Contributions
          </span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
            Contribution activity
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
            Monetary, in-kind, time, and other gift types stored in the database (same data as reports and donor history).
          </p>
        </div>

        {loading && <p className="text-muted">Loading contributions…</p>}
        {error && (
          <div className="alert alert-warning" role="alert">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              {[
                { label: 'Monetary (PHP)', value: fmtMoney(kpis.monetarySum), icon: '💵', color: '#166534' },
                { label: 'All gifts', value: String(kpis.count), icon: '📋', color: '#1E3A5F' },
                { label: 'Monetary rows', value: String(kpis.monetaryCount), icon: '💰', color: '#854D0E' },
              ].map((k) => (
                <div
                  key={k.label}
                  style={{
                    flex: '1 1 140px',
                    background: '#fff',
                    borderRadius: 12,
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{k.label}</div>
                </div>
              ))}
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
                placeholder="Search supporter, campaign, or ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: '1 1 200px', padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                style={{
                  background: '#1E3A5F',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {showForm ? 'Cancel' : '+ Record contribution'}
              </button>
              <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>{filtered.length} rows</span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  style={{
                    border: 'none',
                    borderRadius: 20,
                    padding: '5px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: typeFilter === t ? '#1E3A5F' : '#E2E8F0',
                    color: typeFilter === t ? '#fff' : '#475569',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {showForm && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 24,
                  border: '1px solid #CBD5E1',
                  marginBottom: 24,
                  boxShadow: '0 4px 16px rgba(30,58,95,0.08)',
                }}
              >
                <h5 style={{ fontFamily: 'Poppins,sans-serif', color: '#1E3A5F', fontWeight: 700, marginBottom: 16 }}>
                  New contribution
                </h5>
                <form onSubmit={handleAdd}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="small fw-semibold text-secondary d-block mb-1">Supporter *</label>
                      <select
                        required
                        className="form-select form-select-sm"
                        value={form.supporterId}
                        onChange={(e) => setForm((f) => ({ ...f, supporterId: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {supporters.map((s) => (
                          <option key={s.supporterId} value={String(s.supporterId)}>
                            {supporterName(s)} (#{s.supporterId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="small fw-semibold text-secondary d-block mb-1">Type *</label>
                      <select
                        required
                        className="form-select form-select-sm"
                        value={form.donationType}
                        onChange={(e) => setForm((f) => ({ ...f, donationType: e.target.value }))}
                      >
                        {['Monetary', 'InKind', 'Time', 'Skills', 'SocialMedia'].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="small fw-semibold text-secondary d-block mb-1">Date *</label>
                      <input
                        required
                        type="date"
                        className="form-control form-control-sm"
                        value={form.donationDate}
                        onChange={(e) => setForm((f) => ({ ...f, donationDate: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="small fw-semibold text-secondary d-block mb-1">Amount / value</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={form.amount}
                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder={form.donationType === 'Monetary' ? 'PHP' : 'Units or hours'}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="small fw-semibold text-secondary d-block mb-1">Campaign</label>
                      <input
                        className="form-control form-control-sm"
                        value={form.campaignName}
                        onChange={(e) => setForm((f) => ({ ...f, campaignName: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="small fw-semibold text-secondary d-block mb-1">Notes</label>
                      <input
                        className="form-control form-control-sm"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <button
                        type="submit"
                        className="btn btn-sm text-white"
                        style={{ background: '#0D9488', border: 'none' }}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save to database'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-sm table-hover mb-0" style={{ fontSize: 13 }}>
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Supporter</th>
                      <th>Type</th>
                      <th>Amount / est.</th>
                      <th>Campaign</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.donationId}>
                        <td className="text-muted">{d.donationId}</td>
                        <td>
                          {d.donationDate
                            ? new Date(d.donationDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="fw-semibold">{supporterName(d.supporter ?? undefined)}</td>
                        <td>{d.donationType ?? '—'}</td>
                        <td>
                          {d.amount != null ? fmtMoney(Number(d.amount), d.currencyCode ?? 'PHP') : d.estimatedValue != null ? String(d.estimatedValue) : '—'}
                        </td>
                        <td>{d.campaignName ?? '—'}</td>
                        <td>
                          <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => void handleDelete(d.donationId)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
