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

interface Resident {
  residentId: number;
  caseControlNo: string | null;
  internalCode: string | null;
  safehouseId: number;
  caseStatus: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  birthStatus: string | null;
  placeOfBirth: string | null;
  religion: string | null;
  caseCategory: string | null;
  subCatOrphaned: boolean | null;
  subCatTrafficked: boolean | null;
  subCatChildLabor: boolean | null;
  subCatPhysicalAbuse: boolean | null;
  subCatSexualAbuse: boolean | null;
  subCatOsaec: boolean | null;
  subCatCicl: boolean | null;
  subCatAtRisk: boolean | null;
  subCatStreetChild: boolean | null;
  subCatChildWithHiv: boolean | null;
  isPwd: boolean | null;
  pwdType: string | null;
  hasSpecialNeeds: boolean | null;
  specialNeedsDiagnosis: string | null;
  familyIs4ps: boolean | null;
  familySoloParent: boolean | null;
  familyIndigenous: boolean | null;
  familyParentPwd: boolean | null;
  familyInformalSettler: boolean | null;
  dateOfAdmission: string | null;
  ageUponAdmission: string | null;
  presentAge: string | null;
  lengthOfStay: string | null;
  referralSource: string | null;
  referringAgencyPerson: string | null;
  assignedSocialWorker: string | null;
  initialCaseAssessment: string | null;
  reintegrationType: string | null;
  reintegrationStatus: string | null;
  initialRiskLevel: string | null;
  currentRiskLevel: string | null;
  dateEnrolled: string | null;
  dateClosed: string | null;
  notesRestricted: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CASE_STATUSES = ['Active', 'Closed', 'Transferred', 'Referred', 'Discharged', 'Pending'];
const CASE_CATEGORIES = [
  'Abused', 'Neglected', 'Abandoned', 'Trafficked', 'Child Labor',
  'OSAEC', 'CICL', 'At-Risk', 'Street Child', 'Child with HIV', 'Orphaned',
];
const SEXES = ['Female', 'Male'];
const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
const REINTEGRATION_TYPES = [
  'Family', 'Extended Family', 'Foster Care', 'Adoption', 'Independent Living', 'Not Applicable',
];
const REINTEGRATION_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Failed'];

const SUB_CATS: { key: keyof Resident; label: string }[] = [
  { key: 'subCatOrphaned', label: 'Orphaned/Abandoned' },
  { key: 'subCatTrafficked', label: 'Trafficked' },
  { key: 'subCatChildLabor', label: 'Child Labor' },
  { key: 'subCatPhysicalAbuse', label: 'Physical Abuse' },
  { key: 'subCatSexualAbuse', label: 'Sexual Abuse' },
  { key: 'subCatOsaec', label: 'OSAEC' },
  { key: 'subCatCicl', label: 'CICL' },
  { key: 'subCatAtRisk', label: 'At Risk' },
  { key: 'subCatStreetChild', label: 'Street Child' },
  { key: 'subCatChildWithHiv', label: 'Child with HIV' },
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

function dateOrNull(s: string | null | undefined): string | null {
  return s?.trim() ? s : null;
}

function statusBadgeClass(status: string | null): string {
  const map: Record<string, string> = {
    Active: 'badge rounded-pill text-bg-success',
    Closed: 'badge rounded-pill text-bg-secondary',
    Transferred: 'badge rounded-pill text-bg-info',
    Referred: 'badge rounded-pill text-bg-primary',
    Discharged: 'badge rounded-pill text-bg-warning',
    Pending: 'badge rounded-pill bg-light text-dark border',
  };
  return map[status ?? ''] ?? 'badge rounded-pill bg-light text-dark border';
}

function riskBadgeClass(risk: string | null): string {
  const map: Record<string, string> = {
    Low: 'badge rounded-pill text-bg-success',
    Medium: 'badge rounded-pill text-bg-warning',
    High: 'badge rounded-pill text-bg-danger',
    Critical: 'badge rounded-pill bg-dark text-white',
  };
  return map[risk ?? ''] ?? 'badge rounded-pill bg-light text-dark border';
}

// ── Blank form ────────────────────────────────────────────────────────────────

type FormData = Omit<Resident, 'residentId'>;

function emptyForm(): FormData {
  return {
    caseControlNo: '', internalCode: '', safehouseId: 1,
    caseStatus: 'Active', sex: '', dateOfBirth: '',
    birthStatus: '', placeOfBirth: '', religion: '',
    caseCategory: '',
    subCatOrphaned: false, subCatTrafficked: false, subCatChildLabor: false,
    subCatPhysicalAbuse: false, subCatSexualAbuse: false, subCatOsaec: false,
    subCatCicl: false, subCatAtRisk: false, subCatStreetChild: false,
    subCatChildWithHiv: false,
    isPwd: false, pwdType: '', hasSpecialNeeds: false, specialNeedsDiagnosis: '',
    familyIs4ps: false, familySoloParent: false, familyIndigenous: false,
    familyParentPwd: false, familyInformalSettler: false,
    dateOfAdmission: '', ageUponAdmission: '', presentAge: '', lengthOfStay: '',
    referralSource: '', referringAgencyPerson: '',
    assignedSocialWorker: '', initialCaseAssessment: '',
    reintegrationType: '', reintegrationStatus: '',
    initialRiskLevel: '', currentRiskLevel: '',
    dateEnrolled: '', dateClosed: '', notesRestricted: '',
  };
}

function residentToForm(r: Resident): FormData {
  return {
    caseControlNo: r.caseControlNo ?? '',
    internalCode: r.internalCode ?? '',
    safehouseId: r.safehouseId,
    caseStatus: r.caseStatus ?? 'Active',
    sex: r.sex ?? '',
    dateOfBirth: toDateInput(r.dateOfBirth),
    birthStatus: r.birthStatus ?? '',
    placeOfBirth: r.placeOfBirth ?? '',
    religion: r.religion ?? '',
    caseCategory: r.caseCategory ?? '',
    subCatOrphaned: r.subCatOrphaned ?? false,
    subCatTrafficked: r.subCatTrafficked ?? false,
    subCatChildLabor: r.subCatChildLabor ?? false,
    subCatPhysicalAbuse: r.subCatPhysicalAbuse ?? false,
    subCatSexualAbuse: r.subCatSexualAbuse ?? false,
    subCatOsaec: r.subCatOsaec ?? false,
    subCatCicl: r.subCatCicl ?? false,
    subCatAtRisk: r.subCatAtRisk ?? false,
    subCatStreetChild: r.subCatStreetChild ?? false,
    subCatChildWithHiv: r.subCatChildWithHiv ?? false,
    isPwd: r.isPwd ?? false,
    pwdType: r.pwdType ?? '',
    hasSpecialNeeds: r.hasSpecialNeeds ?? false,
    specialNeedsDiagnosis: r.specialNeedsDiagnosis ?? '',
    familyIs4ps: r.familyIs4ps ?? false,
    familySoloParent: r.familySoloParent ?? false,
    familyIndigenous: r.familyIndigenous ?? false,
    familyParentPwd: r.familyParentPwd ?? false,
    familyInformalSettler: r.familyInformalSettler ?? false,
    dateOfAdmission: toDateInput(r.dateOfAdmission),
    ageUponAdmission: r.ageUponAdmission ?? '',
    presentAge: r.presentAge ?? '',
    lengthOfStay: r.lengthOfStay ?? '',
    referralSource: r.referralSource ?? '',
    referringAgencyPerson: r.referringAgencyPerson ?? '',
    assignedSocialWorker: r.assignedSocialWorker ?? '',
    initialCaseAssessment: r.initialCaseAssessment ?? '',
    reintegrationType: r.reintegrationType ?? '',
    reintegrationStatus: r.reintegrationStatus ?? '',
    initialRiskLevel: r.initialRiskLevel ?? '',
    currentRiskLevel: r.currentRiskLevel ?? '',
    dateEnrolled: toDateInput(r.dateEnrolled),
    dateClosed: toDateInput(r.dateClosed),
    notesRestricted: r.notesRestricted ?? '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResidentsListPage() {
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  // Filter inputs (uncommitted)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Applied filters (trigger fetch)
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('');

  // Pagination & data
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<Resident> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Create/edit modal
  const [editTarget, setEditTarget] = useState<Resident | 'new' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const extra: Record<string, string | number | undefined> = {};
    if (appliedStatus) extra.caseStatus = appliedStatus;
    if (appliedCategory) extra.caseCategory = appliedCategory;
    if (appliedSearch) extra.search = appliedSearch;
    fetchPaged<Resident>('/api/residents', page, 20, extra)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, appliedStatus, appliedCategory, appliedSearch, reloadToken]);

  // ── Filter actions ────────────────────────────────────────────────────────────
  function applyFilters() {
    setPage(1);
    setAppliedSearch(search);
    setAppliedStatus(statusFilter);
    setAppliedCategory(categoryFilter);
  }

  function resetFilters() {
    setSearch(''); setStatusFilter(''); setCategoryFilter('');
    setPage(1);
    setAppliedSearch(''); setAppliedStatus(''); setAppliedCategory('');
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(emptyForm());
    setFormError(null);
    setEditTarget('new');
  }

  function openEdit(r: Resident) {
    setForm(residentToForm(r));
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
        safehouseId: Number(form.safehouseId),
        dateOfBirth: dateOrNull(form.dateOfBirth as string),
        dateOfAdmission: dateOrNull(form.dateOfAdmission as string),
        dateEnrolled: dateOrNull(form.dateEnrolled as string),
        dateClosed: dateOrNull(form.dateClosed as string),
      };
      if (editTarget === 'new') {
        await postJson<Resident>('/api/residents', payload);
      } else if (editTarget) {
        await putJson(`/api/residents/${editTarget.residentId}`, {
          ...payload,
          residentId: editTarget.residentId,
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
      await deleteJson(`/api/residents/${deleteTarget.residentId}`);
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

        {/* Page header */}
        <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-3">
          <div>
            <p className="hw-eyebrow mb-1">Case Management</p>
            <h1 className="hw-heading mb-0" style={{ fontSize: '1.75rem' }}>Caseload Inventory</h1>
            {data && (
              <p className="text-muted small mb-0 mt-1">
                {data.totalCount} resident{data.totalCount !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          {canWrite && (
            <button
              type="button"
              className="btn hw-btn-magenta px-4 py-2 rounded-3 fw-semibold"
              onClick={openCreate}
            >
              + New Resident
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="card border-0 shadow-sm mb-4 rounded-3">
          <div className="card-body py-3">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-4">
                <label className="hw-label">Search</label>
                <input
                  type="text"
                  className="hw-input"
                  placeholder="Case no, internal code, social worker…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="hw-label">Case Status</label>
                <select
                  className="hw-input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="hw-label">Case Category</label>
                <select
                  className="hw-input"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All categories</option>
                  {CASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-2 d-flex gap-2">
                <button type="button" className="btn hw-btn-magenta flex-grow-1" onClick={applyFilters}>
                  Search
                </button>
                <button
                  type="button"
                  className="btn hw-btn-ghost-purple"
                  onClick={resetFilters}
                  title="Reset filters"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <div className="hw-alert-error mb-3">{error}</div>}

        {/* Table card */}
        <div className="card border-0 shadow-sm rounded-3">
          {loading ? (
            <div className="card-body text-center py-5 text-muted">Loading…</div>
          ) : data && data.items.length === 0 ? (
            <div className="card-body text-center py-5 text-muted">
              No residents found matching the current filters.
            </div>
          ) : data ? (
            <>
              <div className="table-responsive">
                <table className="table table-hover table-sm align-middle mb-0">
                  <thead style={{ background: 'var(--hw-bg-lavender2)', color: 'var(--hw-navy)' }}>
                    <tr>
                      <th className="ps-3 py-3">Case No</th>
                      <th>Internal Code</th>
                      <th>DOB</th>
                      <th>Sex</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Safehouse</th>
                      <th>Social Worker</th>
                      <th>Risk</th>
                      <th className="pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.residentId}>
                        <td className="ps-3 fw-semibold" style={{ color: 'var(--hw-purple)' }}>
                          {r.caseControlNo || '—'}
                        </td>
                        <td className="text-muted small">{r.internalCode || '—'}</td>
                        <td className="small">{fmtDate(r.dateOfBirth)}</td>
                        <td>{r.sex || '—'}</td>
                        <td className="small">{r.caseCategory || '—'}</td>
                        <td>
                          <span className={statusBadgeClass(r.caseStatus)}>
                            {r.caseStatus || '—'}
                          </span>
                        </td>
                        <td>{r.safehouseId}</td>
                        <td className="small">{r.assignedSocialWorker || '—'}</td>
                        <td>
                          {r.currentRiskLevel
                            ? <span className={riskBadgeClass(r.currentRiskLevel)}>{r.currentRiskLevel}</span>
                            : <span className="text-muted small">—</span>}
                        </td>
                        <td className="pe-3">
                          <div className="d-flex gap-1 flex-nowrap">
                            {canWrite && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openEdit(r)}
                              >
                                Edit
                              </button>
                            )}
                            <Link
                              to={`/admin/residents/${r.residentId}/process`}
                              className="btn btn-sm btn-outline-secondary"
                              title="Process recordings"
                            >
                              Sessions
                            </Link>
                            <Link
                              to={`/admin/residents/${r.residentId}/visits`}
                              className="btn btn-sm btn-outline-secondary"
                              title="Home visits"
                            >
                              Visits
                            </Link>
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
          aria-labelledby="residentModalTitle"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content">
              <div
                className="modal-header"
                style={{ background: 'var(--hw-bg-lavender2)', borderBottom: 'none' }}
              >
                <h5 className="modal-title hw-heading mb-0" id="residentModalTitle">
                  {isEditing
                    ? `Edit Resident — ${(editTarget as Resident).caseControlNo || 'ID ' + (editTarget as Resident).residentId}`
                    : 'New Resident'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditTarget(null)}
                />
              </div>

              <div className="modal-body">
                {formError && <div className="hw-alert-error mb-3">{formError}</div>}

                {/* Case Identification */}
                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Case Identification</legend>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="hw-label">Case Control No</label>
                      <input
                        className="hw-input"
                        value={form.caseControlNo ?? ''}
                        onChange={(e) => setField('caseControlNo', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Internal Code</label>
                      <input
                        className="hw-input"
                        value={form.internalCode ?? ''}
                        onChange={(e) => setField('internalCode', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">
                        Safehouse ID <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="hw-input"
                        value={form.safehouseId}
                        onChange={(e) => setField('safehouseId', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Case Classification */}
                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Case Classification</legend>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="hw-label">
                        Case Status <span className="text-danger">*</span>
                      </label>
                      <select
                        className="hw-input"
                        value={form.caseStatus ?? ''}
                        onChange={(e) => setField('caseStatus', e.target.value)}
                      >
                        {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">
                        Case Category <span className="text-danger">*</span>
                      </label>
                      <select
                        className="hw-input"
                        value={form.caseCategory ?? ''}
                        onChange={(e) => setField('caseCategory', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {CASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Assigned Social Worker</label>
                      <input
                        className="hw-input"
                        value={form.assignedSocialWorker ?? ''}
                        onChange={(e) => setField('assignedSocialWorker', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="hw-label mb-2">Sub-Categories</label>
                    <div className="d-flex flex-wrap gap-3">
                      {SUB_CATS.map(({ key, label }) => (
                        <div key={String(key)} className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input hw-check"
                            id={`sc-${String(key)}`}
                            checked={!!(form[key as keyof FormData])}
                            onChange={(e) =>
                              setField(key as keyof FormData, e.target.checked as never)
                            }
                          />
                          <label className="form-check-label small" htmlFor={`sc-${String(key)}`}>
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </fieldset>

                {/* Personal Information */}
                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Personal Information</legend>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="hw-label">Sex</label>
                      <select
                        className="hw-input"
                        value={form.sex ?? ''}
                        onChange={(e) => setField('sex', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {SEXES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Date of Birth</label>
                      <input
                        type="date"
                        className="hw-input"
                        value={form.dateOfBirth ?? ''}
                        onChange={(e) => setField('dateOfBirth', e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Birth Status</label>
                      <input
                        className="hw-input"
                        value={form.birthStatus ?? ''}
                        onChange={(e) => setField('birthStatus', e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Religion</label>
                      <input
                        className="hw-input"
                        value={form.religion ?? ''}
                        onChange={(e) => setField('religion', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="hw-label">Place of Birth</label>
                      <input
                        className="hw-input"
                        value={form.placeOfBirth ?? ''}
                        onChange={(e) => setField('placeOfBirth', e.target.value)}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Disability & Special Needs */}
                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Disability &amp; Special Needs</legend>
                  <div className="row g-3 align-items-start">
                    <div className="col-md-3 pt-4">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input hw-check"
                          id="isPwd"
                          checked={!!form.isPwd}
                          onChange={(e) => setField('isPwd', e.target.checked)}
                        />
                        <label className="form-check-label hw-label mb-0" htmlFor="isPwd">
                          PWD
                        </label>
                      </div>
                    </div>
                    <div className="col-md-9">
                      <label className="hw-label">PWD Type</label>
                      <input
                        className="hw-input"
                        value={form.pwdType ?? ''}
                        onChange={(e) => setField('pwdType', e.target.value)}
                        disabled={!form.isPwd}
                      />
                    </div>
                    <div className="col-md-3 pt-2">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input hw-check"
                          id="hasSpecialNeeds"
                          checked={!!form.hasSpecialNeeds}
                          onChange={(e) => setField('hasSpecialNeeds', e.target.checked)}
                        />
                        <label className="form-check-label hw-label mb-0" htmlFor="hasSpecialNeeds">
                          Special Needs
                        </label>
                      </div>
                    </div>
                    <div className="col-md-9">
                      <label className="hw-label">Diagnosis</label>
                      <input
                        className="hw-input"
                        value={form.specialNeedsDiagnosis ?? ''}
                        onChange={(e) => setField('specialNeedsDiagnosis', e.target.value)}
                        disabled={!form.hasSpecialNeeds}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Family Profile */}
                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Family Socio-Demographic Profile</legend>
                  <div className="d-flex flex-wrap gap-4">
                    {(
                      [
                        { key: 'familyIs4ps' as const, label: '4Ps Beneficiary' },
                        { key: 'familySoloParent' as const, label: 'Solo Parent' },
                        { key: 'familyIndigenous' as const, label: 'Indigenous Group' },
                        { key: 'familyParentPwd' as const, label: 'Parent with Disability' },
                        { key: 'familyInformalSettler' as const, label: 'Informal Settler' },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input hw-check"
                          id={`fam-${key}`}
                          checked={!!form[key]}
                          onChange={(e) => setField(key, e.target.checked)}
                        />
                        <label className="form-check-label small" htmlFor={`fam-${key}`}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                {/* Admission & Referral */}
                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Admission &amp; Referral</legend>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="hw-label">Date of Admission</label>
                      <input
                        type="date"
                        className="hw-input"
                        value={form.dateOfAdmission ?? ''}
                        onChange={(e) => setField('dateOfAdmission', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Age Upon Admission</label>
                      <input
                        className="hw-input"
                        value={form.ageUponAdmission ?? ''}
                        onChange={(e) => setField('ageUponAdmission', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Present Age</label>
                      <input
                        className="hw-input"
                        value={form.presentAge ?? ''}
                        onChange={(e) => setField('presentAge', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="hw-label">Referral Source</label>
                      <input
                        className="hw-input"
                        value={form.referralSource ?? ''}
                        onChange={(e) => setField('referralSource', e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="hw-label">Referring Agency / Person</label>
                      <input
                        className="hw-input"
                        value={form.referringAgencyPerson ?? ''}
                        onChange={(e) => setField('referringAgencyPerson', e.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label className="hw-label">Initial Case Assessment</label>
                      <textarea
                        className="hw-input"
                        rows={2}
                        value={form.initialCaseAssessment ?? ''}
                        onChange={(e) => setField('initialCaseAssessment', e.target.value)}
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Risk & Reintegration */}
                <fieldset className="mb-2">
                  <legend className="hw-eyebrow mb-3">Risk &amp; Reintegration</legend>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="hw-label">Initial Risk Level</label>
                      <select
                        className="hw-input"
                        value={form.initialRiskLevel ?? ''}
                        onChange={(e) => setField('initialRiskLevel', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Current Risk Level</label>
                      <select
                        className="hw-input"
                        value={form.currentRiskLevel ?? ''}
                        onChange={(e) => setField('currentRiskLevel', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Reintegration Type</label>
                      <select
                        className="hw-input"
                        value={form.reintegrationType ?? ''}
                        onChange={(e) => setField('reintegrationType', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {REINTEGRATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Reintegration Status</label>
                      <select
                        className="hw-input"
                        value={form.reintegrationStatus ?? ''}
                        onChange={(e) => setField('reintegrationStatus', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {REINTEGRATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Date Enrolled</label>
                      <input
                        type="date"
                        className="hw-input"
                        value={form.dateEnrolled ?? ''}
                        onChange={(e) => setField('dateEnrolled', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Date Closed</label>
                      <input
                        type="date"
                        className="hw-input"
                        value={form.dateClosed ?? ''}
                        onChange={(e) => setField('dateClosed', e.target.value)}
                      />
                    </div>
                  </div>
                </fieldset>
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
                  {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Resident'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={
          deleteTarget
            ? `resident ${deleteTarget.caseControlNo || '#' + deleteTarget.residentId}`
            : ''
        }
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
