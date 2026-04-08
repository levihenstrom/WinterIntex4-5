import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteJson,
  fetchPaged,
  postJson,
  putJson,
  type PagedResult,
} from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import AdminKpiStrip from '../../components/admin/AdminKpiStrip';
import 'bootstrap-icons/font/bootstrap-icons.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HomeVisitation {
  visitationId: number;
  residentId: number;
  visitDate: string | null;
  socialWorker: string | null;
  visitType: string | null;
  locationVisited: string | null;
  familyMembersPresent: string | null;
  purpose: string | null;
  observations: string | null;
  familyCooperationLevel: string | null;
  safetyConcernsNoted: boolean | null;
  followUpNeeded: boolean | null;
  followUpNotes: string | null;
  visitOutcome: string | null;
}

interface CaseConference {
  planId: number;
  residentId: number;
  planCategory: string | null;
  planDescription: string | null;
  servicesProvided: string | null;
  status: string | null;
  caseConferenceDate: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VISIT_TYPES = [
  'Initial Assessment',
  'Routine Follow-up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
];
const COOPERATION_LEVELS = ['Cooperative', 'Partially Cooperative', 'Uncooperative', 'Not Present'];

const VISIT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Initial Assessment':        { bg: '#DBEAFE', text: '#1E40AF' },
  'Routine Follow-up':         { bg: '#F3E8FF', text: '#6B21A8' },
  'Reintegration Assessment':  { bg: '#DCFCE7', text: '#166534' },
  'Post-Placement Monitoring': { bg: '#FEF9C3', text: '#854D0E' },
  Emergency:                   { bg: '#FEE2E2', text: '#991B1B' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.split('T')[0];
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color: text,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{label}</span>
  );
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

type VisitQuickFilter = 'followUp' | 'safety' | 'emergency' | null;

function VisitKpiStrip({
  items,
  quickFilter,
  onFilterToggle,
}: {
  items: HomeVisitation[];
  quickFilter: VisitQuickFilter;
  onFilterToggle: (f: NonNullable<VisitQuickFilter>) => void;
}) {
  const total = items.length;
  const safety = items.filter((v) => v.safetyConcernsNoted).length;
  const followUp = items.filter((v) => v.followUpNeeded).length;
  const emergency = items.filter((v) => v.visitType === 'Emergency').length;
  const cooperative = items.filter((v) => v.familyCooperationLevel === 'Cooperative').length;

  return (
    <AdminKpiStrip
      items={[
        { label: 'Visits on page', value: String(total), accent: '#1E3A5F', icon: 'house-door' },
        {
          label: safety > 0 && quickFilter === 'safety' ? 'Safety concerns (filtered) ✕' : 'Safety concerns',
          value: String(safety), accent: '#991B1B', icon: 'exclamation-triangle',
          onClick: () => onFilterToggle('safety'),
        },
        {
          label: followUp > 0 && quickFilter === 'followUp' ? 'Follow-ups needed (filtered) ✕' : 'Follow-ups needed',
          value: String(followUp), accent: '#854D0E', icon: 'pin-map',
          onClick: () => onFilterToggle('followUp'),
        },
        {
          label: emergency > 0 && quickFilter === 'emergency' ? 'Emergency visits (filtered) ✕' : 'Emergency visits',
          value: String(emergency), accent: '#DC2626', icon: 'lightning-charge',
          onClick: () => onFilterToggle('emergency'),
        },
        { label: 'Cooperative families', value: String(cooperative), accent: '#166534', icon: 'people' },
      ]}
    />
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

type VisitSortCol = 'residentId' | 'visitDate' | 'socialWorker' | 'visitType' | 'locationVisited' | 'familyCooperationLevel' | 'safetyConcernsNoted' | 'followUpNeeded';
type ConfSortCol = 'caseConferenceDate' | 'residentId' | 'planCategory' | 'status';

function sortArrow<T extends string>(col: T, sortCol: T | null, sortDir: 'asc' | 'desc'): string {
  if (col !== sortCol) return ' ↕';
  return sortDir === 'asc' ? ' ▲' : ' ▼';
}

function compareValues(a: string | number | boolean | null | undefined, b: string | number | boolean | null | undefined, dir: 'asc' | 'desc'): number {
  const av = a ?? '';
  const bv = b ?? '';
  if (av < bv) return dir === 'asc' ? -1 : 1;
  if (av > bv) return dir === 'asc' ? 1 : -1;
  return 0;
}

// ── Blank form ────────────────────────────────────────────────────────────────

type VisitForm = Omit<HomeVisitation, 'visitationId'>;

function emptyVisitForm(): VisitForm {
  return {
    residentId: 0,
    visitDate: '',
    socialWorker: '',
    visitType: 'Routine Follow-up',
    locationVisited: '',
    familyMembersPresent: '',
    purpose: '',
    observations: '',
    familyCooperationLevel: '',
    safetyConcernsNoted: false,
    followUpNeeded: false,
    followUpNotes: '',
    visitOutcome: '',
  };
}

function visitToForm(v: HomeVisitation): VisitForm {
  return {
    residentId: v.residentId,
    visitDate: toDateInput(v.visitDate),
    socialWorker: v.socialWorker ?? '',
    visitType: v.visitType ?? 'Routine Follow-up',
    locationVisited: v.locationVisited ?? '',
    familyMembersPresent: v.familyMembersPresent ?? '',
    purpose: v.purpose ?? '',
    observations: v.observations ?? '',
    familyCooperationLevel: v.familyCooperationLevel ?? '',
    safetyConcernsNoted: v.safetyConcernsNoted ?? false,
    followUpNeeded: v.followUpNeeded ?? false,
    followUpNotes: v.followUpNotes ?? '',
    visitOutcome: v.visitOutcome ?? '',
  };
}

// ── Shared inline styles ──────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569',
  fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
};
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13 };
const actionBtn = (color: string, border: string): React.CSSProperties => ({
  background: 'none', border: `1px solid ${border}`, borderRadius: 6,
  color, fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
});
const navBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? '#F1F5F9' : '#fff',
  border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 16px',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  color: disabled ? '#94A3B8' : '#1E3A5F', transition: 'all 0.15s',
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResidentVisitsAndConferencesPage() {
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  // ── Home Visitations state ────────────────────────────────────────────────────
  const [visitPage, setVisitPage] = useState(1);
  const [visitData, setVisitData] = useState<PagedResult<HomeVisitation> | null>(null);
  const [visitLoading, setVisitLoading] = useState(true);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [visitReload, setVisitReload] = useState(0);

  const [editTarget, setEditTarget] = useState<HomeVisitation | 'new' | null>(null);
  const [form, setForm] = useState<VisitForm>(emptyVisitForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<HomeVisitation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [visitTypeFilter, setVisitTypeFilter] = useState('');
  const [visitSortCol, setVisitSortCol] = useState<VisitSortCol | null>(null);
  const [visitSortDir, setVisitSortDir] = useState<'asc' | 'desc'>('asc');
  const [quickFilter, setQuickFilter] = useState<VisitQuickFilter>(null);

  function toggleQuickFilter(f: NonNullable<VisitQuickFilter>) {
    setQuickFilter((prev) => prev === f ? null : f);
  }

  // ── Case Conferences state ────────────────────────────────────────────────────
  const [confPage, setConfPage] = useState(1);
  const [confData, setConfData] = useState<PagedResult<CaseConference> | null>(null);
  const [confLoading, setConfLoading] = useState(true);
  const [confError, setConfError] = useState<string | null>(null);

  const [confSortCol, setConfSortCol] = useState<ConfSortCol | null>(null);
  const [confSortDir, setConfSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Fetch visits ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setVisitLoading(true);
    setVisitError(null);
    fetchPaged<HomeVisitation>('/api/home-visitations', visitPage, 20)
      .then((r) => { if (!cancelled) setVisitData(r); })
      .catch((e: Error) => { if (!cancelled) setVisitError(e.message); })
      .finally(() => { if (!cancelled) setVisitLoading(false); });
    return () => { cancelled = true; };
  }, [visitPage, visitReload]);

  // ── Fetch conferences ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setConfLoading(true);
    setConfError(null);
    fetchPaged<CaseConference>('/api/case-conferences', confPage, 10, { upcoming: 'true' })
      .then((r) => { if (!cancelled) setConfData(r); })
      .catch((e: Error) => { if (!cancelled) setConfError(e.message); })
      .finally(() => { if (!cancelled) setConfLoading(false); });
    return () => { cancelled = true; };
  }, [confPage]);

  // ── Visit sort/filter ─────────────────────────────────────────────────────────
  function handleVisitSort(col: VisitSortCol) {
    if (visitSortCol === col) setVisitSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setVisitSortCol(col); setVisitSortDir('asc'); }
  }

  const filteredVisits = useMemo(() => {
    let items = visitData?.items ?? [];
    if (visitTypeFilter) items = items.filter(v => v.visitType === visitTypeFilter);
    if (quickFilter === 'followUp') items = items.filter(v => v.followUpNeeded === true);
    else if (quickFilter === 'safety') items = items.filter(v => v.safetyConcernsNoted === true);
    else if (quickFilter === 'emergency') items = items.filter(v => v.visitType === 'Emergency');
    if (visitSortCol) {
      items = [...items].sort((a, b) => compareValues(
        a[visitSortCol] as string | number | boolean | null,
        b[visitSortCol] as string | number | boolean | null,
        visitSortDir,
      ));
    }
    return items;
  }, [visitData?.items, visitTypeFilter, quickFilter, visitSortCol, visitSortDir]);

  // ── Conference sort ───────────────────────────────────────────────────────────
  function handleConfSort(col: ConfSortCol) {
    if (confSortCol === col) setConfSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setConfSortCol(col); setConfSortDir('asc'); }
  }

  const sortedConfs = useMemo(() => {
    if (!confData?.items || !confSortCol) return confData?.items ?? [];
    return [...confData.items].sort((a, b) => compareValues(
      a[confSortCol] as string | number | null,
      b[confSortCol] as string | number | null,
      confSortDir,
    ));
  }, [confData?.items, confSortCol, confSortDir]);

  // ── Visit modal helpers ───────────────────────────────────────────────────────
  function openCreate() {
    setForm(emptyVisitForm());
    setFormError(null);
    setEditTarget('new');
  }

  function openEdit(v: HomeVisitation) {
    setForm(visitToForm(v));
    setFormError(null);
    setEditTarget(v);
  }

  function setField<K extends keyof VisitForm>(key: K, value: VisitForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        visitDate: form.visitDate?.trim() ? form.visitDate : null,
      };
      if (editTarget === 'new') {
        await postJson<HomeVisitation>('/api/home-visitations', payload);
      } else if (editTarget) {
        await putJson(
          `/api/home-visitations/${(editTarget as HomeVisitation).visitationId}`,
          { ...payload, visitationId: (editTarget as HomeVisitation).visitationId },
        );
      }
      setEditTarget(null);
      setVisitReload((t) => t + 1);
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
      await deleteJson(`/api/home-visitations/${deleteTarget.visitationId}`);
      setDeleteTarget(null);
      setVisitReload((t) => t + 1);
    } catch (e) {
      setVisitError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleteBusy(false);
    }
  }

  const isEditing = editTarget !== null && editTarget !== 'new';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">

        {/* ── Section: Home Visitations ───────────────────────────────────────── */}
        <div className="mb-5 d-flex justify-content-between align-items-end flex-wrap gap-3">
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
              Case Management
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
              <i className="bi bi-calendar-event me-3" style={{ color: '#0D9488' }} aria-hidden />
              Visits &amp; conferences
            </h1>
            <p className="text-muted mb-0" style={{ fontSize: 14 }}>
              {visitData ? `${visitData.totalCount} visit${visitData.totalCount !== 1 ? 's' : ''} logged` : 'Loading visits…'}
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              style={{
                background: '#1E3A5F',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 12px rgba(30,58,95,0.15)',
              }}
            >
              <i className="bi bi-house-add fs-5" aria-hidden />
              Record visit
            </button>
          )}
        </div>

        {/* KPI Strip */}
        {visitData && (
          <>
            <VisitKpiStrip items={visitData.items} quickFilter={quickFilter} onFilterToggle={toggleQuickFilter} />
            {quickFilter && (
              <div className="d-flex align-items-center gap-2 mb-3" style={{ fontSize: 13 }}>
                <span className="badge rounded-pill" style={{ background: '#1E3A5F', color: 'white' }}>
                  Filtered: {quickFilter === 'followUp' ? 'Follow-ups needed' : quickFilter === 'safety' ? 'Safety concerns' : 'Emergency visits'}
                </span>
                <button type="button" className="btn btn-sm btn-link p-0 text-muted" style={{ fontSize: 12 }} onClick={() => setQuickFilter(null)}>
                  Clear filter ✕
                </button>
              </div>
            )}
          </>
        )}

        {/* Visit type filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['', ...VISIT_TYPES].map(t => {
            const isActive = visitTypeFilter === t;
            const cfg = t ? VISIT_TYPE_COLORS[t] : null;
            return (
              <button key={t || 'all'} onClick={() => setVisitTypeFilter(t)} style={{
                border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: isActive ? (cfg?.bg ?? '#1E3A5F') : '#E2E8F0',
                color: isActive ? (cfg?.text ?? '#fff') : '#475569',
                transition: 'all 0.15s',
              }}>
                {t || 'All Types'}
              </button>
            );
          })}
        </div>

        {visitError && (
          <div style={{ borderRadius: 8, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
            {visitError}
          </div>
        )}

        {/* Visits table */}
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(30,58,95,0.06)', overflow: 'hidden', marginBottom: 48,
        }}>
          {visitLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div className="spinner-border text-secondary mb-3" role="status" aria-label="Loading">
                <span className="visually-hidden">Loading…</span>
              </div>
              <p className="fw-semibold mb-0">Loading visits…</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div className="mb-3" style={{ fontSize: 40 }}>
                <i className="bi bi-search" style={{ color: '#CBD5E1' }} aria-hidden />
              </div>
              <p className="fw-semibold mb-0">No visits logged yet.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={thStyle} onClick={() => handleVisitSort('residentId')}>Resident{sortArrow('residentId', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('visitDate')}>Date{sortArrow('visitDate', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('socialWorker')}>Social Worker{sortArrow('socialWorker', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('visitType')}>Visit Type{sortArrow('visitType', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('locationVisited')}>Location{sortArrow('locationVisited', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('familyCooperationLevel')}>Cooperation{sortArrow('familyCooperationLevel', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('safetyConcernsNoted')}>Safety{sortArrow('safetyConcernsNoted', visitSortCol, visitSortDir)}</th>
                      <th style={thStyle} onClick={() => handleVisitSort('followUpNeeded')}>Follow-up{sortArrow('followUpNeeded', visitSortCol, visitSortDir)}</th>
                      <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((v, i) => {
                      const vtCfg = VISIT_TYPE_COLORS[v.visitType ?? ''] ?? { bg: '#F1F5F9', text: '#64748B' };
                      return (
                        <tr key={v.visitationId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                          <td style={tdStyle}>
                            <Link to={`/admin/residents/${v.residentId}/visits`} style={{ color: '#6B21A8', fontWeight: 600, textDecoration: 'none' }}>{v.residentId}</Link>
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#1E3A5F', whiteSpace: 'nowrap' }}>{fmtDate(v.visitDate)}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{v.socialWorker || '—'}</td>
                          <td style={tdStyle}><Badge label={v.visitType || '—'} bg={vtCfg.bg} text={vtCfg.text} /></td>
                          <td style={{ ...tdStyle, color: '#64748B' }}>{v.locationVisited || '—'}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{v.familyCooperationLevel || '—'}</td>
                          <td style={tdStyle}>
                            {v.safetyConcernsNoted
                              ? <Badge label="Yes" bg="#FEE2E2" text="#991B1B" />
                              : <Badge label="No" bg="#F1F5F9" text="#64748B" />}
                          </td>
                          <td style={tdStyle}>
                            {v.followUpNeeded
                              ? <Badge label="Needed" bg="#FEF9C3" text="#854D0E" />
                              : <Badge label="No" bg="#F1F5F9" text="#64748B" />}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {canWrite && <button type="button" style={actionBtn('#1E40AF', '#93C5FD')} onClick={() => openEdit(v)}>Edit</button>}
                              {canWrite && <button type="button" style={actionBtn('#DC2626', '#FCA5A5')} onClick={() => setDeleteTarget(v)}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {visitData && (
                <div style={{
                  padding: '14px 20px', borderTop: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Page {visitData.page} of {visitData.totalPages || 1} · {visitData.totalCount} total
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={visitPage <= 1 || visitLoading} onClick={() => setVisitPage(p => Math.max(1, p - 1))} style={navBtn(visitPage <= 1 || visitLoading)}>← Prev</button>
                    <button type="button" disabled={visitLoading || visitPage >= (visitData.totalPages || 1)} onClick={() => setVisitPage(p => p + 1)} style={navBtn(visitLoading || visitPage >= (visitData.totalPages || 1))}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Section: Upcoming Case Conferences ─────────────────────────────── */}
        <div className="mb-4">
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
            Scheduling
          </span>
          <h2
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: 22,
              color: '#1E3A5F',
              marginBottom: 8,
            }}
          >
            Upcoming Case Conferences
          </h2>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            Pulled from intervention plans with a scheduled conference date.
          </p>
        </div>

        {confError && (
          <div style={{ borderRadius: 8, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
            {confError}
          </div>
        )}

        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(30,58,95,0.06)', overflow: 'hidden',
        }}>
          {confLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
              <div className="spinner-border text-secondary mb-3" role="status" aria-label="Loading">
                <span className="visually-hidden">Loading…</span>
              </div>
              <p className="fw-semibold mb-0">Loading conferences…</p>
            </div>
          ) : sortedConfs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
              <div className="mb-3" style={{ fontSize: 40 }}>
                <i className="bi bi-calendar-event" style={{ color: '#CBD5E1' }} aria-hidden />
              </div>
              <p className="fw-semibold mb-0">No upcoming case conferences scheduled.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={thStyle} onClick={() => handleConfSort('caseConferenceDate')}>Conference Date{sortArrow('caseConferenceDate', confSortCol, confSortDir)}</th>
                      <th style={thStyle} onClick={() => handleConfSort('residentId')}>Resident{sortArrow('residentId', confSortCol, confSortDir)}</th>
                      <th style={thStyle} onClick={() => handleConfSort('planCategory')}>Plan Category{sortArrow('planCategory', confSortCol, confSortDir)}</th>
                      <th style={{ ...thStyle, cursor: 'default' }}>Description</th>
                      <th style={thStyle} onClick={() => handleConfSort('status')}>Status{sortArrow('status', confSortCol, confSortDir)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedConfs.map((c, i) => (
                      <tr key={c.planId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: '#0D9488', whiteSpace: 'nowrap' }}>{fmtDate(c.caseConferenceDate)}</td>
                        <td style={tdStyle}>
                          <Link to={`/admin/residents/${c.residentId}/process`} style={{ color: '#6B21A8', fontWeight: 600, textDecoration: 'none' }}>Resident {c.residentId}</Link>
                        </td>
                        <td style={{ ...tdStyle, color: '#475569' }}>{c.planCategory || '—'}</td>
                        <td style={{ ...tdStyle, color: '#64748B', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.planDescription || '—'}</td>
                        <td style={tdStyle}>
                          <Badge label={c.status || '—'} bg="#F1F5F9" text="#64748B" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {confData && (
                <div style={{
                  padding: '14px 20px', borderTop: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    {confData.totalCount} upcoming conference{confData.totalCount !== 1 ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={confPage <= 1 || confLoading} onClick={() => setConfPage(p => Math.max(1, p - 1))} style={navBtn(confPage <= 1 || confLoading)}>← Prev</button>
                    <button type="button" disabled={confLoading || confPage >= (confData.totalPages || 1)} onClick={() => setConfPage(p => p + 1)} style={navBtn(confLoading || confPage >= (confData.totalPages || 1))}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create / Edit Visit Modal ───────────────────────────────────────────── */}
      {editTarget !== null && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="visitModal2Title"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--hw-bg-lavender2)', borderBottom: 'none' }}>
                <h5 className="modal-title hw-heading mb-0" id="visitModal2Title">
                  {isEditing ? `Edit visit — ${fmtDate((editTarget as HomeVisitation).visitDate)}` : 'Record visit'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setEditTarget(null)} />
              </div>
              <div className="modal-body">
                {formError && <div className="hw-alert-error mb-3">{formError}</div>}
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="hw-label">Resident ID <span className="text-danger">*</span></label>
                    <input type="number" min="1" className="hw-input" value={form.residentId || ''} onChange={(e) => setField('residentId', Number(e.target.value))} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Visit Date <span className="text-danger">*</span></label>
                    <input type="date" className="hw-input" value={form.visitDate ?? ''} onChange={(e) => setField('visitDate', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Social Worker <span className="text-danger">*</span></label>
                    <input className="hw-input" value={form.socialWorker ?? ''} onChange={(e) => setField('socialWorker', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Visit Type <span className="text-danger">*</span></label>
                    <select className="hw-input" value={form.visitType ?? ''} onChange={(e) => setField('visitType', e.target.value)}>
                      {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Location Visited</label>
                    <input className="hw-input" value={form.locationVisited ?? ''} onChange={(e) => setField('locationVisited', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Family Cooperation Level</label>
                    <select className="hw-input" value={form.familyCooperationLevel ?? ''} onChange={(e) => setField('familyCooperationLevel', e.target.value)}>
                      <option value="">Select…</option>
                      {COOPERATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Family Members Present</label>
                    <input className="hw-input" value={form.familyMembersPresent ?? ''} onChange={(e) => setField('familyMembersPresent', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Purpose</label>
                    <input className="hw-input" value={form.purpose ?? ''} onChange={(e) => setField('purpose', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="hw-label">Observations</label>
                    <textarea className="hw-input" rows={3} placeholder="Observations about the home environment, family situation…" value={form.observations ?? ''} onChange={(e) => setField('observations', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Follow-up Notes</label>
                    <textarea className="hw-input" rows={2} value={form.followUpNotes ?? ''} onChange={(e) => setField('followUpNotes', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Visit Outcome</label>
                    <input className="hw-input" value={form.visitOutcome ?? ''} onChange={(e) => setField('visitOutcome', e.target.value)} />
                  </div>
                  <div className="col-12 d-flex gap-4 flex-wrap">
                    {([
                      { key: 'safetyConcernsNoted' as const, label: 'Safety Concerns Noted' },
                      { key: 'followUpNeeded' as const, label: 'Follow-up Needed' },
                    ] as const).map(({ key, label }) => (
                      <div key={key} className="form-check">
                        <input type="checkbox" className="form-check-input hw-check" id={`vc2-${key}`} checked={!!form[key]} onChange={(e) => setField(key, e.target.checked)} />
                        <label className="form-check-label" htmlFor={`vc2-${key}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--hw-bg-lavender2)' }}>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="button" className="btn hw-btn-magenta px-4" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Record visit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `visit on ${fmtDate(deleteTarget.visitDate)}` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
