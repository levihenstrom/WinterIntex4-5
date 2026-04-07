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

// ── Constants ─────────────────────────────────────────────────────────────────

const VISIT_TYPES = [
  'Initial Assessment',
  'Routine Follow-up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
];
const COOPERATION_LEVELS = ['Cooperative', 'Partially Cooperative', 'Uncooperative', 'Not Present'];

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

function visitTypeBadgeClass(type: string | null): string {
  const map: Record<string, string> = {
    Emergency: 'badge rounded-pill text-bg-danger',
    'Initial Assessment': 'badge rounded-pill text-bg-primary',
    'Routine Follow-up': 'badge rounded-pill text-bg-info',
    'Reintegration Assessment': 'badge rounded-pill text-bg-success',
    'Post-Placement Monitoring': 'badge rounded-pill text-bg-warning',
  };
  return map[type ?? ''] ?? 'badge rounded-pill bg-light text-dark border';
}

// ── Blank form ────────────────────────────────────────────────────────────────

type FormData = Omit<HomeVisitation, 'visitationId'>;

function emptyForm(residentId: number): FormData {
  return {
    residentId,
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

function visitToForm(v: HomeVisitation): FormData {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function VisitsPage() {
  const { id } = useParams<{ id?: string }>();
  const residentId = id ? Number(id) : null;
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<HomeVisitation> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [editTarget, setEditTarget] = useState<HomeVisitation | 'new' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm(residentId ?? 0));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<HomeVisitation | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPaged<HomeVisitation>(
      '/api/home-visitations',
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

  function openEdit(v: HomeVisitation) {
    setForm(visitToForm(v));
    setFormError(null);
    setEditTarget(v);
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
        visitDate: form.visitDate?.trim() ? form.visitDate : null,
      };
      if (editTarget === 'new') {
        await postJson<HomeVisitation>('/api/home-visitations', payload);
      } else if (editTarget) {
        await putJson(`/api/home-visitations/${(editTarget as HomeVisitation).visitationId}`, {
          ...payload,
          visitationId: (editTarget as HomeVisitation).visitationId,
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
      await deleteJson(`/api/home-visitations/${deleteTarget.visitationId}`);
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
                <Link to="/admin/residents" className="hw-link">Residents</Link>
              </li>
              <li className="breadcrumb-item active">
                Field visits — Resident {residentId}
              </li>
            </ol>
          </nav>
        )}

        {/* Header */}
        <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
          <div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#0D9488',
                letterSpacing: 2,
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Case management
            </span>
            <h1
              className="mb-0"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 28,
                color: '#1E3A5F',
                lineHeight: 1.2,
              }}
            >
              <i className="bi bi-house-door me-2" style={{ color: '#0D9488' }} aria-hidden />
              Field visits
              {residentId && (
                <span style={{ fontSize: 16, color: '#64748B', fontWeight: 400, marginLeft: 8 }}>
                  — Resident {residentId}
                </span>
              )}
            </h1>
            {data && (
              <p className="text-muted small mb-0 mt-1">
                {data.totalCount} visit{data.totalCount !== 1 ? 's' : ''} logged
              </p>
            )}
          </div>
          {canWrite && (
            <button
              type="button"
              className="btn hw-btn-magenta px-4 py-2 rounded-3 fw-semibold d-inline-flex align-items-center gap-2"
              onClick={openCreate}
            >
              <i className="bi bi-house-add" aria-hidden />
              Record visit
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
              No visits logged yet.{' '}
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-link p-0 hw-link"
                  onClick={openCreate}
                >
                  Record the first visit.
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
                      <th>Visit Type</th>
                      <th>Location</th>
                      <th>Family Cooperation</th>
                      <th>Safety</th>
                      <th>Follow-up</th>
                      <th className="pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((v) => (
                      <tr key={v.visitationId}>
                        {!residentId && (
                          <td className="ps-3">
                            <Link
                              to={`/admin/residents/${v.residentId}/visits`}
                              className="hw-link"
                            >
                              {v.residentId}
                            </Link>
                          </td>
                        )}
                        <td
                          className="ps-3 fw-semibold"
                          style={{ color: 'var(--hw-purple)' }}
                        >
                          {fmtDate(v.visitDate)}
                        </td>
                        <td className="small">{v.socialWorker || '—'}</td>
                        <td>
                          <span className={visitTypeBadgeClass(v.visitType)}>
                            {v.visitType || '—'}
                          </span>
                        </td>
                        <td className="small text-muted">{v.locationVisited || '—'}</td>
                        <td className="small">{v.familyCooperationLevel || '—'}</td>
                        <td>
                          {v.safetyConcernsNoted ? (
                            <span className="badge rounded-pill text-bg-danger">Yes</span>
                          ) : (
                            <span className="badge rounded-pill bg-light text-dark border">No</span>
                          )}
                        </td>
                        <td>
                          {v.followUpNeeded ? (
                            <span className="badge rounded-pill text-bg-warning">Needed</span>
                          ) : (
                            <span className="badge rounded-pill bg-light text-dark border">No</span>
                          )}
                        </td>
                        <td className="pe-3">
                          <div className="d-flex gap-1">
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openEdit(v)}
                              >
                                Edit
                              </button>
                            )}
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setDeleteTarget(v)}
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
          aria-labelledby="visitModalTitle"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content">
              <div
                className="modal-header"
                style={{ background: 'var(--hw-bg-lavender2)', borderBottom: 'none' }}
              >
                <h5 className="modal-title hw-heading mb-0" id="visitModalTitle">
                  {isEditing
                    ? `Edit visit — ${fmtDate((editTarget as HomeVisitation).visitDate)}`
                    : 'Record visit'}
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
                      Visit Date <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className="hw-input"
                      value={form.visitDate ?? ''}
                      onChange={(e) => setField('visitDate', e.target.value)}
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
                      Visit Type <span className="text-danger">*</span>
                    </label>
                    <select
                      className="hw-input"
                      value={form.visitType ?? ''}
                      onChange={(e) => setField('visitType', e.target.value)}
                    >
                      {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Location Visited</label>
                    <input
                      className="hw-input"
                      value={form.locationVisited ?? ''}
                      onChange={(e) => setField('locationVisited', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="hw-label">Family Cooperation Level</label>
                    <select
                      className="hw-input"
                      value={form.familyCooperationLevel ?? ''}
                      onChange={(e) => setField('familyCooperationLevel', e.target.value)}
                    >
                      <option value="">Select…</option>
                      {COOPERATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Family Members Present</label>
                    <input
                      className="hw-input"
                      value={form.familyMembersPresent ?? ''}
                      onChange={(e) => setField('familyMembersPresent', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Purpose</label>
                    <input
                      className="hw-input"
                      value={form.purpose ?? ''}
                      onChange={(e) => setField('purpose', e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="hw-label">Observations</label>
                    <textarea
                      className="hw-input"
                      rows={3}
                      placeholder="Observations about the home environment, family situation…"
                      value={form.observations ?? ''}
                      onChange={(e) => setField('observations', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Follow-up Notes</label>
                    <textarea
                      className="hw-input"
                      rows={2}
                      value={form.followUpNotes ?? ''}
                      onChange={(e) => setField('followUpNotes', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="hw-label">Visit Outcome</label>
                    <input
                      className="hw-input"
                      value={form.visitOutcome ?? ''}
                      onChange={(e) => setField('visitOutcome', e.target.value)}
                    />
                  </div>

                  <div className="col-12 d-flex gap-4 flex-wrap">
                    {(
                      [
                        { key: 'safetyConcernsNoted' as const, label: 'Safety Concerns Noted' },
                        { key: 'followUpNeeded' as const, label: 'Follow-up Needed' },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input hw-check"
                          id={`v-${key}`}
                          checked={!!form[key]}
                          onChange={(e) => setField(key, e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor={`v-${key}`}>
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
                  {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Record visit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `visit on ${fmtDate(deleteTarget.visitDate)}` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
