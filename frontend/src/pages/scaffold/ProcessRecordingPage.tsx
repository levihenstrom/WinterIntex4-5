import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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

interface ProcessRecording {
  recordingId: number;
  residentId: number;
  sessionDate: string | null;
  socialWorker: string | null;
  sessionType: string | null;
  sessionDurationMinutes: number | null;
  emotionalStateObserved: string | null;
  emotionalStateEnd: string | null;
  sessionNarrative: string | null;
  interventionsApplied: string | null;
  followUpActions: string | null;
  progressNoted: boolean | null;
  concernsFlagged: boolean | null;
  referralMade: boolean | null;
  notesRestricted: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_TYPES = ['Individual', 'Group', 'Family', 'Crisis Intervention'];
const EMOTIONAL_STATES = [
  'Calm', 'Anxious', 'Withdrawn', 'Engaged', 'Distressed',
  'Hopeful', 'Angry', 'Tearful', 'Neutral', 'Cooperative',
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Individual:           { bg: '#DBEAFE', text: '#1E40AF' },
  Group:                { bg: '#F3E8FF', text: '#6B21A8' },
  Family:               { bg: '#DCFCE7', text: '#166534' },
  'Crisis Intervention': { bg: '#FEE2E2', text: '#991B1B' },
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

function SessionKpiStrip({ items }: { items: ProcessRecording[] }) {
  const total = items.length;
  const avgDur = total > 0
    ? Math.round(items.reduce((s, r) => s + (r.sessionDurationMinutes ?? 0), 0) / total)
    : 0;
  const progressCount = items.filter((r) => r.progressNoted).length;
  const concernsCount = items.filter((r) => r.concernsFlagged).length;
  const referralCount = items.filter((r) => r.referralMade).length;

  return (
    <AdminKpiStrip
      items={[
        { label: 'Sessions on page', value: String(total), accent: '#1E3A5F', icon: 'clipboard2-data' },
        { label: 'Avg duration', value: `${avgDur} min`, accent: '#1E40AF', icon: 'stopwatch' },
        { label: 'Progress noted', value: String(progressCount), accent: '#166534', icon: 'check-circle' },
        { label: 'Concerns flagged', value: String(concernsCount), accent: '#991B1B', icon: 'exclamation-triangle' },
        { label: 'Referrals made', value: String(referralCount), accent: '#6B21A8', icon: 'link-45deg' },
      ]}
    />
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortCol = 'sessionDate' | 'socialWorker' | 'sessionType' | 'sessionDurationMinutes' | 'emotionalStateObserved' | 'progressNoted' | 'concernsFlagged' | 'residentId';

function sortArrow(col: SortCol, sortCol: SortCol | null, sortDir: 'asc' | 'desc'): string {
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

type FormData = Omit<ProcessRecording, 'recordingId'>;

function emptyForm(residentId: number): FormData {
  return {
    residentId,
    sessionDate: '',
    socialWorker: '',
    sessionType: 'Individual',
    sessionDurationMinutes: null,
    emotionalStateObserved: '',
    emotionalStateEnd: '',
    sessionNarrative: '',
    interventionsApplied: '',
    followUpActions: '',
    progressNoted: false,
    concernsFlagged: false,
    referralMade: false,
    notesRestricted: '',
  };
}

function recordingToForm(r: ProcessRecording): FormData {
  return {
    residentId: r.residentId,
    sessionDate: toDateInput(r.sessionDate),
    socialWorker: r.socialWorker ?? '',
    sessionType: r.sessionType ?? 'Individual',
    sessionDurationMinutes: r.sessionDurationMinutes ?? null,
    emotionalStateObserved: r.emotionalStateObserved ?? '',
    emotionalStateEnd: r.emotionalStateEnd ?? '',
    sessionNarrative: r.sessionNarrative ?? '',
    interventionsApplied: r.interventionsApplied ?? '',
    followUpActions: r.followUpActions ?? '',
    progressNoted: r.progressNoted ?? false,
    concernsFlagged: r.concernsFlagged ?? false,
    referralMade: r.referralMade ?? false,
    notesRestricted: r.notesRestricted ?? '',
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

export default function ProcessRecordingPage() {
  const { id } = useParams<{ id?: string }>();
  const residentId = id ? Number(id) : null;
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<ProcessRecording> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [editTarget, setEditTarget] = useState<ProcessRecording | 'new' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm(residentId ?? 0));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProcessRecording | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [typeFilter, setTypeFilter] = useState('');
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPaged<ProcessRecording>(
      '/api/process-recordings',
      page,
      20,
      residentId ? { residentId } : {},
    )
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, residentId, reloadToken]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const filteredAndSorted = useMemo(() => {
    let items = data?.items ?? [];
    if (typeFilter) items = items.filter(r => r.sessionType === typeFilter);
    if (sortCol) {
      items = [...items].sort((a, b) => compareValues(
        a[sortCol] as string | number | boolean | null,
        b[sortCol] as string | number | boolean | null,
        sortDir,
      ));
    }
    return items;
  }, [data?.items, typeFilter, sortCol, sortDir]);

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(emptyForm(residentId ?? 0));
    setFormError(null);
    setEditTarget('new');
  }

  function openEdit(r: ProcessRecording) {
    setForm(recordingToForm(r));
    setFormError(null);
    setEditTarget(r);
  }

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        sessionDate: form.sessionDate?.trim() ? form.sessionDate : null,
        sessionDurationMinutes: form.sessionDurationMinutes
          ? Number(form.sessionDurationMinutes)
          : null,
      };
      if (editTarget === 'new') {
        await postJson<ProcessRecording>('/api/process-recordings', payload);
      } else if (editTarget) {
        await putJson(`/api/process-recordings/${editTarget.recordingId}`, {
          ...payload,
          recordingId: editTarget.recordingId,
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
      await deleteJson(`/api/process-recordings/${deleteTarget.recordingId}`);
      setDeleteTarget(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleteBusy(false);
    }
  }

  const isEditing = editTarget !== null && editTarget !== 'new';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        {/* Breadcrumb */}
        {residentId && (
          <nav style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              <Link to="/admin/residents" style={{ color: '#6B21A8', fontWeight: 600, textDecoration: 'none' }}>Residents</Link>
              <span style={{ margin: '0 6px' }}>/</span>
              <span>Session notes — Resident {residentId}</span>
            </span>
          </nav>
        )}

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Case Management</span>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
              <i className="bi bi-journal-text me-2" style={{ color: '#0D9488' }} aria-hidden />
              Session notes
              {residentId && <span style={{ fontSize: 16, color: '#64748B', fontWeight: 400, marginLeft: 8 }}>— Resident {residentId}</span>}
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
              {data ? `${data.totalCount} session${data.totalCount !== 1 ? 's' : ''} recorded` : 'Loading sessions…'}
            </p>
          </div>
          {canWrite && (
            <button type="button" onClick={openCreate} style={{
              background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <i className="bi bi-journal-plus" aria-hidden />
              Record session
            </button>
          )}
        </div>

        {/* KPI Strip */}
        {data && <SessionKpiStrip items={data.items} />}

        {/* Session type filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['', ...SESSION_TYPES].map(t => {
            const isActive = typeFilter === t;
            const cfg = t ? TYPE_COLORS[t] : null;
            return (
              <button key={t || 'all'} onClick={() => setTypeFilter(t)} style={{
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

        {/* Error */}
        {error && (
          <div style={{ borderRadius: 8, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Table */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          boxShadow: '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div className="spinner-border text-secondary mb-3" role="status" aria-label="Loading">
                <span className="visually-hidden">Loading…</span>
              </div>
              <p className="fw-semibold mb-0">Loading sessions…</p>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <div className="mb-3" style={{ fontSize: 40 }}>
                <i className="bi bi-search" style={{ color: '#CBD5E1' }} aria-hidden />
              </div>
              <p className="fw-semibold">
                No sessions recorded yet.{' '}
                {canWrite && <button type="button" onClick={openCreate} style={{ background: 'none', border: 'none', color: '#6B21A8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 14 }}>Log the first session.</button>}
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {!residentId && <th style={thStyle} onClick={() => handleSort('residentId')}>Resident{sortArrow('residentId', sortCol, sortDir)}</th>}
                      <th style={thStyle} onClick={() => handleSort('sessionDate')}>Date{sortArrow('sessionDate', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('socialWorker')}>Social Worker{sortArrow('socialWorker', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('sessionType')}>Type{sortArrow('sessionType', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('sessionDurationMinutes')}>Duration{sortArrow('sessionDurationMinutes', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('emotionalStateObserved')}>Emotional State{sortArrow('emotionalStateObserved', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('progressNoted')}>Progress{sortArrow('progressNoted', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('concernsFlagged')}>Concerns{sortArrow('concernsFlagged', sortCol, sortDir)}</th>
                      <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.map((r, i) => {
                      const tCfg = TYPE_COLORS[r.sessionType ?? ''] ?? { bg: '#F1F5F9', text: '#64748B' };
                      return (
                        <tr key={r.recordingId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                          {!residentId && (
                            <td style={tdStyle}>
                              <Link to={`/admin/residents/${r.residentId}/process`} style={{ color: '#6B21A8', fontWeight: 600, textDecoration: 'none' }}>{r.residentId}</Link>
                            </td>
                          )}
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#1E3A5F', whiteSpace: 'nowrap' }}>{fmtDate(r.sessionDate)}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{r.socialWorker || '—'}</td>
                          <td style={tdStyle}><Badge label={r.sessionType || '—'} bg={tCfg.bg} text={tCfg.text} /></td>
                          <td style={{ ...tdStyle, color: '#64748B' }}>{r.sessionDurationMinutes != null ? `${r.sessionDurationMinutes} min` : '—'}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>
                            {r.emotionalStateObserved || '—'}
                            {r.emotionalStateEnd && r.emotionalStateObserved && r.emotionalStateEnd !== r.emotionalStateObserved && (
                              <span style={{ color: '#94A3B8' }}> → {r.emotionalStateEnd}</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {r.progressNoted
                              ? <Badge label="Yes" bg="#DCFCE7" text="#166534" />
                              : <Badge label="No" bg="#F1F5F9" text="#64748B" />}
                          </td>
                          <td style={tdStyle}>
                            {r.concernsFlagged
                              ? <Badge label="Flagged" bg="#FEF9C3" text="#854D0E" />
                              : <Badge label="None" bg="#F1F5F9" text="#64748B" />}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {canWrite && <button type="button" style={actionBtn('#1E40AF', '#93C5FD')} onClick={() => openEdit(r)}>Edit</button>}
                              {canWrite && <button type="button" style={actionBtn('#DC2626', '#FCA5A5')} onClick={() => setDeleteTarget(r)}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && (
                <div style={{
                  padding: '14px 20px', borderTop: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Page {data.page} of {data.totalPages || 1} · {data.totalCount} total
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))} style={navBtn(page <= 1 || loading)}>← Prev</button>
                    <button type="button" disabled={loading || page >= (data.totalPages || 1)} onClick={() => setPage(p => p + 1)} style={navBtn(loading || page >= (data.totalPages || 1))}>Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────────── */}
      {editTarget !== null && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sessionModalTitle"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--hw-bg-lavender2)', borderBottom: 'none' }}>
                <h5 className="modal-title hw-heading mb-0" id="sessionModalTitle">
                  {isEditing ? `Edit session — ${fmtDate((editTarget as ProcessRecording).sessionDate)}` : 'Record session'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setEditTarget(null)} />
              </div>

              <div className="modal-body">
                {formError && <div className="hw-alert-error mb-3">{formError}</div>}
                <div className="row g-3">
                  {!residentId && (
                    <div className="col-md-4">
                      <label className="hw-label">Resident ID <span className="text-danger">*</span></label>
                      <input type="number" min="1" className="hw-input" value={form.residentId || ''} onChange={(e) => setField('residentId', Number(e.target.value))} />
                    </div>
                  )}
                  <div className="col-md-4">
                    <label className="hw-label">Session Date <span className="text-danger">*</span></label>
                    <input type="date" className="hw-input" value={form.sessionDate ?? ''} onChange={(e) => setField('sessionDate', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Social Worker <span className="text-danger">*</span></label>
                    <input className="hw-input" value={form.socialWorker ?? ''} onChange={(e) => setField('socialWorker', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Session Type <span className="text-danger">*</span></label>
                    <select className="hw-input" value={form.sessionType ?? 'Individual'} onChange={(e) => setField('sessionType', e.target.value)}>
                      {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Duration (minutes)</label>
                    <input type="number" min="0" className="hw-input" value={form.sessionDurationMinutes ?? ''} onChange={(e) => setField('sessionDurationMinutes', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Emotional State (Start)</label>
                    <select className="hw-input" value={form.emotionalStateObserved ?? ''} onChange={(e) => setField('emotionalStateObserved', e.target.value)}>
                      <option value="">Select…</option>
                      {EMOTIONAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Emotional State (End)</label>
                    <select className="hw-input" value={form.emotionalStateEnd ?? ''} onChange={(e) => setField('emotionalStateEnd', e.target.value)}>
                      <option value="">Select…</option>
                      {EMOTIONAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="hw-label">Session Narrative</label>
                    <textarea className="hw-input" rows={4} placeholder="Describe what happened during the session…" value={form.sessionNarrative ?? ''} onChange={(e) => setField('sessionNarrative', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Interventions Applied</label>
                    <textarea className="hw-input" rows={3} value={form.interventionsApplied ?? ''} onChange={(e) => setField('interventionsApplied', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Follow-up Actions</label>
                    <textarea className="hw-input" rows={3} value={form.followUpActions ?? ''} onChange={(e) => setField('followUpActions', e.target.value)} />
                  </div>
                  <div className="col-12 d-flex gap-4 flex-wrap">
                    {([
                      { key: 'progressNoted' as const, label: 'Progress Noted' },
                      { key: 'concernsFlagged' as const, label: 'Concerns Flagged' },
                      { key: 'referralMade' as const, label: 'Referral Made' },
                    ] as const).map(({ key, label }) => (
                      <div key={key} className="form-check">
                        <input type="checkbox" className="form-check-input hw-check" id={`pr-${key}`} checked={!!form[key]} onChange={(e) => setField(key, e.target.checked)} />
                        <label className="form-check-label" htmlFor={`pr-${key}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--hw-bg-lavender2)' }}>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="button" className="btn hw-btn-magenta px-4" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `session on ${fmtDate(deleteTarget.sessionDate)}` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
