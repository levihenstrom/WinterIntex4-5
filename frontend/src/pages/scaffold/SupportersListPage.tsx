import { useState, useMemo } from 'react';
import {
  Users, UserCheck, DollarSign, HandHeart, Wallet,
  Mail, Phone, MapPin, Calendar, Building2, Trash2, Plus, X, Search,
} from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────── */
type SupporterType = 'Monetary Donor' | 'Volunteer' | 'Skills Contributor' | 'In-Kind Donor' | 'Social Media Supporter';
type SupporterStatus = 'Active' | 'Inactive';

interface Supporter {
  supporterId: number;
  displayName: string;
  organizationName?: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  type: SupporterType;
  status: SupporterStatus;
  joinedDate: string;
  totalContributions: number;
  lastContribution: string;
  notes?: string;
}

/* ── Mock Data ───────────────────────────────────────────────── */
const INITIAL_SUPPORTERS: Supporter[] = [
  { supporterId: 1,  displayName: 'María López',      email: 'maria.lopez@gmail.com',          phone: '+502 5555-1234', city: 'Guatemala City', country: 'Guatemala', type: 'Monetary Donor',          status: 'Active',   joinedDate: '2022-03-15', totalContributions: 12500, lastContribution: '2025-02-10', notes: 'Monthly recurring donor since 2022.' },
  { supporterId: 2,  displayName: 'Carlos Méndez',    organizationName: 'Fundación Solidaria',  email: 'carlos@fundacionsolidaria.org', phone: '+502 2222-9876', city: 'Antigua', country: 'Guatemala', type: 'Monetary Donor', status: 'Active', joinedDate: '2021-07-01', totalContributions: 45000, lastContribution: '2025-03-01' },
  { supporterId: 3,  displayName: 'Ana Cifuentes',    email: 'ana.cifuentes@yahoo.com',         phone: '+502 5111-3344', city: 'Quetzaltenango', country: 'Guatemala', type: 'Volunteer',              status: 'Active',   joinedDate: '2023-01-20', totalContributions: 0,     lastContribution: '2025-03-15', notes: 'Provides legal counseling every Tuesday.' },
  { supporterId: 4,  displayName: 'Roberto Palma',    organizationName: 'Tech for Good GT',     email: 'rpalma@techforgood.gt',        phone: '+502 4422-7890', city: 'Guatemala City', country: 'Guatemala', type: 'Skills Contributor', status: 'Active', joinedDate: '2023-06-10', totalContributions: 0, lastContribution: '2025-01-22', notes: 'Website and IT support.' },
  { supporterId: 5,  displayName: 'Laura Estrada',    email: 'laura.estrada@hotmail.com',       phone: '+502 5678-4321', city: 'Cobán',          country: 'Guatemala', type: 'In-Kind Donor',          status: 'Active',   joinedDate: '2022-11-05', totalContributions: 3200,  lastContribution: '2025-02-28', notes: 'Donates clothing, blankets and hygiene kits.' },
  { supporterId: 6,  displayName: 'Miguel Torres',    email: 'miguel.t@gmail.com',              phone: '+502 5990-2233', city: 'Escuintla',      country: 'Guatemala', type: 'Social Media Supporter',  status: 'Active',   joinedDate: '2024-01-12', totalContributions: 0,     lastContribution: '2025-03-20' },
  { supporterId: 7,  displayName: 'Sofía Herrera',    organizationName: 'HR Consulting Plus',   email: 'sofia@hrconsultingplus.com',    phone: '+502 2345-6789', city: 'Guatemala City', country: 'Guatemala', type: 'Skills Contributor', status: 'Inactive', joinedDate: '2021-04-18', totalContributions: 0, lastContribution: '2024-06-10', notes: 'Provided HR training workshops in 2023.' },
  { supporterId: 8,  displayName: 'José Ramírez',     email: 'jose.ramirez@outlook.com',        phone: '+502 5432-1122', city: 'Huehuetenango', country: 'Guatemala', type: 'Monetary Donor',          status: 'Inactive', joinedDate: '2020-08-30', totalContributions: 8700,  lastContribution: '2024-01-15' },
  { supporterId: 9,  displayName: 'Patricia Vásquez', organizationName: 'Iglesia Comunidad de Fe', email: 'patricia@ifc.org',           phone: '+502 2299-4455', city: 'Villa Nueva',    country: 'Guatemala', type: 'In-Kind Donor',          status: 'Active',   joinedDate: '2023-09-01', totalContributions: 5100,  lastContribution: '2025-02-14', notes: 'Monthly food and supplies drive.' },
  { supporterId: 10, displayName: 'Diego Fuentes',    email: 'dfuentes@gmail.com',              phone: '+502 5767-8899', city: 'Petén',          country: 'Guatemala', type: 'Volunteer',              status: 'Active',   joinedDate: '2024-03-05', totalContributions: 0,     lastContribution: '2025-03-10', notes: 'Transportation volunteer, owns van.' },
  { supporterId: 11, displayName: 'Claudia Morales',  organizationName: 'Morales & Asociados',  email: 'cmorales@moralesasoc.gt',       phone: '+502 2233-5566', city: 'Guatemala City', country: 'Guatemala', type: 'Monetary Donor', status: 'Active', joinedDate: '2022-06-22', totalContributions: 22000, lastContribution: '2025-01-30' },
  { supporterId: 12, displayName: 'Fernando Ixcot',   email: 'f.ixcot@yahoo.com',               phone: '+502 5880-1234', city: 'Chimaltenango', country: 'Guatemala', type: 'Social Media Supporter',  status: 'Active',   joinedDate: '2024-06-18', totalContributions: 0,     lastContribution: '2025-03-22' },
];

const TYPE_COLORS: Record<SupporterType, { bg: string; text: string }> = {
  'Monetary Donor':         { bg: '#DCFCE7', text: '#166534' },
  'Volunteer':              { bg: '#DBEAFE', text: '#1E40AF' },
  'Skills Contributor':     { bg: '#F3E8FF', text: '#6B21A8' },
  'In-Kind Donor':          { bg: '#FEF9C3', text: '#854D0E' },
  'Social Media Supporter': { bg: '#FFE4E6', text: '#9F1239' },
};

const STATUS_COLORS: Record<SupporterStatus, { bg: string; text: string }> = {
  Active:   { bg: '#DCFCE7', text: '#166534' },
  Inactive: { bg: '#F1F5F9', text: '#64748B' },
};

const ALL_TYPES: SupporterType[] = ['Monetary Donor', 'Volunteer', 'Skills Contributor', 'In-Kind Donor', 'Social Media Supporter'];
const IC = '#1E3A5F';

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color: text,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    }}>{label}</span>
  );
}

function StatStrip({ supporters }: { supporters: Supporter[] }) {
  const active     = supporters.filter(s => s.status === 'Active').length;
  const monetary   = supporters.filter(s => s.type === 'Monetary Donor').length;
  const volunteers = supporters.filter(s => s.type === 'Volunteer').length;
  const totalGiven = supporters.reduce((sum, s) => sum + s.totalContributions, 0);

  const stats = [
    { label: 'Total Supporters', value: supporters.length, Icon: Users },
    { label: 'Active',           value: active,            Icon: UserCheck },
    { label: 'Monetary Donors',  value: monetary,          Icon: DollarSign },
    { label: 'Volunteers',       value: volunteers,        Icon: HandHeart },
    { label: 'Total Donated',    value: `$${totalGiven.toLocaleString()}`, Icon: Wallet },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      {stats.map(({ label, value, Icon }) => (
        <div key={label} style={{
          flex: '1 1 140px', background: '#fff', borderRadius: 12,
          padding: '14px 16px', border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
        }}>
          <Icon size={18} color={IC} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1E3A5F' }}>{value}</div>
          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function SupportersListPage() {
  const [supporters, setSupporters] = useState<Supporter[]>(INITIAL_SUPPORTERS);
  const [typeFilter, setTypeFilter]     = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch]             = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm] = useState({
    displayName: '', organizationName: '', email: '', phone: '',
    city: '', country: 'Guatemala', type: 'Monetary Donor' as SupporterType, notes: '',
  });

  const filtered = useMemo(() => supporters.filter(s => {
    const matchType   = typeFilter === 'All' || s.type === typeFilter;
    const matchStatus = statusFilter === 'All' || s.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.displayName.toLowerCase().includes(q)
      || (s.organizationName ?? '').toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q);
    return matchType && matchStatus && matchSearch;
  }), [supporters, typeFilter, statusFilter, search]);

  function handleDelete(id: number) {
    setSupporters(prev => prev.filter(s => s.supporterId !== id));
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newId = Math.max(...supporters.map(s => s.supporterId)) + 1;
    setSupporters(prev => [...prev, {
      ...form,
      supporterId: newId,
      status: 'Active',
      joinedDate: new Date().toISOString().slice(0, 10),
      totalContributions: 0,
      lastContribution: new Date().toISOString().slice(0, 10),
    }]);
    setForm({ displayName: '', organizationName: '', email: '', phone: '', city: '', country: 'Guatemala', type: 'Monetary Donor', notes: '' });
    setShowForm(false);
  }

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Donors & Contributions</span>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>Supporter Profiles</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>Manage all supporter profiles, types, and statuses across the organization.</p>
        </div>

        <StatStrip supporters={supporters} />

        {/* Filters bar */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '14px 20px',
          border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.05)',
          marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Search by name, org or email…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 14px 8px 30px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            <option value="All">All Types</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button onClick={() => setShowForm(v => !v)} style={{
            background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'New Supporter'}
          </button>
          <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>{filtered.length} of {supporters.length} supporters</span>
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #CBD5E1', marginBottom: 24, boxShadow: '0 4px 16px rgba(30,58,95,0.08)' }}>
            <h5 style={{ fontFamily: 'Poppins,sans-serif', color: '#1E3A5F', fontWeight: 700, marginBottom: 16 }}>Add New Supporter</h5>
            <form onSubmit={handleAddSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Full Name *</label>
                  <input required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Organization</label>
                  <input value={form.organizationName} onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-md-4">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Email *</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-md-3">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-md-3">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>City</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-md-3">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Type *</label>
                  <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as SupporterType }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
                    {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }} />
                </div>
                <div className="col-12">
                  <button type="submit" style={{ background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Save Supporter
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Type pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['All', ...ALL_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: typeFilter === t ? '#1E3A5F' : '#E2E8F0',
              color: typeFilter === t ? '#fff' : '#475569',
            }}>{t}</button>
          ))}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
            <Search size={36} color="#CBD5E1" style={{ marginBottom: 10 }} />
            <p style={{ fontWeight: 600 }}>No supporters match your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(s => {
              const tc = TYPE_COLORS[s.type];
              const sc = STATUS_COLORS[s.status];
              const initials = s.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={s.supporterId} style={{
                  background: '#fff', borderRadius: 14, padding: 20,
                  border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(30,58,95,0.06)',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', background: tc.bg, color: tc.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 15, flexShrink: 0,
                    }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#1E3A5F', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.displayName}</div>
                      {s.organizationName && (
                        <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          <Building2 size={11} color="#94A3B8" />{s.organizationName}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <Badge label={s.type} bg={tc.bg} text={tc.text} />
                        <Badge label={s.status} bg={sc.bg} text={sc.text} />
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={12} color={IC} />{s.email}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={12} color={IC} />{s.phone}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={12} color={IC} />{s.city}, {s.country}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={12} color={IC} />Joined {new Date(s.joinedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {s.totalContributions > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 600 }}>
                        <Wallet size={12} color="#166534" />${s.totalContributions.toLocaleString()} contributed
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8' }}>
                      <Calendar size={12} color="#94A3B8" />Last active: {new Date(s.lastContribution).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {s.notes && (
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B', fontStyle: 'italic', borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>{s.notes}</p>
                  )}

                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleDelete(s.supporterId)} style={{
                      background: 'none', border: '1px solid #FCA5A5', borderRadius: 6,
                      color: '#DC2626', fontSize: 12, fontWeight: 600, padding: '4px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Trash2 size={12} />Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
