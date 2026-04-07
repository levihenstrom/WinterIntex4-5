import { useState, useMemo } from 'react';

/* ── Types ───────────────────────────────────────────────────── */
type ContribType = 'Monetary' | 'In-Kind' | 'Time' | 'Skills' | 'Social Media';

interface Contribution {
  donationId: number;
  supporterName: string;
  type: ContribType;
  amount: number;
  inKindDescription?: string;
  hours?: number;
  platform?: string;
  date: string;
  safehouse: string;
  programArea: string;
  notes?: string;
}

/* ── Mock Data ───────────────────────────────────────────────── */
const INITIAL_CONTRIBUTIONS: Contribution[] = [
  { donationId: 1,  supporterName: 'Carlos Méndez',    type: 'Monetary',     amount: 5000,  date: '2025-03-01', safehouse: 'Safehouse A', programArea: 'Medical Care',      notes: 'Annual pledge installment.' },
  { donationId: 2,  supporterName: 'María López',      type: 'Monetary',     amount: 500,   date: '2025-02-10', safehouse: 'Safehouse B', programArea: 'Education' },
  { donationId: 3,  supporterName: 'Laura Estrada',    type: 'In-Kind',      amount: 0,     date: '2025-02-28', safehouse: 'Safehouse A', programArea: 'Resident Welfare',  inKindDescription: '40 hygiene kits, 20 blankets' },
  { donationId: 4,  supporterName: 'Ana Cifuentes',    type: 'Time',         amount: 0,     date: '2025-03-15', safehouse: 'Safehouse C', programArea: 'Legal Aid',         hours: 8,  notes: 'Legal orientation session.' },
  { donationId: 5,  supporterName: 'Roberto Palma',    type: 'Skills',       amount: 0,     date: '2025-01-22', safehouse: 'General',     programArea: 'Operations',        hours: 12, notes: 'IT infrastructure setup.' },
  { donationId: 6,  supporterName: 'Miguel Torres',    type: 'Social Media', amount: 0,     date: '2025-03-20', safehouse: 'General',     programArea: 'Outreach',          platform: 'Instagram', notes: 'Fundraising campaign. Reached 4,200 users.' },
  { donationId: 7,  supporterName: 'Claudia Morales',  type: 'Monetary',     amount: 3000,  date: '2025-01-30', safehouse: 'Safehouse B', programArea: 'Food & Nutrition' },
  { donationId: 8,  supporterName: 'Patricia Vásquez', type: 'In-Kind',      amount: 0,     date: '2025-02-14', safehouse: 'Safehouse A', programArea: 'Resident Welfare',  inKindDescription: 'Monthly grocery drive — 60 food boxes' },
  { donationId: 9,  supporterName: 'Diego Fuentes',    type: 'Time',         amount: 0,     date: '2025-03-10', safehouse: 'Safehouse C', programArea: 'Operations',        hours: 6,  notes: 'Transportation for medical appointments.' },
  { donationId: 10, supporterName: 'Carlos Méndez',    type: 'Monetary',     amount: 10000, date: '2024-12-15', safehouse: 'General',     programArea: 'Emergency Fund',    notes: 'Year-end major gift.' },
  { donationId: 11, supporterName: 'María López',      type: 'Monetary',     amount: 500,   date: '2025-01-10', safehouse: 'Safehouse B', programArea: 'Education' },
  { donationId: 12, supporterName: 'Sofía Herrera',    type: 'Skills',       amount: 0,     date: '2024-06-10', safehouse: 'General',     programArea: 'Staff Training',    hours: 16, notes: 'HR policy workshop for staff.' },
  { donationId: 13, supporterName: 'Fernando Ixcot',   type: 'Social Media', amount: 0,     date: '2025-03-22', safehouse: 'General',     programArea: 'Outreach',          platform: 'Facebook', notes: 'Shared campaign video — 1,800 views.' },
  { donationId: 14, supporterName: 'Laura Estrada',    type: 'In-Kind',      amount: 0,     date: '2024-12-05', safehouse: 'Safehouse A', programArea: 'Resident Welfare',  inKindDescription: '30 winter jackets, 15 backpacks' },
  { donationId: 15, supporterName: 'Claudia Morales',  type: 'Monetary',     amount: 2500,  date: '2025-03-05', safehouse: 'Safehouse C', programArea: 'Psychosocial Care' },
];

/* ── Config ──────────────────────────────────────────────────── */
const TYPE_CONFIG: Record<ContribType, { bg: string; text: string; icon: string }> = {
  'Monetary':     { bg: '#DCFCE7', text: '#166534', icon: 'currency-dollar' },
  'In-Kind':      { bg: '#FEF9C3', text: '#854D0E', icon: 'box-seam' },
  'Time':         { bg: '#DBEAFE', text: '#1E40AF', icon: 'clock' },
  'Skills':       { bg: '#F3E8FF', text: '#6B21A8', icon: 'tools' },
  'Social Media': { bg: '#FFE4E6', text: '#9F1239', icon: 'megaphone' },
};

const ALL_TYPES: ContribType[] = ['Monetary', 'In-Kind', 'Time', 'Skills', 'Social Media'];
const ALL_PROGRAMS = ['All', 'Medical Care', 'Education', 'Resident Welfare', 'Legal Aid', 'Operations', 'Outreach', 'Food & Nutrition', 'Emergency Fund', 'Staff Training', 'Psychosocial Care'];
const IC = '#1E3A5F';

function formatValue(c: Contribution): string {
  if (c.type === 'Monetary') return `$${c.amount.toLocaleString()}`;
  if (c.type === 'Time' || c.type === 'Skills') return `${c.hours ?? 0} hrs`;
  if (c.type === 'Social Media') return c.platform ?? '—';
  if (c.type === 'In-Kind') return c.inKindDescription ? c.inKindDescription.slice(0, 40) + (c.inKindDescription.length > 40 ? '…' : '') : '—';
  return '—';
}

function KPIStrip({ data }: { data: Contribution[] }) {
  const monetary = data.filter(c => c.type === 'Monetary').reduce((s, c) => s + c.amount, 0);
  const inKind   = data.filter(c => c.type === 'In-Kind').length;
  const hours    = data.filter(c => c.type === 'Time' || c.type === 'Skills').reduce((s, c) => s + (c.hours ?? 0), 0);
  const social   = data.filter(c => c.type === 'Social Media').length;

  const kpis = [
    { label: 'Monetary Received',  value: `$${monetary.toLocaleString()}`, icon: 'currency-dollar' },
    { label: 'In-Kind Donations',  value: `${inKind} donations`,           icon: 'box-seam' },
    { label: 'Volunteer Hours',    value: `${hours} hrs`,                  icon: 'clock' },
    { label: 'Social Media Posts', value: `${social} posts`,              icon: 'megaphone' },
    { label: 'Total Records',      value: String(data.length),             icon: 'bar-chart' },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      {kpis.map(({ label, value, icon }) => (
        <div key={label} style={{ flex: '1 1 140px', background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)' }}>
          <i className={`bi bi-${icon}`} style={{ fontSize: 18, color: IC, display: 'block', marginBottom: 6 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F' }}>{value}</div>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>(INITIAL_CONTRIBUTIONS);
  const [typeFilter, setTypeFilter]       = useState<string>('All');
  const [programFilter, setProgramFilter] = useState<string>('All');
  const [search, setSearch]               = useState('');
  const [showForm, setShowForm]           = useState(false);
  const [form, setForm] = useState({
    supporterName: '', type: 'Monetary' as ContribType, amount: '',
    inKindDescription: '', hours: '', platform: '',
    date: new Date().toISOString().slice(0, 10),
    safehouse: 'Safehouse A', programArea: 'Medical Care', notes: '',
  });

  const filtered = useMemo(() => contributions.filter(c => {
    const matchType    = typeFilter === 'All' || c.type === typeFilter;
    const matchProgram = programFilter === 'All' || c.programArea === programFilter;
    const q = search.toLowerCase();
    const matchSearch  = !q || c.supporterName.toLowerCase().includes(q) || c.programArea.toLowerCase().includes(q);
    return matchType && matchProgram && matchSearch;
  }), [contributions, typeFilter, programFilter, search]);

  function handleDelete(id: number) {
    setContributions(prev => prev.filter(c => c.donationId !== id));
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newId = Math.max(...contributions.map(c => c.donationId)) + 1;
    setContributions(prev => [...prev, {
      donationId: newId,
      supporterName: form.supporterName,
      type: form.type,
      amount: Number(form.amount) || 0,
      inKindDescription: form.inKindDescription || undefined,
      hours: form.hours ? Number(form.hours) : undefined,
      platform: form.platform || undefined,
      date: form.date,
      safehouse: form.safehouse,
      programArea: form.programArea,
      notes: form.notes || undefined,
    }]);
    setForm({ supporterName: '', type: 'Monetary', amount: '', inKindDescription: '', hours: '', platform: '', date: new Date().toISOString().slice(0, 10), safehouse: 'Safehouse A', programArea: 'Medical Care', notes: '' });
    setShowForm(false);
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Donors & Contributions</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>Donation & Contribution Activity</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>All monetary, in-kind, time, skills, and social media contributions recorded for the organization.</p>
        </div>

        <KPIStrip data={contributions} />

        {/* Filters */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.05)', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94A3B8', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search by supporter or program…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 14px 8px 30px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }} />
          </div>
          <select value={programFilter} onChange={e => setProgramFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            {ALL_PROGRAMS.map(p => <option key={p} value={p}>{p === 'All' ? 'All Programs' : p}</option>)}
          </select>
          <button onClick={() => setShowForm(v => !v)} style={{ background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className={`bi bi-${showForm ? 'x' : 'plus'}`} />
            {showForm ? 'Cancel' : 'Record Contribution'}
          </button>
          <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>{filtered.length} records</span>
        </div>

        {/* Type pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {(['All', ...ALL_TYPES] as string[]).map(t => {
            const cfg = t !== 'All' ? TYPE_CONFIG[t as ContribType] : null;
            return (
              <button key={t} onClick={() => setTypeFilter(t)} style={{ border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: typeFilter === t ? (cfg?.bg ?? '#1E3A5F') : '#E2E8F0', color: typeFilter === t ? (cfg?.text ?? '#fff') : '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                {cfg && typeFilter === t && <i className={`bi bi-${cfg.icon}`} style={{ fontSize: 12 }} />}
                {t === 'All' ? 'All Types' : t}
              </button>
            );
          })}
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #CBD5E1', marginBottom: 24, boxShadow: '0 4px 16px rgba(30,58,95,0.08)' }}>
            <h5 style={{ fontFamily: 'Poppins,sans-serif', color: '#1E3A5F', fontWeight: 700, marginBottom: 16 }}>Record New Contribution</h5>
            <form onSubmit={handleAddSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Supporter Name *</label>
                  <input required value={form.supporterName} onChange={e => setForm(f => ({ ...f, supporterName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Type *</label>
                  <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContribType }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
                    {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Date *</label>
                  <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                {form.type === 'Monetary' && (
                  <div className="col-md-4">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Amount (USD)</label>
                    <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                  </div>
                )}
                {form.type === 'In-Kind' && (
                  <div className="col-md-8">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
                    <input value={form.inKindDescription} onChange={e => setForm(f => ({ ...f, inKindDescription: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                  </div>
                )}
                {(form.type === 'Time' || form.type === 'Skills') && (
                  <div className="col-md-4">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Hours</label>
                    <input type="number" min="0" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                  </div>
                )}
                {form.type === 'Social Media' && (
                  <div className="col-md-4">
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Platform</label>
                    <input value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                  </div>
                )}
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Safehouse</label>
                  <select value={form.safehouse} onChange={e => setForm(f => ({ ...f, safehouse: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
                    <option>Safehouse A</option><option>Safehouse B</option><option>Safehouse C</option><option>General</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Program Area</label>
                  <select value={form.programArea} onChange={e => setForm(f => ({ ...f, programArea: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
                    {ALL_PROGRAMS.filter(p => p !== 'All').map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-12">
                  <button type="submit" style={{ background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Save Contribution</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <i className="bi bi-search" style={{ fontSize: 36, display: 'block', marginBottom: 10, color: '#CBD5E1' }} />
              <p style={{ fontWeight: 600 }}>No contributions match your filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['Supporter', 'Type', 'Value', 'Program Area', 'Safehouse', 'Date', 'Notes', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const cfg = TYPE_CONFIG[c.type];
                    return (
                      <tr key={c.donationId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E3A5F', whiteSpace: 'nowrap' }}>{c.supporterName}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: cfg.bg, color: cfg.text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                            <i className={`bi bi-${cfg.icon}`} style={{ fontSize: 11 }} />{c.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#166534', fontWeight: 600 }}>{formatValue(c)}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{c.programArea}</td>
                        <td style={{ padding: '12px 16px', color: '#64748B' }}>{c.safehouse}</td>
                        <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes ?? '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => handleDelete(c.donationId)} style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, color: '#DC2626', fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                            <i className="bi bi-trash3" style={{ fontSize: 11 }} />Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <i className="bi bi-layers" style={{ fontSize: 12, color: '#CBD5E1' }} />Showing {filtered.length} of {contributions.length} contributions
        </div>
      </div>
    </div>
  );
}
