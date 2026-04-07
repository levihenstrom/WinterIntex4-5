import { useState, useMemo } from 'react';

/* ── Types ───────────────────────────────────────────────────── */
type AllocStatus = 'Allocated' | 'Spent' | 'Returned';

interface Allocation {
  allocationId: number;
  donationRef: string;
  supporterName: string;
  amountUsd: number;
  safehouse: string;
  programArea: string;
  allocationDate: string;
  status: AllocStatus;
  spentDate?: string;
  notes?: string;
}

/* ── Mock Data ───────────────────────────────────────────────── */
const ALLOCATIONS: Allocation[] = [
  { allocationId: 1,  donationRef: 'DON-001', supporterName: 'Carlos Méndez',   amountUsd: 2000, safehouse: 'Safehouse A', programArea: 'Medical Care',      allocationDate: '2025-03-05', status: 'Spent',     spentDate: '2025-03-12', notes: 'Monthly clinic supplies.' },
  { allocationId: 2,  donationRef: 'DON-001', supporterName: 'Carlos Méndez',   amountUsd: 3000, safehouse: 'Safehouse B', programArea: 'Education',         allocationDate: '2025-03-05', status: 'Allocated' },
  { allocationId: 3,  donationRef: 'DON-002', supporterName: 'María López',     amountUsd: 500,  safehouse: 'Safehouse B', programArea: 'Education',         allocationDate: '2025-02-12', status: 'Spent',     spentDate: '2025-02-20', notes: 'School materials for 10 residents.' },
  { allocationId: 4,  donationRef: 'DON-007', supporterName: 'Claudia Morales', amountUsd: 1500, safehouse: 'Safehouse B', programArea: 'Food & Nutrition',  allocationDate: '2025-02-01', status: 'Spent',     spentDate: '2025-02-28' },
  { allocationId: 5,  donationRef: 'DON-007', supporterName: 'Claudia Morales', amountUsd: 1500, safehouse: 'General',     programArea: 'Operations',        allocationDate: '2025-02-01', status: 'Allocated' },
  { allocationId: 6,  donationRef: 'DON-010', supporterName: 'Carlos Méndez',   amountUsd: 4000, safehouse: 'General',     programArea: 'Emergency Fund',    allocationDate: '2024-12-18', status: 'Allocated', notes: 'Reserve for critical needs.' },
  { allocationId: 7,  donationRef: 'DON-010', supporterName: 'Carlos Méndez',   amountUsd: 3500, safehouse: 'Safehouse C', programArea: 'Psychosocial Care', allocationDate: '2024-12-18', status: 'Spent',     spentDate: '2025-01-15', notes: 'Therapy sessions — Jan batch.' },
  { allocationId: 8,  donationRef: 'DON-010', supporterName: 'Carlos Méndez',   amountUsd: 2500, safehouse: 'Safehouse A', programArea: 'Resident Welfare',  allocationDate: '2024-12-18', status: 'Spent',     spentDate: '2025-01-20' },
  { allocationId: 9,  donationRef: 'DON-011', supporterName: 'María López',     amountUsd: 500,  safehouse: 'Safehouse B', programArea: 'Education',         allocationDate: '2025-01-12', status: 'Allocated' },
  { allocationId: 10, donationRef: 'DON-015', supporterName: 'Claudia Morales', amountUsd: 2500, safehouse: 'Safehouse C', programArea: 'Psychosocial Care', allocationDate: '2025-03-07', status: 'Allocated' },
  { allocationId: 11, donationRef: 'DON-008', supporterName: 'José Ramírez',    amountUsd: 4000, safehouse: 'Safehouse A', programArea: 'Medical Care',      allocationDate: '2024-01-20', status: 'Spent',     spentDate: '2024-03-01' },
  { allocationId: 12, donationRef: 'DON-008', supporterName: 'José Ramírez',    amountUsd: 4700, safehouse: 'Safehouse B', programArea: 'Education',         allocationDate: '2024-01-20', status: 'Returned',  spentDate: '2024-06-01', notes: 'Unspent funds returned to general reserve.' },
];

const STATUS_CFG: Record<AllocStatus, { bg: string; text: string; icon: string }> = {
  Allocated: { bg: '#DBEAFE', text: '#1E40AF', icon: 'clock' },
  Spent:     { bg: '#DCFCE7', text: '#166534', icon: 'check-circle' },
  Returned:  { bg: '#FEF9C3', text: '#854D0E', icon: 'arrow-counterclockwise' },
};

const ALL_SAFEHOUSES = ['All', 'Safehouse A', 'Safehouse B', 'Safehouse C', 'General'];
const ALL_PROGRAMS   = ['All', 'Medical Care', 'Education', 'Resident Welfare', 'Legal Aid', 'Operations', 'Food & Nutrition', 'Emergency Fund', 'Psychosocial Care'];
const ALL_STATUSES: AllocStatus[] = ['Allocated', 'Spent', 'Returned'];
const IC = '#1E3A5F';

function SafehouseSummary({ data }: { data: Allocation[] }) {
  const houses = ['Safehouse A', 'Safehouse B', 'Safehouse C', 'General'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
      {houses.map(h => {
        const rows  = data.filter(a => a.safehouse === h);
        const total = rows.reduce((s, a) => s + a.amountUsd, 0);
        const spent = rows.filter(a => a.status === 'Spent').reduce((s, a) => s + a.amountUsd, 0);
        const alloc = rows.filter(a => a.status === 'Allocated').reduce((s, a) => s + a.amountUsd, 0);
        const pct   = total > 0 ? Math.round((spent / total) * 100) : 0;
        return (
          <div key={h} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <i className="bi bi-house" style={{ fontSize: 14, color: IC }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{h}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1E3A5F' }}>${total.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>total allocated</div>
            <div style={{ background: '#E2E8F0', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ background: '#0D9488', width: `${pct}%`, height: '100%', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: 3 }}>
                <i className="bi bi-check-circle" style={{ fontSize: 10 }} /> ${spent.toLocaleString()}
              </span>
              <span style={{ color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 3 }}>
                <i className="bi bi-clock" style={{ fontSize: 10 }} /> ${alloc.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgramBreakdown({ data }: { data: Allocation[] }) {
  const programs = Array.from(new Set(data.map(a => a.programArea)));
  const rows = programs.map(p => ({
    name: p,
    total: data.filter(a => a.programArea === p).reduce((s, a) => s + a.amountUsd, 0),
  })).sort((a, b) => b.total - a.total);
  const grand = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(30,58,95,0.06)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <i className="bi bi-grid" style={{ fontSize: 16, color: IC }} />
        <h6 style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, color: '#1E3A5F', margin: 0 }}>Allocation by Program Area</h6>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => {
          const pct = grand > 0 ? Math.round((r.total / grand) * 100) : 0;
          return (
            <div key={r.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>{r.name}</span>
                <span style={{ color: '#1E3A5F', fontWeight: 700 }}>${r.total.toLocaleString()} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ background: '#F1F5F9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg, #1E3A5F, #0D9488)', width: `${pct}%`, height: '100%', borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AllocationsPage() {
  const [safehouseFilter, setSafehouseFilter] = useState('All');
  const [programFilter, setProgramFilter]     = useState('All');
  const [statusFilter, setStatusFilter]       = useState<string>('All');
  const [search, setSearch]                   = useState('');

  const filtered = useMemo(() => ALLOCATIONS.filter(a => {
    const matchSH      = safehouseFilter === 'All' || a.safehouse === safehouseFilter;
    const matchProgram = programFilter   === 'All' || a.programArea === programFilter;
    const matchStatus  = statusFilter    === 'All' || a.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch  = !q || a.supporterName.toLowerCase().includes(q) || a.donationRef.toLowerCase().includes(q);
    return matchSH && matchProgram && matchStatus && matchSearch;
  }), [safehouseFilter, programFilter, statusFilter, search]);

  const totalFiltered = filtered.reduce((s, a) => s + a.amountUsd, 0);
  const spentFiltered = filtered.filter(a => a.status === 'Spent').reduce((s, a) => s + a.amountUsd, 0);

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Donors & Contributions</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>Donation Allocations</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>Track how donations are allocated and spent across safehouses and program areas.</p>
        </div>

        <SafehouseSummary data={ALLOCATIONS} />
        <ProgramBreakdown data={ALLOCATIONS} />

        {/* Filters */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.05)', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94A3B8', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search by supporter or ref…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 14px 8px 30px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }} />
          </div>
          <select value={safehouseFilter} onChange={e => setSafehouseFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            {ALL_SAFEHOUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Safehouses' : s}</option>)}
          </select>
          <select value={programFilter} onChange={e => setProgramFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            {ALL_PROGRAMS.map(p => <option key={p} value={p}>{p === 'All' ? 'All Programs' : p}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            <option value="All">All Statuses</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-graph-up" style={{ fontSize: 12, color: IC }} />
            <strong style={{ color: '#1E3A5F' }}>${totalFiltered.toLocaleString()}</strong> filtered &nbsp;·&nbsp;
            <strong style={{ color: '#166534' }}>${spentFiltered.toLocaleString()}</strong> spent
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {(['All', ...ALL_STATUSES] as string[]).map(s => {
            const cfg = s !== 'All' ? STATUS_CFG[s as AllocStatus] : null;
            return (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: statusFilter === s ? (cfg?.bg ?? '#1E3A5F') : '#E2E8F0', color: statusFilter === s ? (cfg?.text ?? '#fff') : '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                {cfg && statusFilter === s && <i className={`bi bi-${cfg.icon}`} style={{ fontSize: 11 }} />}
                {s === 'All' ? 'All Statuses' : s}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <i className="bi bi-search" style={{ fontSize: 36, display: 'block', marginBottom: 10, color: '#CBD5E1' }} />
              <p style={{ fontWeight: 600 }}>No allocations match your filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['Ref', 'Supporter', 'Amount', 'Safehouse', 'Program Area', 'Status', 'Allocated', 'Spent / Returned', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => {
                    const sCfg = STATUS_CFG[a.status];
                    return (
                      <tr key={a.allocationId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#6B21A8', fontSize: 12 }}>{a.donationRef}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E3A5F', whiteSpace: 'nowrap' }}>{a.supporterName}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#166534' }}>${a.amountUsd.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{a.safehouse}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{a.programArea}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: sCfg.bg, color: sCfg.text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                            <i className={`bi bi-${sCfg.icon}`} style={{ fontSize: 10 }} />{a.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(a.allocationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>{a.spentDate ? new Date(a.spentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#94A3B8', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <i className="bi bi-layers" style={{ fontSize: 12, color: '#CBD5E1' }} />Showing {filtered.length} of {ALLOCATIONS.length} allocation records
        </div>
      </div>
    </div>
  );
}
