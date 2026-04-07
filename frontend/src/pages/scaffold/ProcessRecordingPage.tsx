import { useEffect, useState } from 'react';
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
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">

        {/* Breadcrumb when viewing per-resident */}
        {residentId && (
          <nav aria-label="breadcrumb" className="mb-3">
            <ol className="breadcrumb small">
              <li className="breadcrumb-item">
                <Link to="/admin/residents" className="hw-link">Caseload Inventory</Link>
              </li>
              <li className="breadcrumb-item active">
                Process Recordings — Resident {residentId}
              </li>
            </ol>
          </nav>
        )}

        {/* Header */}
        <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
          <div>
            <p className="hw-eyebrow mb-1">Case Management</p>
            <h1 className="hw-heading mb-0" style={{ fontSize: '1.75rem' }}>
              Process Recordings
              {residentId && (
                <span className="small text-muted ms-2 fw-normal">
                  — Resident {residentId}
                </span>
              )}
            </h1>
            {data && (
              <p className="text-muted small mb-0 mt-1">
                {data.totalCount} session{data.totalCount !== 1 ? 's' : ''} recorded
              </p>
            )}
          </div>
          {canWrite && (
            <button
              type="button"
              className="btn hw-btn-magenta px-4 py-2 rounded-3 fw-semibold"
              onClick={openCreate}
            >
              + New Session
            </button>
          )}
        </div>

        {error && <div className="hw-alert-error mb-3">{error}</div>}

        {/* Table card */}
        <div className="card border-0 shadow-sm rounded-3">
          {loading ? (
            <div className="card-body text-center py-5 text-muted">Loading…</div>
          ) : data && data.items.length === 0 ? (
            <div className="card-body text-center py-5 text-muted">
              No sessions recorded yet.{' '}
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-link p-0 hw-link"
                  onClick={openCreate}
                >
                  Log the first session.
                </button>
              )}
            </div>
          ) : data ? (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle mb-0">
                  <thead style={{ background: 'var(--hw-bg-lavender2)', color: 'var(--hw-navy)' }}>
                    <tr>
                      {!residentId && <th className="ps-3 py-3">Resident</th>}
                      <th className="ps-3 py-3">Date</th>
                      <th>Social Worker</th>
                      <th>Type</th>
                      <th>Duration</th>
                      <th>Emotional State</th>
                      <th>Progress</th>
                      <th>Concerns</th>
                      <th className="pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.recordingId}>
                        {!residentId && (
                          <td className="ps-3">
                            <Link
                              to={`/admin/residents/${r.residentId}/process`}
                              className="hw-link"
                            >
                              {r.residentId}
                            </Link>
                          </td>
                        )}
                        <td
                          className="ps-3 fw-semibold"
                          style={{ color: 'var(--hw-purple)' }}
                        >
                          {fmtDate(r.sessionDate)}
                        </td>
                        <td className="small">{r.socialWorker || '—'}</td>
                        <td>
                          <span
                            className={`badge rounded-pill ${
                              r.sessionType === 'Individual'
                                ? 'text-bg-primary'
                                : r.sessionType === 'Group'
                                ? 'text-bg-info'
                                : 'text-bg-secondary'
                            }`}
                          >
                            {r.sessionType || '—'}
                          </span>
                        </td>
                        <td className="small text-muted">
                          {r.sessionDurationMinutes != null
                            ? `${r.sessionDurationMinutes} min`
                            : '—'}
                        </td>
                        <td className="small">
                          {r.emotionalStateObserved || '—'}
                          {r.emotionalStateEnd &&
                            r.emotionalStateObserved &&
                            r.emotionalStateEnd !== r.emotionalStateObserved && (
                              <span className="text-muted"> → {r.emotionalStateEnd}</span>
                            )}
                        </td>
                        <td>
                          {r.progressNoted ? (
                            <span className="badge rounded-pill text-bg-success">Yes</span>
                          ) : (
                            <span className="badge rounded-pill bg-light text-dark border">No</span>
                          )}
                        </td>
                        <td>
                          {r.concernsFlagged ? (
                            <span className="badge rounded-pill text-bg-warning">Flagged</span>
                          ) : (
                            <span className="badge rounded-pill bg-light text-dark border">None</span>
                          )}
                        </td>
                        <td className="pe-3">
                          <div className="d-flex gap-1">
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openEdit(r)}
                              >
                                Edit
                              </button>
                            )}
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setDeleteTarget(r)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-footer bg-transparent d-flex align-items-center justify-content-between py-3">
                <span className="small text-muted">
                  Page {data.page} of {data.totalPages || 1} · {data.totalCount} total
                </span>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={loading || page >= (data.totalPages || 1)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          ) : null}
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
              <div
                className="modal-header"
                style={{ background: 'var(--hw-bg-lavender2)', borderBottom: 'none' }}
              >
                <h5 className="modal-title hw-heading mb-0" id="sessionModalTitle">
                  {isEditing
                    ? `Edit Session — ${fmtDate((editTarget as ProcessRecording).sessionDate)}`
                    : 'New Session'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditTarget(null)}
                />
              </div>

              <div className="modal-body">
                {formError && <div className="hw-alert-error mb-3">{formError}</div>}

                <div className="row g-3">
                  {/* Resident ID — only editable when not filtering by resident */}
                  {!residentId && (
                    <div className="col-md-4">
                      <label className="hw-label">
                        Resident ID <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="hw-input"
                        value={form.residentId || ''}
                        onChange={(e) => setField('residentId', Number(e.target.value))}
                      />
                    </div>
                  )}

                  <div className="col-md-4">
                    <label className="hw-label">
                      Session Date <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className="hw-input"
                      value={form.sessionDate ?? ''}
                      onChange={(e) => setField('sessionDate', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">
                      Social Worker <span className="text-danger">*</span>
                    </label>
                    <input
                      className="hw-input"
                      value={form.socialWorker ?? ''}
                      onChange={(e) => setField('socialWorker', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">
                      Session Type <span className="text-danger">*</span>
                    </label>
                    <select
                      className="hw-input"
                      value={form.sessionType ?? 'Individual'}
                      onChange={(e) => setField('sessionType', e.target.value)}
                    >
                      {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Duration (minutes)</label>
                    <input
                      type="number"
                      min="0"
                      className="hw-input"
                      value={form.sessionDurationMinutes ?? ''}
                      onChange={(e) =>
                        setField(
                          'sessionDurationMinutes',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Emotional State (Start)</label>
                    <select
                      className="hw-input"
                      value={form.emotionalStateObserved ?? ''}
                      onChange={(e) => setField('emotionalStateObserved', e.target.value)}
                    >
                      <option value="">Select…</option>
                      {EMOTIONAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Emotional State (End)</label>
                    <select
                      className="hw-input"
                      value={form.emotionalStateEnd ?? ''}
                      onChange={(e) => setField('emotionalStateEnd', e.target.value)}
                    >
                      <option value="">Select…</option>
                      {EMOTIONAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="hw-label">Session Narrative</label>
                    <textarea
                      className="hw-input"
                      rows={4}
                      placeholder="Describe what happened during the session…"
                      value={form.sessionNarrative ?? ''}
                      onChange={(e) => setField('sessionNarrative', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Interventions Applied</label>
                    <textarea
                      className="hw-input"
                      rows={3}
                      value={form.interventionsApplied ?? ''}
                      onChange={(e) => setField('interventionsApplied', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Follow-up Actions</label>
                    <textarea
                      className="hw-input"
                      rows={3}
                      value={form.followUpActions ?? ''}
                      onChange={(e) => setField('followUpActions', e.target.value)}
                    />
                  </div>

                  <div className="col-12 d-flex gap-4 flex-wrap">
                    {(
                      [
                        { key: 'progressNoted' as const, label: 'Progress Noted' },
                        { key: 'concernsFlagged' as const, label: 'Concerns Flagged' },
                        { key: 'referralMade' as const, label: 'Referral Made' },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input hw-check"
                          id={`pr-${key}`}
                          checked={!!form[key]}
                          onChange={(e) => setField(key, e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor={`pr-${key}`}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="modal-footer"
                style={{ borderTop: '1px solid var(--hw-bg-lavender2)' }}
              >
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setEditTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn hw-btn-magenta px-4"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `session on ${fmtDate(deleteTarget.sessionDate)}` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
