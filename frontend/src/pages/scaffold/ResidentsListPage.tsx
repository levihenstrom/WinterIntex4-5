import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  deleteJson,
  fetchPaged,
  postJson,
  putJson,
  type PagedResult,
} from '../../lib/apiClient';
import {
  buildResidentMlMap,
  getResidentCurrentScores,
  normalizeResidentMlKey,
  type ResidentMlScoreRow,
} from '../../lib/mlApi';
import {
  formatRelativeReadinessPercentile,
  RESIDENT_RELATIVE_READINESS_HEADER,
  RESIDENT_RELATIVE_READINESS_TITLE,
} from '../../lib/mlDisplayHelpers';
import { isOkrSuccessfulReintegration, residentCaseloadRowStyle } from '../../lib/residentOutcome';
import { useAuth } from '../../context/AuthContext';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { SafehouseSearchCombobox, SocialWorkerCombobox } from '../../components/admin/lookupCombos';
import AdminKpiStrip from '../../components/admin/AdminKpiStrip';
import 'bootstrap-icons/font/bootstrap-icons.css';

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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:      { bg: '#DCFCE7', text: '#166534' },
  Closed:      { bg: '#F1F5F9', text: '#64748B' },
  Transferred: { bg: '#DBEAFE', text: '#1E40AF' },
  Referred:    { bg: '#E0E7FF', text: '#3730A3' },
  Discharged:  { bg: '#FEF9C3', text: '#854D0E' },
  Pending:     { bg: '#FFF7ED', text: '#9A3412' },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  Low:      { bg: '#DCFCE7', text: '#166534' },
  Medium:   { bg: '#FEF9C3', text: '#854D0E' },
  High:     { bg: '#FEE2E2', text: '#991B1B' },
  Critical: { bg: '#1E293B', text: '#F8FAFC' },
};

/** Table "Risk level" from ML readiness percentile: higher readiness → lower displayed risk. */
function getRiskFromReadiness(percentile: number | null | undefined): string {
  if (percentile == null) return 'N/A';
  if (percentile >= 75) return 'Low';
  if (percentile >= 40) return 'Medium';
  return 'High';
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color: text,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{label}</span>
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

type SortCol =
  | 'residentId'
  | 'caseControlNo'
  | 'internalCode'
  | 'dateOfBirth'
  | 'sex'
  | 'caseCategory'
  | 'caseStatus'
  | 'safehouseId'
  | 'assignedSocialWorker'
  | 'currentRiskLevel'
  | 'mlReadinessPct'
  | 'mlPriorityRank';

function sortArrow(col: SortCol, sortCol: SortCol | null, sortDir: 'asc' | 'desc'): string {
  if (col !== sortCol) return ' ↕';
  return sortDir === 'asc' ? ' ▲' : ' ▼';
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: 'asc' | 'desc'): number {
  const av = a ?? '';
  const bv = b ?? '';
  if (av < bv) return dir === 'asc' ? -1 : 1;
  if (av > bv) return dir === 'asc' ? 1 : -1;
  return 0;
}

// ── Blank form ────────────────────────────────────────────────────────────────

type FormData = Omit<Resident, 'residentId'>;

function emptyForm(): FormData {
  return {
    caseControlNo: '', internalCode: '', safehouseId: 0,
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

// ── Shared inline styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, width: '100%',
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, background: '#fff',
};
const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left' as const, fontWeight: 700, color: '#475569',
  fontSize: 12, whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const,
};
const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: 13,
};
const navBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? '#F1F5F9' : '#fff',
  border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 16px',
  fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  color: disabled ? '#94A3B8' : '#1E3A5F', transition: 'all 0.15s',
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResidentsListPage() {
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  // URL-driven initial state — supports /admin/residents/:id and ?caseStatus=Active
  useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('caseStatus') ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [appliedSearch, setAppliedSearch] = useState(() => searchParams.get('search') ?? '');
  const [appliedStatus, setAppliedStatus] = useState(() => searchParams.get('caseStatus') ?? '');
  const [reintegrationFilter, setReintegrationFilter] = useState(() => searchParams.get('reintegrationStatus') ?? '');
  const [appliedReintegration, setAppliedReintegration] = useState(() => searchParams.get('reintegrationStatus') ?? '');
  const [appliedCategory, setAppliedCategory] = useState('');

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<Resident> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [editTarget, setEditTarget] = useState<Resident | 'new' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const navigate = useNavigate();

  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [quickFilter, setQuickFilter] = useState<'active' | 'highRisk' | null>(null);
  function toggleQuickFilter(f: 'active' | 'highRisk') {
    setQuickFilter(prev => prev === f ? null : f);
  }

  /**
   * ML join: artifact `residentCode` matches caseload `internalCode` (e.g. LS-0006).
   * Compare with trim + uppercase via normalizeResidentMlKey().
   */
  const [mlByKey, setMlByKey] = useState<Map<string, ResidentMlScoreRow>>(() => new Map());
  const [mlLoading, setMlLoading] = useState(true);
  const [mlError, setMlError] = useState<string | null>(null);
  const [mlFactorsFor, setMlFactorsFor] = useState<Resident | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const extra: Record<string, string | number | undefined> = {};
    if (appliedStatus) extra.caseStatus = appliedStatus;
    if (appliedReintegration) extra.reintegrationStatus = appliedReintegration;
    if (appliedCategory) extra.caseCategory = appliedCategory;
    if (appliedSearch) extra.search = appliedSearch;
    fetchPaged<Resident>('/api/residents', page, 20, extra)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, appliedStatus, appliedReintegration, appliedCategory, appliedSearch, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    setMlLoading(true);
    getResidentCurrentScores()
      .then((rows) => {
        if (!cancelled) {
          setMlByKey(buildResidentMlMap(rows));
          setMlError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setMlError(e.message);
          setMlByKey(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) setMlLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyFilters() {
    setPage(1);
    setAppliedSearch(search);
    setAppliedStatus(statusFilter);
    setAppliedReintegration(reintegrationFilter);
    setAppliedCategory(categoryFilter);
  }

  function resetFilters() {
    setSearch(''); setStatusFilter(''); setCategoryFilter(''); setReintegrationFilter('');
    setPage(1);
    setAppliedSearch(''); setAppliedStatus(''); setAppliedCategory(''); setAppliedReintegration('');
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    if (!sortCol) return data.items;

    if (sortCol === 'mlReadinessPct') {
      const pct = (r: Resident) =>
        mlByKey.get(normalizeResidentMlKey(r.internalCode))?.readinessPercentileAmongCurrentResidents;
      return [...data.items].sort((a, b) => {
        const va = pct(a);
        const vb = pct(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    if (sortCol === 'mlPriorityRank') {
      const rank = (r: Resident) =>
        mlByKey.get(normalizeResidentMlKey(r.internalCode))?.supportPriorityRank;
      return [...data.items].sort((a, b) => {
        const va = rank(a);
        const vb = rank(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    if (sortCol === 'currentRiskLevel') {
      const pct = (r: Resident) =>
        mlByKey.get(normalizeResidentMlKey(r.internalCode))?.readinessPercentileAmongCurrentResidents;
      return [...data.items].sort((a, b) => {
        const va = pct(a);
        const vb = pct(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    return [...data.items].sort((a, b) =>
      compareValues(
        a[sortCol as keyof Resident] as string | number | null,
        b[sortCol as keyof Resident] as string | number | null,
        sortDir,
      ),
    );
  }, [data?.items, sortCol, sortDir, mlByKey]);

  const filteredItems = useMemo(() => {
    if (!quickFilter) return sortedItems;
    if (quickFilter === 'active') return sortedItems.filter(r => r.caseStatus === 'Active');
    if (quickFilter === 'highRisk') return sortedItems.filter(r => r.currentRiskLevel === 'High' || r.currentRiskLevel === 'Critical');
    return sortedItems;
  }, [sortedItems, quickFilter]);

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
    setFormError(null);
    if (!form.safehouseId) {
      setFormError('Select a safehouse.');
      return;
    }
    setSaving(true);
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

  function openProfile(residentId: number) {
    navigate(`/admin/residents/${residentId}`);
  }

  const isEditing = editTarget !== null && editTarget !== 'new';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">

        {/* Header */}
        <div className="mb-5" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Case management</span>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 8, lineHeight: 1.2 }}>
              <i className="bi bi-person-lines-fill me-2" style={{ color: '#0D9488' }} aria-hidden />
              Residents
            </h1>
            <p className="text-muted mb-0" style={{ fontSize: 14, maxWidth: 720 }}>
              Track each girl through intake, counseling, education, health, and reintegration. Use the table for quick triage; open a row for the full
              case file and incident history.
              {data ? ` ${data.totalCount} resident${data.totalCount !== 1 ? 's' : ''} match your filters.` : ''}
            </p>
            <p className="text-muted mb-0 mt-2 small" style={{ maxWidth: 720, color: '#94A3B8' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(255, 247, 230, 0.95)', boxShadow: 'inset 2px 0 0 0 rgba(217, 119, 6, 0.22)', verticalAlign: 'middle', marginRight: 6 }} aria-hidden />
              Soft gold row = successful reintegration (<strong className="text-muted">Reintegration status: Completed</strong>), the same outcome counted in your public impact OKR.
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              style={{
                background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <i className="bi bi-person-plus" aria-hidden />
              New resident
            </button>
          )}
        </div>

        {data && (
          <>
            <AdminKpiStrip
              items={[
                { label: 'Residents on this page', value: String(data.items.length), accent: '#1E3A5F', icon: 'people' },
                {
                  label: 'Active on this page',
                  value: String(data.items.filter((r) => r.caseStatus === 'Active').length),
                  accent: '#0D9488',
                  icon: 'person-check',
                  onClick: () => toggleQuickFilter('active'),
                  active: quickFilter === 'active',
                },
                {
                  label: 'High or critical risk (page)',
                  value: String(
                    data.items.filter((r) => r.currentRiskLevel === 'High' || r.currentRiskLevel === 'Critical').length,
                  ),
                  accent: '#991B1B',
                  icon: 'exclamation-triangle',
                  onClick: () => toggleQuickFilter('highRisk'),
                  active: quickFilter === 'highRisk',
                },
                {
                  label: 'Total in database (filtered)',
                  value: String(data.totalCount),
                  sub: `Page ${data.page} of ${data.totalPages || 1}`,
                  accent: '#6B21A8',
                  icon: 'database',
                },
              ]}
            />
            {quickFilter && (
              <div className="mb-3 d-flex align-items-center gap-2">
                <span className="badge rounded-pill" style={{ background: quickFilter === 'highRisk' ? '#991B1B' : '#0D9488', color: '#fff', fontSize: 12, padding: '5px 12px' }}>
                  Filtered: {quickFilter === 'active' ? 'Active residents' : 'High / Critical risk'}
                </span>
                <button onClick={() => setQuickFilter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B', padding: '2px 6px' }}>
                  Clear ✕
                </button>
              </div>
            )}
          </>
        )}

        {/* Filter bar */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.05)',
          marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="Search case control no., internal code, or social worker…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            style={{ ...inputStyle, flex: '1 1 200px' }}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ ...selectStyle, flex: '0 0 auto', width: 'auto' }}>
            <option value="">All Categories</option>
            {CASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={applyFilters} style={{
            background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Search</button>
          <button onClick={resetFilters} style={{
            background: 'none', border: '1px solid #CBD5E1', borderRadius: 8,
            padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#64748B',
          }}>Reset</button>
          <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 'auto' }}>
            {data ? `${data.totalCount} records` : ''}
          </span>
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          {['', ...CASE_STATUSES].map(s => {
            const isActive = statusFilter === s;
            const cfg = s ? STATUS_COLORS[s] : null;
            return (
              <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); setAppliedStatus(s); }} style={{
                border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: isActive ? (cfg?.bg ?? '#1E3A5F') : '#E2E8F0',
                color: isActive ? (cfg?.text ?? '#fff') : '#475569',
                transition: 'all 0.15s',
              }}>
                {s || 'All Statuses'}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reintegration</span>
          {(['', 'Completed'] as const).map((v) => {
            const isActive = reintegrationFilter === v;
            const isOkr = v === 'Completed';
            return (
              <button
                key={v || 'all-reint'}
                type="button"
                onClick={() => {
                  setReintegrationFilter(v);
                  setPage(1);
                  setAppliedReintegration(v);
                }}
                style={{
                  border: 'none',
                  borderRadius: 20,
                  padding: '5px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isActive
                    ? (isOkr ? 'rgba(254, 243, 199, 0.95)' : '#1E3A5F')
                    : '#E2E8F0',
                  color: isActive ? (isOkr ? '#92400e' : '#fff') : '#475569',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: isActive && isOkr ? 'rgba(245, 158, 11, 0.4)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {v === '' ? 'All' : 'Completed (OKR outcome)'}
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
        {mlError && (
          <div
            style={{
              borderRadius: 8,
              padding: '10px 16px',
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            Readiness insights unavailable: {mlError}. Related columns will show N/A.
          </div>
        )}

        {/* Table */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          boxShadow: '0 2px 12px rgba(30,58,95,0.06)', overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <p style={{ fontWeight: 600 }}>Loading residents…</p>
            </div>
          ) : data && data.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94A3B8' }}>
              <p style={{ fontWeight: 600 }}>No residents match your filters.</p>
            </div>
          ) : data ? (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      <th style={thStyle} onClick={() => handleSort('residentId')}>Resident ID{sortArrow('residentId', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('caseControlNo')}>Case control no.{sortArrow('caseControlNo', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('internalCode')}>Internal code{sortArrow('internalCode', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('dateOfBirth')}>Date of birth{sortArrow('dateOfBirth', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('sex')}>Sex{sortArrow('sex', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('caseCategory')}>Case category{sortArrow('caseCategory', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('caseStatus')}>Case status{sortArrow('caseStatus', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('safehouseId')}>Safehouse ID{sortArrow('safehouseId', sortCol, sortDir)}</th>
                      <th style={thStyle} onClick={() => handleSort('assignedSocialWorker')}>Social worker{sortArrow('assignedSocialWorker', sortCol, sortDir)}</th>
                      <th
                        style={thStyle}
                        onClick={() => handleSort('currentRiskLevel')}
                        title="Derived from relative readiness percentile (higher readiness → lower risk). Not the database risk field."
                      >
                        Risk level{sortArrow('currentRiskLevel', sortCol, sortDir)}
                      </th>
                      <th
                        style={thStyle}
                        onClick={() => handleSort('mlReadinessPct')}
                        title={RESIDENT_RELATIVE_READINESS_TITLE}
                      >
                        {RESIDENT_RELATIVE_READINESS_HEADER}
                        {sortArrow('mlReadinessPct', sortCol, sortDir)}
                      </th>
                      <th style={{ ...thStyle, cursor: 'default' }} title="Support priority tier from the readiness model">
                        Priority band
                      </th>
                      <th style={thStyle} onClick={() => handleSort('mlPriorityRank')}>
                        Priority rank{sortArrow('mlPriorityRank', sortCol, sortDir)}
                      </th>
                      <th style={{ ...thStyle, cursor: 'default' }}>Factors</th>
                      <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((r, i) => {
                      const sCfg = STATUS_COLORS[r.caseStatus ?? ''] ?? { bg: '#F1F5F9', text: '#64748B' };
                      const mlRow = mlByKey.get(normalizeResidentMlKey(r.internalCode));
                      const readinessPct = mlRow?.readinessPercentileAmongCurrentResidents;
                      const derivedRiskLabel = getRiskFromReadiness(readinessPct);
                      const rCfg =
                        derivedRiskLabel !== 'N/A' ? RISK_COLORS[derivedRiskLabel] : undefined;
                      const okrDone = isOkrSuccessfulReintegration(r.reintegrationStatus);
                      return (
                        <tr
                          key={r.residentId}
                          style={residentCaseloadRowStyle(okrDone, i % 2 === 0)}
                          onClick={() => openProfile(r.residentId)}
                          title={
                            okrDone
                              ? 'Successful reintegration (OKR outcome) — open full resident profile'
                              : 'Open full resident profile'
                          }
                        >
                          <td style={{ ...tdStyle, fontWeight: 700, color: '#1E3A5F' }}>{r.residentId}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: '#475569' }}>{r.caseControlNo || '—'}</td>
                          <td style={{ ...tdStyle, color: '#64748B' }}>{r.internalCode || '—'}</td>
                          <td style={{ ...tdStyle, color: '#64748B', whiteSpace: 'nowrap' }}>{fmtDate(r.dateOfBirth)}</td>
                          <td style={tdStyle}>{r.sex || '—'}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{r.caseCategory || '—'}</td>
                          <td style={tdStyle}>
                            <Badge label={r.caseStatus || '—'} bg={sCfg.bg} text={sCfg.text} />
                          </td>
                          <td style={tdStyle}>{r.safehouseId}</td>
                          <td style={{ ...tdStyle, color: '#475569' }}>{r.assignedSocialWorker || '—'}</td>
                          <td style={tdStyle}>
                            {mlLoading ? (
                              <span style={{ color: '#94A3B8' }}>…</span>
                            ) : rCfg ? (
                              <Badge label={derivedRiskLabel} bg={rCfg.bg} text={rCfg.text} />
                            ) : (
                              <span style={{ color: '#94A3B8' }}>{derivedRiskLabel}</span>
                            )}
                          </td>
                          <td
                            style={{ ...tdStyle, color: '#475569', whiteSpace: 'nowrap' }}
                            title={RESIDENT_RELATIVE_READINESS_TITLE}
                          >
                            {mlLoading ? (
                              <span style={{ color: '#94A3B8' }}>…</span>
                            ) : mlRow?.readinessPercentileAmongCurrentResidents != null ? (
                              <span>
                                <span className="tabular-nums">
                                  {formatRelativeReadinessPercentile(
                                    mlRow.readinessPercentileAmongCurrentResidents,
                                  )}
                                </span>
                                <span className="d-none d-xl-inline text-muted small ms-1">(peers)</span>
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td style={{ ...tdStyle, color: '#475569', maxWidth: 140 }} title={mlRow?.operationalBand}>
                            {mlLoading ? '…' : mlRow?.operationalBand ?? 'N/A'}
                          </td>
                          <td style={{ ...tdStyle, color: '#475569' }}>
                            {mlLoading ? '…' : mlRow != null ? mlRow.supportPriorityRank : 'N/A'}
                          </td>
                          <td style={tdStyle}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: '#F5F3FF',
                                border: '1px solid #D8B4FE',
                                color: '#5B21B6',
                                fontWeight: 600,
                                fontSize: 12,
                                opacity: mlRow ? 1 : 0.45,
                                cursor: mlRow ? 'pointer' : 'not-allowed',
                              }}
                              disabled={!mlRow}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (mlRow) setMlFactorsFor(r);
                              }}
                            >
                              View
                            </button>
                          </td>
                          <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                            <div className="dropdown">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary dropdown-toggle"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                                aria-label={`Actions for resident ${r.residentId}`}
                              >
                                Actions
                              </button>
                              <ul className="dropdown-menu dropdown-menu-end">
                                <li>
                                  <button
                                    type="button"
                                    className="dropdown-item"
                                    onClick={() => openProfile(r.residentId)}
                                  >
                                    <i className="bi bi-person-vcard me-2 text-secondary" aria-hidden />
                                    Full profile
                                  </button>
                                </li>
                                {canWrite ? (
                                  <li>
                                    <button type="button" className="dropdown-item" onClick={() => openEdit(r)}>
                                      <i className="bi bi-pencil me-2 text-secondary" aria-hidden />
                                      Edit
                                    </button>
                                  </li>
                                ) : null}
                                <li>
                                  <Link className="dropdown-item" to={`/admin/residents/${r.residentId}/process`}>
                                    <i className="bi bi-journal-text me-2 text-secondary" aria-hidden />
                                    Session notes
                                  </Link>
                                </li>
                                <li>
                                  <Link className="dropdown-item" to={`/admin/residents/${r.residentId}/visits`}>
                                    <i className="bi bi-house-door me-2 text-secondary" aria-hidden />
                                    Field visits
                                  </Link>
                                </li>
                                {canWrite ? (
                                  <>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li>
                                      <button
                                        type="button"
                                        className="dropdown-item text-danger"
                                        onClick={() => setDeleteTarget(r)}
                                      >
                                        <i className="bi bi-trash me-2" aria-hidden />
                                        Delete
                                      </button>
                                    </li>
                                  </>
                                ) : null}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{
                padding: '14px 20px', borderTop: '1px solid #E2E8F0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Page {data.page} of {data.totalPages || 1} · {data.totalCount} total
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    style={navBtn(page <= 1 || loading)}
                  >← Prev</button>
                  <button
                    type="button"
                    disabled={loading || page >= (data.totalPages || 1)}
                    onClick={() => setPage(p => p + 1)}
                    style={navBtn(loading || page >= (data.totalPages || 1))}
                  >Next →</button>
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

                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Case Identification</legend>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="hw-label">Case Control No</label>
                      <input className="hw-input" value={form.caseControlNo ?? ''} onChange={(e) => setField('caseControlNo', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Internal Code</label>
                      <input className="hw-input" value={form.internalCode ?? ''} onChange={(e) => setField('internalCode', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Safehouse <span className="text-danger">*</span></label>
                      <SafehouseSearchCombobox
                        value={form.safehouseId}
                        onChange={(id) => setField('safehouseId', id)}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Case Classification</legend>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="hw-label">Case Status <span className="text-danger">*</span></label>
                      <select className="hw-input" value={form.caseStatus ?? ''} onChange={(e) => setField('caseStatus', e.target.value)}>
                        {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Case Category <span className="text-danger">*</span></label>
                      <select className="hw-input" value={form.caseCategory ?? ''} onChange={(e) => setField('caseCategory', e.target.value)}>
                        <option value="">Select…</option>
                        {CASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Assigned Social Worker</label>
                      <SocialWorkerCombobox
                        value={form.assignedSocialWorker ?? ''}
                        onChange={(v) => setField('assignedSocialWorker', v)}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="hw-label mb-2">Sub-Categories</label>
                    <div className="d-flex flex-wrap gap-3">
                      {SUB_CATS.map(({ key, label }) => (
                        <div key={String(key)} className="form-check">
                          <input type="checkbox" className="form-check-input hw-check" id={`sc-${String(key)}`} checked={!!(form[key as keyof FormData])} onChange={(e) => setField(key as keyof FormData, e.target.checked as never)} />
                          <label className="form-check-label small" htmlFor={`sc-${String(key)}`}>{label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Personal Information</legend>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="hw-label">Sex</label>
                      <select className="hw-input" value={form.sex ?? ''} onChange={(e) => setField('sex', e.target.value)}>
                        <option value="">Select…</option>
                        {SEXES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Date of Birth</label>
                      <input type="date" className="hw-input" value={form.dateOfBirth ?? ''} onChange={(e) => setField('dateOfBirth', e.target.value)} />
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Birth Status</label>
                      <input className="hw-input" value={form.birthStatus ?? ''} onChange={(e) => setField('birthStatus', e.target.value)} />
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Religion</label>
                      <input className="hw-input" value={form.religion ?? ''} onChange={(e) => setField('religion', e.target.value)} />
                    </div>
                    <div className="col-md-6">
                      <label className="hw-label">Place of Birth</label>
                      <input className="hw-input" value={form.placeOfBirth ?? ''} onChange={(e) => setField('placeOfBirth', e.target.value)} />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Disability &amp; Special Needs</legend>
                  <div className="row g-3 align-items-start">
                    <div className="col-md-3 pt-4">
                      <div className="form-check">
                        <input type="checkbox" className="form-check-input hw-check" id="isPwd" checked={!!form.isPwd} onChange={(e) => setField('isPwd', e.target.checked)} />
                        <label className="form-check-label hw-label mb-0" htmlFor="isPwd">PWD</label>
                      </div>
                    </div>
                    <div className="col-md-9">
                      <label className="hw-label">PWD Type</label>
                      <input className="hw-input" value={form.pwdType ?? ''} onChange={(e) => setField('pwdType', e.target.value)} disabled={!form.isPwd} />
                    </div>
                    <div className="col-md-3 pt-2">
                      <div className="form-check">
                        <input type="checkbox" className="form-check-input hw-check" id="hasSpecialNeeds" checked={!!form.hasSpecialNeeds} onChange={(e) => setField('hasSpecialNeeds', e.target.checked)} />
                        <label className="form-check-label hw-label mb-0" htmlFor="hasSpecialNeeds">Special Needs</label>
                      </div>
                    </div>
                    <div className="col-md-9">
                      <label className="hw-label">Diagnosis</label>
                      <input className="hw-input" value={form.specialNeedsDiagnosis ?? ''} onChange={(e) => setField('specialNeedsDiagnosis', e.target.value)} disabled={!form.hasSpecialNeeds} />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Family Socio-Demographic Profile</legend>
                  <div className="d-flex flex-wrap gap-4">
                    {([
                      { key: 'familyIs4ps' as const, label: '4Ps Beneficiary' },
                      { key: 'familySoloParent' as const, label: 'Solo Parent' },
                      { key: 'familyIndigenous' as const, label: 'Indigenous Group' },
                      { key: 'familyParentPwd' as const, label: 'Parent with Disability' },
                      { key: 'familyInformalSettler' as const, label: 'Informal Settler' },
                    ] as const).map(({ key, label }) => (
                      <div key={key} className="form-check">
                        <input type="checkbox" className="form-check-input hw-check" id={`fam-${key}`} checked={!!form[key]} onChange={(e) => setField(key, e.target.checked)} />
                        <label className="form-check-label small" htmlFor={`fam-${key}`}>{label}</label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mb-4">
                  <legend className="hw-eyebrow mb-3">Admission &amp; Referral</legend>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="hw-label">Date of Admission</label>
                      <input type="date" className="hw-input" value={form.dateOfAdmission ?? ''} onChange={(e) => setField('dateOfAdmission', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Age Upon Admission</label>
                      <input className="hw-input" value={form.ageUponAdmission ?? ''} onChange={(e) => setField('ageUponAdmission', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Present Age</label>
                      <input className="hw-input" value={form.presentAge ?? ''} onChange={(e) => setField('presentAge', e.target.value)} />
                    </div>
                    <div className="col-md-6">
                      <label className="hw-label">Referral Source</label>
                      <input className="hw-input" value={form.referralSource ?? ''} onChange={(e) => setField('referralSource', e.target.value)} />
                    </div>
                    <div className="col-md-6">
                      <label className="hw-label">Referring Agency / Person</label>
                      <input className="hw-input" value={form.referringAgencyPerson ?? ''} onChange={(e) => setField('referringAgencyPerson', e.target.value)} />
                    </div>
                    <div className="col-12">
                      <label className="hw-label">Initial Case Assessment</label>
                      <textarea className="hw-input" rows={2} value={form.initialCaseAssessment ?? ''} onChange={(e) => setField('initialCaseAssessment', e.target.value)} />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="mb-2">
                  <legend className="hw-eyebrow mb-3">Risk &amp; Reintegration</legend>
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="hw-label">Initial Risk Level</label>
                      <select className="hw-input" value={form.initialRiskLevel ?? ''} onChange={(e) => setField('initialRiskLevel', e.target.value)}>
                        <option value="">Select…</option>
                        {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Current Risk Level</label>
                      <select className="hw-input" value={form.currentRiskLevel ?? ''} onChange={(e) => setField('currentRiskLevel', e.target.value)}>
                        <option value="">Select…</option>
                        {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Reintegration Type</label>
                      <select className="hw-input" value={form.reintegrationType ?? ''} onChange={(e) => setField('reintegrationType', e.target.value)}>
                        <option value="">Select…</option>
                        {REINTEGRATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="hw-label">Reintegration Status</label>
                      <select className="hw-input" value={form.reintegrationStatus ?? ''} onChange={(e) => setField('reintegrationStatus', e.target.value)}>
                        <option value="">Select…</option>
                        {REINTEGRATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Date Enrolled</label>
                      <input type="date" className="hw-input" value={form.dateEnrolled ?? ''} onChange={(e) => setField('dateEnrolled', e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="hw-label">Date Closed</label>
                      <input type="date" className="hw-input" value={form.dateClosed ?? ''} onChange={(e) => setField('dateClosed', e.target.value)} />
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--hw-bg-lavender2)' }}>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="button" className="btn hw-btn-magenta px-4" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Resident'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Readiness factors (read-only overlay; does not affect CRUD) */}
      {mlFactorsFor && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mlFactorsTitle"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#F5F3FF', borderBottom: '1px solid #E9D5FF' }}>
                <h5 className="modal-title fw-bold" id="mlFactorsTitle" style={{ color: '#1E3A5F' }}>
                  Readiness insights —{' '}
                  {mlFactorsFor.internalCode || mlFactorsFor.caseControlNo || `#${mlFactorsFor.residentId}`}
                </h5>
                <button type="button" className="btn-close" onClick={() => setMlFactorsFor(null)} aria-label="Close" />
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {(() => {
                  const row = mlByKey.get(normalizeResidentMlKey(mlFactorsFor.internalCode));
                  if (!row) {
                    return (
                      <p className="text-muted mb-0">No readiness insight row for this resident&apos;s internal code.</p>
                    );
                  }
                  return (
                    <>
                      <p className="small text-muted mb-3">
                        <strong>Relative readiness among current residents:</strong>{' '}
                        {row.readinessPercentileAmongCurrentResidents != null
                          ? formatRelativeReadinessPercentile(row.readinessPercentileAmongCurrentResidents)
                          : '—'}
                        {' · '}
                        <strong>Priority rank:</strong> {row.supportPriorityRank}
                        {' · '}
                        <strong>Priority band:</strong> {row.operationalBand}
                      </p>
                      {row.rawScoreNote && (
                        <p className="small text-muted border rounded p-2 bg-light mb-3">{row.rawScoreNote}</p>
                      )}
                      <p className="fw-semibold small text-success mb-2">Top positive factors</p>
                      <ul className="small mb-4">
                        {(row.topPositiveFactors ?? []).slice(0, 8).map((t, i) => (
                          <li key={`pos-${i}`}>{t}</li>
                        ))}
                        {(!row.topPositiveFactors || row.topPositiveFactors.length === 0) && (
                          <li className="text-muted">None listed</li>
                        )}
                      </ul>
                      <p className="fw-semibold small text-danger mb-2">Top risk factors</p>
                      <ul className="small mb-0">
                        {(row.topRiskFactors ?? []).slice(0, 8).map((t, i) => (
                          <li key={`risk-${i}`}>{t}</li>
                        ))}
                        {(!row.topRiskFactors || row.topRiskFactors.length === 0) && (
                          <li className="text-muted">None listed</li>
                        )}
                      </ul>
                    </>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setMlFactorsFor(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? `resident ${deleteTarget.caseControlNo || '#' + deleteTarget.residentId}` : ''}
        onCancel={() => { if (!deleteBusy) setDeleteTarget(null); }}
        onConfirm={() => { if (!deleteBusy) void confirmDelete(); }}
      />
    </div>
  );
}
