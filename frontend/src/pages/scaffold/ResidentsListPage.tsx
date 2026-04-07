import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteJson,
  fetchJson,
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

interface ResidentWithNav extends Resident {
  safehouse?: { safehouseId: number; name?: string | null; safehouseCode?: string | null };
}

interface IncidentSummary {
  incidentId: number;
  safehouseId: number;
  incidentDate: string | null;
  incidentType: string | null;
  severity: string | null;
  description: string | null;
  responseTaken: string | null;
  resolved: boolean | null;
  resolutionDate: string | null;
  reportedBy: string | null;
  followUpRequired: boolean | null;
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
  | 'currentRiskLevel';

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

// ── Shared inline styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', width: '100%',
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
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

  const [profileViewId, setProfileViewId] = useState<number | null>(null);
  const [profileDetail, setProfileDetail] = useState<{ resident: ResidentWithNav; incidents: IncidentSummary[] } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const sortedItems = useMemo(() => {
    if (!data?.items || !sortCol) return data?.items ?? [];
    return [...data.items].sort((a, b) => compareValues(
      a[sortCol] as string | number | null,
      b[sortCol] as string | number | null,
      sortDir,
    ));
  }, [data?.items, sortCol, sortDir]);

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

  function closeProfile() {
    setProfileViewId(null);
    setProfileDetail(null);
    setProfileError(null);
    setProfileLoading(false);
  }

  async function openProfile(residentId: number) {
    setProfileViewId(residentId);
    setProfileLoading(true);
    setProfileError(null);
    setProfileDetail(null);
    try {
      const d = await fetchJson<{ resident: ResidentWithNav; incidents: IncidentSummary[] }>(
        `/api/residents/${residentId}/detail`,
      );
      setProfileDetail(d);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Could not load resident profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  const isEditing = editTarget !== null && editTarget !== 'new';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Case management</span>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
              <i className="bi bi-person-lines-fill me-2" style={{ color: '#0D9488' }} aria-hidden />
              Residents
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0, maxWidth: 720 }}>
              Track each girl through intake, counseling, education, health, and reintegration. Use the table for quick triage; open a row for the full
              case file and incident history.
              {data ? ` ${data.totalCount} resident${data.totalCount !== 1 ? 's' : ''} match your filters.` : ''}
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
          <AdminKpiStrip
            items={[
              { label: 'Residents on this page', value: String(data.items.length), accent: '#1E3A5F', icon: 'people' },
              {
                label: 'Active on this page',
                value: String(data.items.filter((r) => r.caseStatus === 'Active').length),
                accent: '#0D9488',
                icon: 'person-check',
              },
              {
                label: 'High or critical risk (page)',
                value: String(
                  data.items.filter((r) => r.currentRiskLevel === 'High' || r.currentRiskLevel === 'Critical').length,
                ),
                accent: '#991B1B',
                icon: 'exclamation-triangle',
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
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
                      <th style={thStyle} onClick={() => handleSort('currentRiskLevel')}>Risk level{sortArrow('currentRiskLevel', sortCol, sortDir)}</th>
                      <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((r, i) => {
                      const sCfg = STATUS_COLORS[r.caseStatus ?? ''] ?? { bg: '#F1F5F9', text: '#64748B' };
                      const rCfg = RISK_COLORS[r.currentRiskLevel ?? ''];
                      return (
                        <tr
                          key={r.residentId}
                          style={{
                            background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                          }}
                          onClick={() => void openProfile(r.residentId)}
                          title="Open full resident profile"
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
                            {rCfg
                              ? <Badge label={r.currentRiskLevel!} bg={rCfg.bg} text={rCfg.text} />
                              : <span style={{ color: '#94A3B8' }}>—</span>}
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
                                    onClick={() => void openProfile(r.residentId)}
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
                      <label className="hw-label">Safehouse ID <span className="text-danger">*</span></label>
                      <input type="number" min="1" className="hw-input" value={form.safehouseId} onChange={(e) => setField('safehouseId', Number(e.target.value))} />
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
                      <input className="hw-input" value={form.assignedSocialWorker ?? ''} onChange={(e) => setField('assignedSocialWorker', e.target.value)} />
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

      {profileViewId !== null && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true" aria-labelledby="residentProfileTitle">
          <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-bottom">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-0" id="residentProfileTitle">
                    Resident profile
                  </h5>
                  <p className="small text-muted mb-0">Database ID {profileViewId} · read-only summary for staff review</p>
                </div>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeProfile} />
              </div>
              <div className="modal-body">
                {profileLoading && <p className="text-muted">Loading full record…</p>}
                {profileError && <div className="alert alert-danger">{profileError}</div>}
                {profileDetail && (
                  <>
                    {(() => {
                      const r = profileDetail.resident;
                      const site =
                        r.safehouse?.name?.trim() ||
                        r.safehouse?.safehouseCode?.trim() ||
                        `Safehouse #${r.safehouseId}`;
                      const pairs = (label: string, val: string) => (
                        <div key={label} className="col-md-6 col-lg-4 py-2 border-bottom">
                          <div className="text-uppercase small text-muted fw-semibold" style={{ fontSize: 10, letterSpacing: '0.04em' }}>
                            {label}
                          </div>
                          <div className="small text-break">{val}</div>
                        </div>
                      );
                      const yn = (b: boolean | null | undefined) => (b ? 'Yes' : 'No');
                      return (
                        <>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Identification &amp; placement</h6>
                          <div className="row mb-4">
                            {pairs('Resident ID (database)', String(r.residentId))}
                            {pairs('Case control number', r.caseControlNo || '—')}
                            {pairs('Internal code', r.internalCode || '—')}
                            {pairs('Safehouse', site)}
                            {pairs('Safehouse ID', String(r.safehouseId))}
                            {pairs('Assigned social worker', r.assignedSocialWorker || '—')}
                          </div>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Case classification</h6>
                          <div className="row mb-4">
                            {pairs('Case status', r.caseStatus || '—')}
                            {pairs('Case category', r.caseCategory || '—')}
                            {pairs('Initial risk level', r.initialRiskLevel || '—')}
                            {pairs('Current risk level', r.currentRiskLevel || '—')}
                            {pairs('Sub-categories', SUB_CATS.filter((s) => r[s.key]).map((s) => s.label).join(', ') || '—')}
                          </div>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Demographics</h6>
                          <div className="row mb-4">
                            {pairs('Sex', r.sex || '—')}
                            {pairs('Date of birth', fmtDate(r.dateOfBirth))}
                            {pairs('Birth status', r.birthStatus || '—')}
                            {pairs('Place of birth', r.placeOfBirth || '—')}
                            {pairs('Religion', r.religion || '—')}
                            {pairs('PWD', yn(r.isPwd))}
                            {pairs('PWD type', r.pwdType || '—')}
                            {pairs('Special needs', yn(r.hasSpecialNeeds))}
                            {pairs('Special needs diagnosis', r.specialNeedsDiagnosis || '—')}
                          </div>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Family profile</h6>
                          <div className="row mb-4">
                            {pairs('4Ps beneficiary', yn(r.familyIs4ps))}
                            {pairs('Solo parent household', yn(r.familySoloParent))}
                            {pairs('Indigenous group', yn(r.familyIndigenous))}
                            {pairs('Parent with disability', yn(r.familyParentPwd))}
                            {pairs('Informal settler', yn(r.familyInformalSettler))}
                          </div>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Admission &amp; referral</h6>
                          <div className="row mb-4">
                            {pairs('Date of admission', fmtDate(r.dateOfAdmission))}
                            {pairs('Age upon admission', r.ageUponAdmission || '—')}
                            {pairs('Present age', r.presentAge || '—')}
                            {pairs('Length of stay', r.lengthOfStay || '—')}
                            {pairs('Referral source', r.referralSource || '—')}
                            {pairs('Referring agency / person', r.referringAgencyPerson || '—')}
                            {pairs('Date enrolled', fmtDate(r.dateEnrolled))}
                            {pairs('Date closed', fmtDate(r.dateClosed))}
                            <div className="col-12 py-2 border-bottom">
                              <div className="text-uppercase small text-muted fw-semibold" style={{ fontSize: 10, letterSpacing: '0.04em' }}>
                                Initial case assessment
                              </div>
                              <div className="small text-break">{r.initialCaseAssessment?.trim() || '—'}</div>
                            </div>
                          </div>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Reintegration</h6>
                          <div className="row mb-4">
                            {pairs('Reintegration type', r.reintegrationType || '—')}
                            {pairs('Reintegration status', r.reintegrationStatus || '—')}
                          </div>
                          <h6 className="text-uppercase small fw-bold text-secondary mb-3">Restricted notes</h6>
                          <p className="small text-break border rounded p-3 bg-light">{r.notesRestricted?.trim() || '—'}</p>
                        </>
                      );
                    })()}
                    <h6 className="text-uppercase small fw-bold text-secondary mb-3 mt-4">Incident reports</h6>
                    {profileDetail.incidents.length === 0 ? (
                      <p className="small text-muted">No incident reports on file for this resident.</p>
                    ) : (
                      <div className="table-responsive border rounded">
                        <table className="table table-sm table-striped mb-0 small">
                          <thead className="table-light">
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Severity</th>
                              <th>Resolved</th>
                              <th>Resolution date</th>
                              <th>Follow-up</th>
                              <th>Reported by</th>
                              <th>Description</th>
                              <th>Response taken</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileDetail.incidents.map((inc) => (
                              <tr key={inc.incidentId}>
                                <td className="text-nowrap">{fmtDate(inc.incidentDate)}</td>
                                <td>{inc.incidentType || '—'}</td>
                                <td>{inc.severity || '—'}</td>
                                <td>{inc.resolved === true ? 'Yes' : inc.resolved === false ? 'No' : '—'}</td>
                                <td className="text-nowrap">{fmtDate(inc.resolutionDate)}</td>
                                <td>{inc.followUpRequired === true ? 'Yes' : inc.followUpRequired === false ? 'No' : '—'}</td>
                                <td>{inc.reportedBy || '—'}</td>
                                <td style={{ maxWidth: 220 }}>{inc.description?.trim() || '—'}</td>
                                <td style={{ maxWidth: 220 }}>{inc.responseTaken?.trim() || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer border-top">
                {profileDetail && canWrite ? (
                  <button type="button" className="btn btn-primary" onClick={() => { closeProfile(); openEdit(profileDetail.resident); }}>
                    Edit this resident
                  </button>
                ) : null}
                <button type="button" className="btn btn-outline-secondary" onClick={closeProfile}>
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
