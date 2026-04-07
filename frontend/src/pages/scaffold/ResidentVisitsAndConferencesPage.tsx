import { useEffect, useState } from 'react';
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

  // ── Case Conferences state ────────────────────────────────────────────────────
  const [confPage, setConfPage] = useState(1);
  const [confData, setConfData] = useState<PagedResult<CaseConference> | null>(null);
  const [confLoading, setConfLoading] = useState(true);
  const [confError, setConfError] = useState<string | null>(null);

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

  // ── Fetch upcoming conferences ────────────────────────────────────────────────
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
        <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
          <div>
            <p className="hw-eyebrow mb-1">Case Management</p>
            <h1 className="hw-heading mb-0" style={{ fontSize: '1.75rem' }}>
              Home Visitations
            </h1>
            {visitData && (
              <p className="text-muted small mb-0 mt-1">
                {visitData.totalCount} visit{visitData.totalCount !== 1 ? 's' : ''} logged
              </p>
            )}
          </div>
          {canWrite && (
            <button
              type="button"
              className="btn hw-btn-magenta px-4 py-2 rounded-3 fw-semibold"
              onClick={openCreate}
            >
              + Log Visit
            </button>
          )}
        </div>

        {visitError && <div className="hw-alert-error mb-3">{visitError}</div>}

        <div className="card border-0 shadow-sm rounded-3 mb-5">
          {visitLoading ? (
            <div className="card-body text-center py-5 text-muted">Loading…</div>
          ) : visitData && visitData.items.length === 0 ? (
            <div className="card-body text-center py-5 text-muted">No visits logged yet.</div>
          ) : visitData ? (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle mb-0">
                  <thead style={{ background: 'var(--hw-bg-lavender2)', color: 'var(--hw-navy)' }}>
                    <tr>
                      <th className="ps-3 py-3">Resident</th>
                      <th>Date</th>
                      <th>Social Worker</th>
                      <th>Visit Type</th>
                      <th>Location</th>
                      <th>Cooperation</th>
                      <th>Safety</th>
                      <th>Follow-up</th>
                      <th className="pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitData.items.map((v) => (
                      <tr key={v.visitationId}>
                        <td className="ps-3">
                          <Link
                            to={`/admin/residents/${v.residentId}/visits`}
                            className="hw-link"
                          >
                            {v.residentId}
                          </Link>
                        </td>
                        <td
                          className="fw-semibold"
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
                  Page {visitData.page} of {visitData.totalPages || 1} · {visitData.totalCount} total
                </span>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={visitPage <= 1 || visitLoading}
                    onClick={() => setVisitPage((p) => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={visitLoading || visitPage >= (visitData.totalPages || 1)}
                    onClick={() => setVisitPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* ── Section: Upcoming Case Conferences ─────────────────────────────── */}
        <div className="mb-4">
          <p className="hw-eyebrow mb-1">Scheduling</p>
          <h2 className="hw-heading mb-0" style={{ fontSize: '1.4rem' }}>
            Upcoming Case Conferences
          </h2>
          <p className="text-muted small mt-1">
            Pulled from intervention plans with a scheduled conference date.
          </p>
        </div>

        {confError && <div className="hw-alert-error mb-3">{confError}</div>}

        <div className="card border-0 shadow-sm rounded-3">
          {confLoading ? (
            <div className="card-body text-center py-4 text-muted">Loading…</div>
          ) : confData && confData.items.length === 0 ? (
            <div className="card-body text-center py-4 text-muted">
              No upcoming case conferences scheduled.
            </div>
          ) : confData ? (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle mb-0">
                  <thead style={{ background: 'var(--hw-bg-lavender2)', color: 'var(--hw-navy)' }}>
                    <tr>
                      <th className="ps-3 py-3">Conference Date</th>
                      <th>Resident</th>
                      <th>Plan Category</th>
                      <th>Description</th>
                      <th className="pe-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confData.items.map((c) => (
                      <tr key={c.planId}>
                        <td
                          className="ps-3 fw-semibold"
                          style={{ color: 'var(--hw-teal)' }}
                        >
                          {fmtDate(c.caseConferenceDate)}
                        </td>
                        <td>
                          <Link
                            to={`/admin/residents/${c.residentId}/process`}
                            className="hw-link"
                          >
                            Resident {c.residentId}
                          </Link>
                        </td>
                        <td className="small">{c.planCategory || '—'}</td>
                        <td
                          className="small text-muted"
                          style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {c.planDescription || '—'}
                        </td>
                        <td className="pe-3">
                          <span className="badge rounded-pill bg-light text-dark border">
                            {c.status || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-footer bg-transparent d-flex align-items-center justify-content-between py-3">
                <span className="small text-muted">
                  {confData.totalCount} upcoming conference{confData.totalCount !== 1 ? 's' : ''}
                </span>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={confPage <= 1 || confLoading}
                    onClick={() => setConfPage((p) => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={confLoading || confPage >= (confData.totalPages || 1)}
                    onClick={() => setConfPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          ) : null}
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
              <div
                className="modal-header"
                style={{ background: 'var(--hw-bg-lavender2)', borderBottom: 'none' }}
              >
                <h5 className="modal-title hw-heading mb-0" id="visitModal2Title">
                  {isEditing
                    ? `Edit Visit — ${fmtDate((editTarget as HomeVisitation).visitDate)}`
                    : 'Log New Visit'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setEditTarget(null)} />
              </div>
              <div className="modal-body">
                {formError && <div className="hw-alert-error mb-3">{formError}</div>}
                <div className="row g-3">
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
                    <label className="hw-label">Visit Type <span className="text-danger">*</span></label>
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
                          id={`vc2-${key}`}
                          checked={!!form[key]}
                          onChange={(e) => setField(key, e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor={`vc2-${key}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--hw-bg-lavender2)' }}>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditTarget(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn hw-btn-magenta px-4"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Log Visit'}
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
