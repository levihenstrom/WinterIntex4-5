import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteJson, fetchAllPaged, postJson, putJson } from '../../lib/apiClient';
import AdminKpiStrip from '../../components/admin/AdminKpiStrip';
import 'bootstrap-icons/font/bootstrap-icons.css';

/* ── API shape (camelCase from ASP.NET) ─────────────────────── */
interface SupporterApi {
  supporterId: number;
  supporterType?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  country?: string | null;
  status?: string | null;
  createdAt?: string | null;
  firstDonationDate?: string | null;
  relationshipType?: string | null;
  acquisitionChannel?: string | null;
}

interface DonationLite {
  supporterId: number;
  donationType?: string | null;
  amount?: number | null;
  donationDate?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  MonetaryDonor: 'Monetary Donor',
  Volunteer: 'Volunteer',
  InKindDonor: 'In-Kind Donor',
  SocialMediaAdvocate: 'Social Media Supporter',
  PartnerOrganization: 'Partner Organization',
};

const TYPE_ORDER = ['MonetaryDonor', 'Volunteer', 'InKindDonor', 'SocialMediaAdvocate', 'PartnerOrganization'];

/* ── Color helpers ───────────────────────────────────────────── */
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  MonetaryDonor: { bg: '#DCFCE7', text: '#166534' },
  Volunteer: { bg: '#DBEAFE', text: '#1E40AF' },
  InKindDonor: { bg: '#FEF9C3', text: '#854D0E' },
  SocialMediaAdvocate: { bg: '#FFE4E6', text: '#9F1239' },
  PartnerOrganization: { bg: '#F3E8FF', text: '#6B21A8' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active: { bg: '#DCFCE7', text: '#166534' },
  Inactive: { bg: '#F1F5F9', text: '#64748B' },
};

function labelForType(t: string | null | undefined): string {
  if (!t) return 'Supporter';
  return TYPE_LABEL[t] ?? t;
}

function fmtMoneyPhp(n: number) {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `PHP ${n.toFixed(0)}`;
  }
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: text,
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </span>
  );
}

function SupporterKpiStrip({
  supporters,
  monetaryTotalPhp,
}: {
  supporters: SupporterApi[];
  monetaryTotalPhp: number;
}) {
  const active = supporters.filter((s) => s.status === 'Active').length;
  const monetary = supporters.filter((s) => s.supporterType === 'MonetaryDonor').length;
  const volunteers = supporters.filter((s) => s.supporterType === 'Volunteer').length;
  return (
    <AdminKpiStrip
      items={[
        { label: 'Total supporters', value: String(supporters.length), accent: '#1E3A5F', icon: 'people' },
        { label: 'Active', value: String(active), sub: 'status in database', accent: '#059669', icon: 'person-check' },
        { label: 'Monetary donors', value: String(monetary), accent: '#0D9488', icon: 'cash-stack' },
        { label: 'Volunteers', value: String(volunteers), accent: '#2563EB', icon: 'heart' },
        { label: 'Monetary gifts (PHP)', value: fmtMoneyPhp(monetaryTotalPhp), sub: 'loaded gifts total', accent: '#7C3AED', icon: 'wallet2' },
      ]}
    />
  );
}

type FormState = {
  supporterId?: number;
  displayName: string;
  organizationName: string;
  email: string;
  phone: string;
  region: string;
  country: string;
  supporterType: string;
  status: string;
};

const emptyForm: FormState = {
  displayName: '',
  organizationName: '',
  email: '',
  phone: '',
  region: '',
  country: 'Philippines',
  supporterType: 'MonetaryDonor',
  status: 'Active',
};

/* ── Main Page ───────────────────────────────────────────────── */
export default function SupportersListPage() {
  const [supporters, setSupporters] = useState<SupporterApi[]>([]);
  const [monetaryTotalPhp, setMonetaryTotalPhp] = useState(0);
  const [bySupporter, setBySupporter] = useState<Map<number, { totalPhp: number; lastGift: string | null }>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  /** Full row from API when editing — merged into PUT so we do not null optional columns. */
  const [editSource, setEditSource] = useState<SupporterApi | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sups, dons] = await Promise.all([
        fetchAllPaged<SupporterApi>('/api/supporters', 200),
        fetchAllPaged<DonationLite>('/api/donations', 200),
      ]);
      setSupporters(sups);

      let sum = 0;
      const agg = new Map<number, { totalPhp: number; lastGift: string | null }>();
      for (const d of dons) {
        if (d.donationType === 'Monetary' && d.amount != null) {
          const a = Number(d.amount);
          sum += a;
          const cur = agg.get(d.supporterId) ?? { totalPhp: 0, lastGift: null };
          cur.totalPhp += a;
          const dt = d.donationDate;
          if (dt && (!cur.lastGift || new Date(dt) > new Date(cur.lastGift))) cur.lastGift = dt;
          agg.set(d.supporterId, cur);
        }
      }
      setMonetaryTotalPhp(sum);
      setBySupporter(agg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load supporters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(
    () =>
      supporters.filter((s) => {
        const matchType = typeFilter === 'All' || (s.supporterType ?? '') === typeFilter;
        const matchStatus = statusFilter === 'All' || (s.status ?? '') === statusFilter;
        const q = search.toLowerCase();
        const name = (s.displayName ?? '').toLowerCase();
        const org = (s.organizationName ?? '').toLowerCase();
        const em = (s.email ?? '').toLowerCase();
        const matchSearch = !q || name.includes(q) || org.includes(q) || em.includes(q);
        return matchType && matchStatus && matchSearch;
      }),
    [supporters, typeFilter, statusFilter, search],
  );

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this supporter? Linked donations may block this action.')) return;
    try {
      await deleteJson(`/api/supporters/${id}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleSaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (form.supporterId) {
        const merged: SupporterApi = {
          ...editSource,
          supporterId: form.supporterId,
          supporterType: form.supporterType,
          displayName: form.displayName.trim() || null,
          organizationName: form.organizationName.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          region: form.region.trim() || null,
          country: form.country.trim() || null,
          status: form.status,
        };
        await putJson(`/api/supporters/${form.supporterId}`, merged);
      } else {
        await postJson<SupporterApi>('/api/supporters', {
          supporterType: form.supporterType,
          displayName: form.displayName.trim() || null,
          organizationName: form.organizationName.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          region: form.region.trim() || null,
          country: form.country.trim() || null,
          status: form.status,
          relationshipType: 'Local',
          acquisitionChannel: 'AdminPortal',
        });
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditSource(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(s: SupporterApi) {
    setEditSource({ ...s });
    setForm({
      supporterId: s.supporterId,
      displayName: s.displayName ?? '',
      organizationName: s.organizationName ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      region: s.region ?? '',
      country: s.country ?? 'Philippines',
      supporterType: s.supporterType ?? 'MonetaryDonor',
      status: s.status ?? 'Active',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditSource(null);
    setShowForm(false);
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">
        <div style={{ marginBottom: 28 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#0D9488',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Donors &amp; Contributions
          </span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
            Supporter Profiles
          </h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
            Data from the database (same records used in donations and allocations).
          </p>
        </div>

        {loading && <p className="text-muted">Loading supporters…</p>}
        {error && (
          <div className="alert alert-warning" role="alert">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <SupporterKpiStrip supporters={supporters} monetaryTotalPhp={monetaryTotalPhp} />

            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '16px 20px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(30,58,95,0.05)',
                marginBottom: 24,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                placeholder="Search by name, org or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: '1 1 220px',
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}
              >
                <option value="All">All Types</option>
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {labelForType(t)}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (showForm) resetForm();
                  else setShowForm(true);
                }}
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
                {showForm ? 'Cancel' : 'New supporter'}
              </button>
              <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
                {filtered.length} of {supporters.length} supporters
              </span>
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
                  {form.supporterId ? 'Edit Supporter' : 'Add New Supporter'}
                </h5>
                <form onSubmit={(e) => void handleSaveSubmit(e)}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Full name *
                      </label>
                      <input
                        required
                        value={form.displayName}
                        onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-4">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Organization
                      </label>
                      <input
                        value={form.organizationName}
                        onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-4">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-3">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Phone
                      </label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-3">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Region
                      </label>
                      <input
                        value={form.region}
                        onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                        placeholder="e.g. Luzon"
                      />
                    </div>
                    <div className="col-md-3">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Country
                      </label>
                      <input
                        value={form.country}
                        onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                      />
                    </div>
                    <div className="col-md-3">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Type *
                      </label>
                      <select
                        required
                        value={form.supporterType}
                        onChange={(e) => setForm((f) => ({ ...f, supporterType: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}
                      >
                        {TYPE_ORDER.map((t) => (
                          <option key={t} value={t}>
                            {labelForType(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Status *
                      </label>
                      <select
                        required
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <button
                        type="submit"
                        disabled={saving}
                        style={{
                          background: '#0D9488',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '9px 24px',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {saving ? 'Saving…' : 'Save to database'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {['All', ...TYPE_ORDER].map((t) => (
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
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'All' ? 'All' : labelForType(t)}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
                <div className="mb-3" style={{ fontSize: 40 }}>
                  <i className="bi bi-search" style={{ color: '#CBD5E1' }} aria-hidden />
                </div>
                <p className="fw-semibold mb-1">No supporters match your filters.</p>
                <p className="small mb-0">Try clearing search or type filters.</p>
              </div>
            ) : (
              <>
                <style>{`
                  .supporter-card-netflix {
                    position: relative;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                  }
                  .supporter-card-netflix:hover {
                    transform: scale(1.03);
                    z-index: 2;
                    box-shadow: 0 12px 32px rgba(30, 58, 95, 0.14);
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .supporter-card-netflix {
                      transition: box-shadow 0.2s ease;
                    }
                    .supporter-card-netflix:hover {
                      transform: none;
                    }
                  }
                `}</style>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {filtered.map((s) => {
                  const st = s.supporterType ?? '';
                  const tc = TYPE_COLORS[st] ?? { bg: '#F1F5F9', text: '#475569' };
                  const sc = STATUS_COLORS[s.status ?? ''] ?? STATUS_COLORS.Inactive;
                  const display = (s.displayName ?? 'Unknown').trim();
                  const initials = display
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const aggRow = bySupporter.get(s.supporterId);
                  return (
                    <div
                      key={s.supporterId}
                      className="supporter-card-netflix"
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        padding: 20,
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 2px 10px rgba(30,58,95,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: tc.bg,
                            color: tc.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 15,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: '#1E3A5F',
                              fontSize: 14,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {display}
                          </div>
                          {s.organizationName && (
                            <div
                              style={{
                                fontSize: 11,
                                color: '#64748B',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {s.organizationName}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <Badge label={labelForType(s.supporterType)} bg={tc.bg} text={tc.text} />
                            <Badge label={s.status ?? '—'} bg={sc.bg} text={sc.text} />
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {s.email && (
                          <span className="text-break">
                            <i className="bi bi-envelope me-1 text-secondary" aria-hidden />
                            {s.email}
                          </span>
                        )}
                        {s.phone && (
                          <span>
                            <i className="bi bi-telephone me-1 text-secondary" aria-hidden />
                            {s.phone}
                          </span>
                        )}
                        <span>
                          <i className="bi bi-geo-alt me-1 text-secondary" aria-hidden />
                          {[s.region, s.country].filter(Boolean).join(', ') || '—'}
                        </span>
                        <span className="text-muted small">ID {s.supporterId}</span>
                        {s.createdAt && (
                          <span>
                            <i className="bi bi-calendar3 me-1 text-secondary" aria-hidden />
                            Joined{' '}
                            {new Date(s.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                        {aggRow && aggRow.totalPhp > 0 && (
                          <span style={{ color: '#166534', fontWeight: 600 }}>
                            <i className="bi bi-wallet2 me-1" aria-hidden />
                            {fmtMoneyPhp(aggRow.totalPhp)} monetary (tracked)
                          </span>
                        )}
                        {aggRow?.lastGift && (
                          <span style={{ color: '#94A3B8' }}>
                            Last gift:{' '}
                            {new Date(aggRow.lastGift).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                        {!aggRow?.lastGift && s.firstDonationDate && (
                          <span style={{ color: '#94A3B8' }}>
                            First donation:{' '}
                            {new Date(s.firstDonationDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      <div
                        style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10 }}
                        className="d-flex justify-content-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="dropdown">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary dropdown-toggle"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            aria-label={`Actions for supporter ${s.supporterId}`}
                          >
                            Actions
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li>
                              <button type="button" className="dropdown-item" onClick={() => handleEdit(s)}>
                                Edit
                              </button>
                            </li>
                            <li>
                              <hr className="dropdown-divider" />
                            </li>
                            <li>
                              <button
                                type="button"
                                className="dropdown-item text-danger"
                                onClick={() => void handleDelete(s.supporterId)}
                              >
                                Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
