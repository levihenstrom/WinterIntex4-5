import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchJson, fetchPaged, postJson, putJson, deleteJson } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
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

interface EducationRecord {
  educationRecordId: number;
  residentId: number;
  recordDate: string | null;
  educationLevel: string | null;
  schoolName: string | null;
  enrollmentStatus: string | null;
  attendanceRate: number | null;
  progressPercent: number | null;
  completionStatus: string | null;
  notes: string | null;
}

interface HealthRecord {
  healthRecordId: number;
  residentId: number;
  recordDate: string | null;
  generalHealthScore: number | null;
  nutritionScore: number | null;
  sleepQualityScore: number | null;
  energyLevelScore: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  medicalCheckupDone: boolean | null;
  dentalCheckupDone: boolean | null;
  psychologicalCheckupDone: boolean | null;
  notes: string | null;
}

interface InterventionPlan {
  planId: number;
  residentId: number;
  planCategory: string | null;
  planDescription: string | null;
  servicesProvided: string | null;
  targetValue: number | null;
  targetDate: string | null;
  status: string | null;
  caseConferenceDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ProcessRecording {
  recordingId: number;
  sessionDate: string | null;
  sessionType: string | null;
  conductedBy: string | null;
  durationMinutes: number | null;
  progressNoted: boolean | null;
  concernsFlagged: boolean | null;
  emotionalStateObserved: string | null;
  sessionNarrative: string | null;
}

interface HomeVisitation {
  visitationId: number;
  residentId: number;
  visitDate: string | null;
  conductedBy: string | null;
  purpose: string | null;
  outcome: string | null;
  followUpRequired: boolean | null;
  notes: string | null;
}

interface ResidentDetail {
  resident: Resident;
  incidents: IncidentSummary[];
  educationRecords: EducationRecord[];
  healthRecords: HealthRecord[];
  interventionPlans: InterventionPlan[];
}

interface MlReadiness {
  residentCode: string;
  residentId: number | null;
  readinessScore: number | null;
  readinessPercentileAmongCurrentResidents: number | null;
  supportPriorityRank: number | null;
  operationalBand: string | null;
  topRiskFactors: string[] | null;
}

// ── Form types ────────────────────────────────────────────────────────────────

interface EduForm {
  residentId: number;
  recordDate: string;
  educationLevel: string;
  schoolName: string;
  enrollmentStatus: string;
  attendanceRate: string;
  progressPercent: string;
  completionStatus: string;
  notes: string;
}

interface HealthForm {
  residentId: number;
  recordDate: string;
  generalHealthScore: string;
  nutritionScore: string;
  sleepQualityScore: string;
  energyLevelScore: string;
  heightCm: string;
  weightKg: string;
  bmi: string;
  medicalCheckupDone: boolean;
  dentalCheckupDone: boolean;
  psychologicalCheckupDone: boolean;
  notes: string;
}

interface PlanForm {
  residentId: number;
  planCategory: string;
  planDescription: string;
  servicesProvided: string;
  targetValue: string;
  targetDate: string;
  status: string;
  caseConferenceDate: string;
}

interface VisitForm {
  residentId: number;
  visitDate: string;
  conductedBy: string;
  purpose: string;
  outcome: string;
  followUpRequired: boolean;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function yn(b: boolean | null | undefined): string {
  if (b == null) return '—';
  return b ? 'Yes' : 'No';
}

function scoreBar(val: number | null | undefined, max = 10) {
  if (val == null) return null;
  const pct = Math.min(100, Math.round((Number(val) / max) * 100));
  const color = pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 6 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28 }}>{Number(val).toFixed(1)}</span>
    </div>
  );
}

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:   { bg: '#DCFCE7', text: '#166534' },
  Closed:   { bg: '#F1F5F9', text: '#475569' },
  Pending:  { bg: '#FEF3C7', text: '#92400E' },
  Inactive: { bg: '#F1F5F9', text: '#64748B' },
};

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  Low:      { bg: '#DCFCE7', text: '#166534' },
  Medium:   { bg: '#FEF3C7', text: '#92400E' },
  High:     { bg: '#FEE2E2', text: '#991B1B' },
  Critical: { bg: '#7f1d1d', text: '#ffffff' },
};

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

// ── Section/Field helpers ──────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1E3A5F', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  );
}

function Card({ children, style, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
  return (
    <div id={id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)', padding: '20px 24px', ...style }}>
      {children}
    </div>
  );
}

function SectionCrudHeader({
  icon, title, count, accentBg = '#E0F2FE', accentText = '#0369A1',
  canWrite, onAdd,
}: {
  icon: string; title: string; count: number;
  accentBg?: string; accentText?: string;
  canWrite: boolean; onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #E2E8F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className={`bi bi-${icon}`} style={{ color: '#0D9488', fontSize: 16 }} />
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E3A5F', margin: 0 }}>{title}</h2>
        <span style={{ background: accentBg, color: accentText, borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 700 }}>{count}</span>
      </div>
      {canWrite && (
        <button
          onClick={onAdd}
          style={{ fontSize: 12, color: '#0D9488', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6 }}
        >
          <i className="bi bi-plus-circle" /> Add
        </button>
      )}
    </div>
  );
}

function StaticSectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #E2E8F0' }}>
      <i className={`bi bi-${icon}`} style={{ color: '#0D9488', fontSize: 16 }} />
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E3A5F', margin: 0 }}>{title}</h2>
    </div>
  );
}

// ── SVG Charts ────────────────────────────────────────────────────────────────

function HealthChart({ records }: { records: HealthRecord[] }) {
  const sorted = [...records]
    .filter(r => r.generalHealthScore != null && r.recordDate)
    .sort((a, b) => (a.recordDate ?? '').localeCompare(b.recordDate ?? ''));
  if (sorted.length < 2) return null;

  const W = 400; const H = 80; const PAD_X = 20; const PAD_Y = 12;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;
  const n = sorted.length;

  const pts = sorted.map((rec, i) => {
    const x = PAD_X + (i / (n - 1)) * plotW;
    const y = PAD_Y + (1 - Number(rec.generalHealthScore!) / 10) * plotH;
    return { x, y, val: rec.generalHealthScore!, date: rec.recordDate };
  });

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Health score over time</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 72, display: 'block' }} preserveAspectRatio="none">
        {/* grid lines */}
        {[0, 5, 10].map(v => {
          const y = PAD_Y + (1 - v / 10) * plotH;
          return <line key={v} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#E2E8F0" strokeWidth={1} />;
        })}
        <polyline points={polyline} fill="none" stroke="#059669" strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#059669" />
        ))}
        {/* Latest value label */}
        <text x={pts[n - 1].x + 4} y={pts[n - 1].y + 4} fontSize={10} fill="#059669" fontWeight="700">
          {Number(pts[n - 1].val).toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

function EduChart({ records }: { records: EducationRecord[] }) {
  const sorted = [...records]
    .filter(r => r.recordDate)
    .sort((a, b) => (a.recordDate ?? '').localeCompare(b.recordDate ?? ''));
  if (sorted.length < 2) return null;

  const W = 400; const H = 72; const PAD_X = 10; const PAD_Y = 8;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;
  const n = sorted.length;
  const barGroupW = plotW / n;
  const barW = Math.max(4, barGroupW * 0.35);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Attendance &amp; progress over time
        <span style={{ marginLeft: 12, fontWeight: 400, color: '#64748B' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#2563EB', borderRadius: 2, marginRight: 4 }} />Attendance
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#0D9488', borderRadius: 2, marginLeft: 8, marginRight: 4 }} />Progress
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 64, display: 'block' }} preserveAspectRatio="none">
        {sorted.map((rec, i) => {
          const cx = PAD_X + (i + 0.5) * barGroupW;
          const att = rec.attendanceRate != null ? Math.min(1, Number(rec.attendanceRate)) : 0;
          const prg = rec.progressPercent != null ? Math.min(1, Number(rec.progressPercent)) : 0;
          const attH = att * plotH;
          const prgH = prg * plotH;
          return (
            <g key={i}>
              <rect x={cx - barW - 1} y={PAD_Y + plotH - attH} width={barW} height={attH} fill="#2563EB" opacity={0.8} rx={2} />
              <rect x={cx + 1} y={PAD_Y + plotH - prgH} width={barW} height={prgH} fill="#0D9488" opacity={0.8} rx={2} />
            </g>
          );
        })}
        <line x1={PAD_X} y1={PAD_Y + plotH} x2={W - PAD_X} y2={PAD_Y + plotH} stroke="#E2E8F0" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Row action buttons ─────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
      <button
        onClick={onEdit}
        style={{ fontSize: 11, color: '#0369A1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}
      >Edit</button>
      <button
        onClick={onDelete}
        style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}
      >Delete</button>
    </td>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, onSave, saving, error, children }: {
  title: string; onClose: () => void; onSave: () => void;
  saving: boolean; error: string | null; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid #E2E8F0', paddingBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>✕</button>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} style={{ background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{ background: '#0D9488', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #CBD5E1', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1E3A5F', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { ...inputStyle };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 72 };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResidentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  // ── Data state ───────────────────────────────────────────────────────────────
  const [detail, setDetail] = useState<ResidentDetail | null>(null);
  const [recordings, setRecordings] = useState<ProcessRecording[]>([]);
  const [visits, setVisits] = useState<HomeVisitation[]>([]);
  const [ml, setMl] = useState<MlReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Education CRUD ───────────────────────────────────────────────────────────
  const [eduEdit, setEduEdit] = useState<EducationRecord | 'new' | null>(null);
  const [eduForm, setEduForm] = useState<EduForm>({} as EduForm);
  const [eduSaving, setEduSaving] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);
  const [eduDeleteTarget, setEduDeleteTarget] = useState<EducationRecord | null>(null);

  // ── Health CRUD ──────────────────────────────────────────────────────────────
  const [healthEdit, setHealthEdit] = useState<HealthRecord | 'new' | null>(null);
  const [healthForm, setHealthForm] = useState<HealthForm>({} as HealthForm);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthDeleteTarget, setHealthDeleteTarget] = useState<HealthRecord | null>(null);

  // ── Plan CRUD ────────────────────────────────────────────────────────────────
  const [planEdit, setPlanEdit] = useState<InterventionPlan | 'new' | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>({} as PlanForm);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planDeleteTarget, setPlanDeleteTarget] = useState<InterventionPlan | null>(null);

  // ── Visit CRUD ───────────────────────────────────────────────────────────────
  const [visitEdit, setVisitEdit] = useState<HomeVisitation | 'new' | null>(null);
  const [visitForm, setVisitForm] = useState<VisitForm>({} as VisitForm);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [visitDeleteTarget, setVisitDeleteTarget] = useState<HomeVisitation | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetchJson<ResidentDetail>(`/api/residents/${id}/detail`),
      fetchPaged<ProcessRecording>('/api/process-recordings', 1, 100, { residentId: id }),
      fetchPaged<HomeVisitation>('/api/home-visitations', 1, 100, { residentId: id }),
    ]).then(([detailRes, recRes, visRes]) => {
      if (cancelled) return;

      if (detailRes.status === 'rejected') {
        setError('Could not load resident record.');
        setLoading(false);
        return;
      }

      const d = detailRes.value;
      setDetail(d);
      setRecordings(recRes.status === 'fulfilled' ? recRes.value.items : []);
      setVisits(visRes.status === 'fulfilled' ? visRes.value.items : []);

      if (d.resident.internalCode) {
        fetchJson<MlReadiness>(`/api/ml/residents/${encodeURIComponent(d.resident.internalCode)}/readiness`)
          .then(r => { if (!cancelled) setMl(r); })
          .catch(() => {});
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  const refreshDetail = useCallback(async () => {
    if (!id) return;
    try {
      const d = await fetchJson<ResidentDetail>(`/api/residents/${id}/detail`);
      setDetail(d);
    } catch { /* silent */ }
  }, [id]);

  const refreshVisits = useCallback(async () => {
    if (!id) return;
    try {
      const result = await fetchPaged<HomeVisitation>('/api/home-visitations', 1, 100, { residentId: id });
      setVisits(result.items);
    } catch { /* silent */ }
  }, [id]);

  // ── Edu handlers ─────────────────────────────────────────────────────────────
  const openEduCreate = () => {
    if (!detail) return;
    setEduError(null);
    setEduForm({ residentId: detail.resident.residentId, recordDate: new Date().toISOString().slice(0, 10), educationLevel: '', schoolName: '', enrollmentStatus: 'Enrolled', attendanceRate: '', progressPercent: '', completionStatus: '', notes: '' });
    setEduEdit('new');
  };
  const openEduEdit = (e: EducationRecord) => {
    setEduError(null);
    setEduForm({ residentId: e.residentId, recordDate: e.recordDate?.slice(0, 10) ?? '', educationLevel: e.educationLevel ?? '', schoolName: e.schoolName ?? '', enrollmentStatus: e.enrollmentStatus ?? 'Enrolled', attendanceRate: e.attendanceRate != null ? String(e.attendanceRate) : '', progressPercent: e.progressPercent != null ? String(e.progressPercent) : '', completionStatus: e.completionStatus ?? '', notes: e.notes ?? '' });
    setEduEdit(e);
  };
  const handleEduSave = async () => {
    setEduSaving(true); setEduError(null);
    try {
      const payload = { ...eduForm, attendanceRate: eduForm.attendanceRate !== '' ? parseNum(eduForm.attendanceRate) : null, progressPercent: eduForm.progressPercent !== '' ? parseNum(eduForm.progressPercent) : null };
      if (eduEdit === 'new') {
        await postJson('/api/education-records', payload);
      } else if (eduEdit != null) {
        await putJson(`/api/education-records/${eduEdit.educationRecordId}`, { ...payload, educationRecordId: eduEdit.educationRecordId });
      }
      setEduEdit(null);
      await refreshDetail();
    } catch (e) { setEduError(String(e)); }
    finally { setEduSaving(false); }
  };
  const handleEduDelete = async () => {
    if (!eduDeleteTarget) return;
    try { await deleteJson(`/api/education-records/${eduDeleteTarget.educationRecordId}`); setEduDeleteTarget(null); await refreshDetail(); }
    catch (e) { alert(String(e)); }
  };

  // ── Health handlers ──────────────────────────────────────────────────────────
  const openHealthCreate = () => {
    if (!detail) return;
    setHealthError(null);
    setHealthForm({ residentId: detail.resident.residentId, recordDate: new Date().toISOString().slice(0, 10), generalHealthScore: '', nutritionScore: '', sleepQualityScore: '', energyLevelScore: '', heightCm: '', weightKg: '', bmi: '', medicalCheckupDone: false, dentalCheckupDone: false, psychologicalCheckupDone: false, notes: '' });
    setHealthEdit('new');
  };
  const openHealthEdit = (h: HealthRecord) => {
    setHealthError(null);
    setHealthForm({ residentId: h.residentId, recordDate: h.recordDate?.slice(0, 10) ?? '', generalHealthScore: h.generalHealthScore != null ? String(h.generalHealthScore) : '', nutritionScore: h.nutritionScore != null ? String(h.nutritionScore) : '', sleepQualityScore: h.sleepQualityScore != null ? String(h.sleepQualityScore) : '', energyLevelScore: h.energyLevelScore != null ? String(h.energyLevelScore) : '', heightCm: h.heightCm != null ? String(h.heightCm) : '', weightKg: h.weightKg != null ? String(h.weightKg) : '', bmi: h.bmi != null ? String(h.bmi) : '', medicalCheckupDone: h.medicalCheckupDone ?? false, dentalCheckupDone: h.dentalCheckupDone ?? false, psychologicalCheckupDone: h.psychologicalCheckupDone ?? false, notes: h.notes ?? '' });
    setHealthEdit(h);
  };
  const handleHealthSave = async () => {
    setHealthSaving(true); setHealthError(null);
    try {
      const payload = { ...healthForm, generalHealthScore: parseNum(healthForm.generalHealthScore), nutritionScore: parseNum(healthForm.nutritionScore), sleepQualityScore: parseNum(healthForm.sleepQualityScore), energyLevelScore: parseNum(healthForm.energyLevelScore), heightCm: parseNum(healthForm.heightCm), weightKg: parseNum(healthForm.weightKg), bmi: parseNum(healthForm.bmi) };
      if (healthEdit === 'new') {
        await postJson('/api/health-records', payload);
      } else if (healthEdit != null) {
        await putJson(`/api/health-records/${healthEdit.healthRecordId}`, { ...payload, healthRecordId: healthEdit.healthRecordId });
      }
      setHealthEdit(null);
      await refreshDetail();
    } catch (e) { setHealthError(String(e)); }
    finally { setHealthSaving(false); }
  };
  const handleHealthDelete = async () => {
    if (!healthDeleteTarget) return;
    try { await deleteJson(`/api/health-records/${healthDeleteTarget.healthRecordId}`); setHealthDeleteTarget(null); await refreshDetail(); }
    catch (e) { alert(String(e)); }
  };

  // ── Plan handlers ─────────────────────────────────────────────────────────────
  const openPlanCreate = () => {
    if (!detail) return;
    setPlanError(null);
    setPlanForm({ residentId: detail.resident.residentId, planCategory: '', planDescription: '', servicesProvided: '', targetValue: '', targetDate: '', status: 'Active', caseConferenceDate: '' });
    setPlanEdit('new');
  };
  const openPlanEdit = (p: InterventionPlan) => {
    setPlanError(null);
    setPlanForm({ residentId: p.residentId, planCategory: p.planCategory ?? '', planDescription: p.planDescription ?? '', servicesProvided: p.servicesProvided ?? '', targetValue: p.targetValue != null ? String(p.targetValue) : '', targetDate: p.targetDate?.slice(0, 10) ?? '', status: p.status ?? 'Active', caseConferenceDate: p.caseConferenceDate?.slice(0, 10) ?? '' });
    setPlanEdit(p);
  };
  const handlePlanSave = async () => {
    setPlanSaving(true); setPlanError(null);
    try {
      const payload = { ...planForm, targetValue: parseNum(planForm.targetValue) };
      if (planEdit === 'new') {
        await postJson('/api/intervention-plans', payload);
      } else if (planEdit != null) {
        await putJson(`/api/intervention-plans/${planEdit.planId}`, { ...payload, planId: planEdit.planId, createdAt: planEdit.createdAt });
      }
      setPlanEdit(null);
      await refreshDetail();
    } catch (e) { setPlanError(String(e)); }
    finally { setPlanSaving(false); }
  };
  const handlePlanDelete = async () => {
    if (!planDeleteTarget) return;
    try { await deleteJson(`/api/intervention-plans/${planDeleteTarget.planId}`); setPlanDeleteTarget(null); await refreshDetail(); }
    catch (e) { alert(String(e)); }
  };

  // ── Visit handlers ────────────────────────────────────────────────────────────
  const openVisitCreate = () => {
    if (!detail) return;
    setVisitError(null);
    setVisitForm({ residentId: detail.resident.residentId, visitDate: new Date().toISOString().slice(0, 10), conductedBy: '', purpose: '', outcome: '', followUpRequired: false, notes: '' });
    setVisitEdit('new');
  };
  const openVisitEdit = (v: HomeVisitation) => {
    setVisitError(null);
    setVisitForm({ residentId: v.residentId, visitDate: v.visitDate?.slice(0, 10) ?? '', conductedBy: v.conductedBy ?? '', purpose: v.purpose ?? '', outcome: v.outcome ?? '', followUpRequired: v.followUpRequired ?? false, notes: v.notes ?? '' });
    setVisitEdit(v);
  };
  const handleVisitSave = async () => {
    setVisitSaving(true); setVisitError(null);
    try {
      if (visitEdit === 'new') {
        await postJson('/api/home-visitations', visitForm);
      } else if (visitEdit != null) {
        await putJson(`/api/home-visitations/${visitEdit.visitationId}`, { ...visitForm, visitationId: visitEdit.visitationId });
      }
      setVisitEdit(null);
      await refreshVisits();
    } catch (e) { setVisitError(String(e)); }
    finally { setVisitSaving(false); }
  };
  const handleVisitDelete = async () => {
    if (!visitDeleteTarget) return;
    try { await deleteJson(`/api/home-visitations/${visitDeleteTarget.visitationId}`); setVisitDeleteTarget(null); await refreshVisits(); }
    catch (e) { alert(String(e)); }
  };

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: 'var(--hw-bg-gray)', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <p style={{ color: '#94A3B8', fontWeight: 600 }}>Loading resident profile…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ background: 'var(--hw-bg-gray)', minHeight: '100%', padding: 48 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B21A8', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <i className="bi bi-arrow-left" /> Back
        </button>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '16px 20px', color: '#991B1B' }}>
          {error ?? 'Resident not found.'}
        </div>
      </div>
    );
  }

  const r = detail.resident;
  const site = r.safehouse?.name?.trim() || r.safehouse?.safehouseCode?.trim() || `Safehouse #${r.safehouseId}`;
  const statusCfg = STATUS_COLORS[r.caseStatus ?? ''] ?? { bg: '#F1F5F9', text: '#475569' };
  const riskCfg = r.currentRiskLevel ? (RISK_COLORS[r.currentRiskLevel] ?? { bg: '#F1F5F9', text: '#475569' }) : null;
  const latestHealth = detail.healthRecords[0];
  const latestEdu = detail.educationRecords[0];
  const subCatLabels = SUB_CATS.filter(s => r[s.key]).map(s => s.label);

  const avgHealthScore = latestHealth?.generalHealthScore != null
    ? Number(latestHealth.generalHealthScore).toFixed(1)
    : null;
  const sessionCount = recordings.length;
  const incidentCount = detail.incidents.length;
  // readinessPercentileAmongCurrentResidents is already 0–100, no multiplication needed
  const readinessPct = ml?.readinessPercentileAmongCurrentResidents != null
    ? Math.round(Number(ml.readinessPercentileAmongCurrentResidents))
    : null;

  const scrollTo = (sectionId: string) => () => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const TABLE_SCROLL: React.CSSProperties = { maxHeight: 280, overflowY: 'auto', overflowX: 'auto', borderRadius: 8 };

  return (
    <div style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl py-4">

        {/* Back nav */}
        <div style={{ marginBottom: 20 }}>
          <Link
            to="/admin/residents"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6B21A8', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
          >
            <i className="bi bi-arrow-left" />
            Back to all residents
          </Link>
        </div>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
          <div>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Resident profile</span>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 26, color: '#1E3A5F', margin: 0, lineHeight: 1.2 }}>
              {r.internalCode || r.caseControlNo || `Resident #${r.residentId}`}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <span style={{ background: statusCfg.bg, color: statusCfg.text, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                {r.caseStatus || 'Unknown status'}
              </span>
              {riskCfg && (
                <span style={{ background: riskCfg.bg, color: riskCfg.text, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                  {r.currentRiskLevel} risk
                </span>
              )}
              <span style={{ fontSize: 12, color: '#94A3B8' }}>{site}</span>
              {r.assignedSocialWorker && (
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  <i className="bi bi-person-fill me-1" />{r.assignedSocialWorker}
                </span>
              )}
            </div>
          </div>
          {canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                to={`/admin/residents/process-recordings?residentId=${r.residentId}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0D9488', color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
              >
                <i className="bi bi-journal-plus" />
                Record session
              </Link>
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            {
              icon: 'heart-pulse', label: 'Latest health score',
              value: avgHealthScore ? `${avgHealthScore} / 10` : 'No data',
              accent: avgHealthScore ? (Number(avgHealthScore) >= 7 ? '#059669' : Number(avgHealthScore) >= 4 ? '#D97706' : '#DC2626') : '#94A3B8',
              sectionId: 'section-health',
            },
            { icon: 'clipboard2-data', label: 'Session recordings', value: String(sessionCount), accent: '#1E3A5F', sectionId: 'section-sessions' },
            { icon: 'exclamation-triangle', label: 'Incident reports', value: String(incidentCount), accent: incidentCount > 0 ? '#991B1B' : '#64748B', sectionId: 'section-incidents' },
            { icon: 'graph-up-arrow', label: 'Reintegration readiness', value: readinessPct != null ? `${readinessPct}th %ile` : 'No ML data', accent: '#6B21A8', sectionId: 'section-ml' },
            { icon: 'calendar3', label: 'Length of stay', value: r.lengthOfStay || '—', accent: '#0D9488', sectionId: null },
            { icon: 'mortarboard', label: 'Education records', value: String(detail.educationRecords.length), accent: '#2563EB', sectionId: 'section-education' },
          ].map(k => (
            <div
              key={k.label}
              onClick={k.sectionId ? scrollTo(k.sectionId) : undefined}
              style={{
                flex: '1 1 140px', background: '#fff', borderRadius: 12, padding: '14px 16px',
                border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
                cursor: k.sectionId ? 'pointer' : 'default',
                transition: 'box-shadow 0.15s',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 8, color: k.accent, lineHeight: 1 }}>
                <i className={`bi bi-${k.icon}`} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.accent, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 6 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* ML readiness banner */}
        {ml && (
          <div id="section-ml" style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <i className="bi bi-stars" style={{ fontSize: 20, color: '#6B21A8' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B21A8', marginBottom: 2 }}>ML Reintegration Readiness</div>
              <div style={{ fontSize: 13, color: '#4C1D95' }}>
                Support priority rank <strong>#{ml.supportPriorityRank}</strong>
                {ml.operationalBand && <> · Band: <strong>{ml.operationalBand}</strong></>}
                {readinessPct != null && <> · <strong>{readinessPct}th percentile</strong> among current residents</>}
              </div>
            </div>
            {ml.topRiskFactors && ml.topRiskFactors.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700, marginBottom: 4 }}>Top risk factors</div>
                {ml.topRiskFactors.slice(0, 3).map(f => (
                  <div key={f} style={{ fontSize: 12, color: '#4C1D95' }}>• {f}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card>
            <StaticSectionHeader icon="person-badge" title="Identification & placement" />
            <Field label="Database ID" value={String(r.residentId)} />
            <Field label="Case control no." value={r.caseControlNo} />
            <Field label="Internal code" value={r.internalCode} />
            <Field label="Safehouse" value={site} />
            <Field label="Assigned social worker" value={r.assignedSocialWorker} />
          </Card>

          <Card>
            <StaticSectionHeader icon="folder2-open" title="Case classification" />
            <Field label="Case status" value={r.caseStatus} />
            <Field label="Case category" value={r.caseCategory} />
            <Field label="Initial risk level" value={r.initialRiskLevel} />
            <Field label="Current risk level" value={r.currentRiskLevel} />
            <Field label="Sub-categories" value={subCatLabels.join(', ') || '—'} />
          </Card>

          <Card>
            <StaticSectionHeader icon="people" title="Demographics" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <Field label="Sex" value={r.sex} />
              <Field label="Date of birth" value={fmtDate(r.dateOfBirth)} />
              <Field label="Birth status" value={r.birthStatus} />
              <Field label="Place of birth" value={r.placeOfBirth} />
              <Field label="Religion" value={r.religion} />
              <Field label="PWD" value={yn(r.isPwd)} />
              <Field label="PWD type" value={r.pwdType} />
              <Field label="Special needs" value={yn(r.hasSpecialNeeds)} />
            </div>
            {r.specialNeedsDiagnosis && <Field label="Special needs diagnosis" value={r.specialNeedsDiagnosis} />}
          </Card>

          <Card>
            <StaticSectionHeader icon="house-heart" title="Family profile" />
            <Field label="4Ps beneficiary" value={yn(r.familyIs4ps)} />
            <Field label="Solo parent household" value={yn(r.familySoloParent)} />
            <Field label="Indigenous group" value={yn(r.familyIndigenous)} />
            <Field label="Parent with disability" value={yn(r.familyParentPwd)} />
            <Field label="Informal settler" value={yn(r.familyInformalSettler)} />
          </Card>
        </div>

        {/* Admission & Referral */}
        <Card style={{ marginBottom: 20 }}>
          <StaticSectionHeader icon="calendar-check" title="Admission & referral" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 0 }}>
            <Field label="Date of admission" value={fmtDate(r.dateOfAdmission)} />
            <Field label="Age upon admission" value={r.ageUponAdmission} />
            <Field label="Present age" value={r.presentAge} />
            <Field label="Length of stay" value={r.lengthOfStay} />
            <Field label="Referral source" value={r.referralSource} />
            <Field label="Referring agency/person" value={r.referringAgencyPerson} />
            <Field label="Date enrolled" value={fmtDate(r.dateEnrolled)} />
            <Field label="Date closed" value={fmtDate(r.dateClosed)} />
          </div>
          {r.initialCaseAssessment && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', marginBottom: 4 }}>Initial case assessment</div>
              <div style={{ fontSize: 13, color: '#1E3A5F', whiteSpace: 'pre-wrap', background: '#F8FAFC', borderRadius: 6, padding: '10px 14px', border: '1px solid #E2E8F0' }}>{r.initialCaseAssessment}</div>
            </div>
          )}
        </Card>

        {/* Reintegration + Restricted notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card>
            <StaticSectionHeader icon="arrow-up-right-circle" title="Reintegration" />
            <Field label="Reintegration type" value={r.reintegrationType} />
            <Field label="Reintegration status" value={r.reintegrationStatus} />
          </Card>
          <Card>
            <StaticSectionHeader icon="lock" title="Restricted notes" />
            <p style={{ fontSize: 13, color: '#1E3A5F', whiteSpace: 'pre-wrap', margin: 0 }}>{r.notesRestricted?.trim() || '—'}</p>
          </Card>
        </div>

        {/* ── Education Records ─────────────────────────────────────────────────── */}
        <Card id="section-education" style={{ marginBottom: 20 }}>
          <SectionCrudHeader
            icon="mortarboard" title="Education records" count={detail.educationRecords.length}
            accentBg="#EFF6FF" accentText="#1D4ED8"
            canWrite={canWrite} onAdd={openEduCreate}
          />
          {detail.educationRecords.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No education records on file.</p>
          ) : (
            <>
              {latestEdu && (
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{fmtDate(latestEdu.recordDate)}</div>
                  </div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>School</div><div style={{ fontSize: 13, color: '#1E3A5F' }}>{latestEdu.schoolName || '—'}</div></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Status</div><div style={{ fontSize: 13, color: '#1E3A5F' }}>{latestEdu.enrollmentStatus || '—'}</div></div>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Attendance</div>
                    {scoreBar(latestEdu.attendanceRate != null ? latestEdu.attendanceRate * 10 : null)}
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Progress</div>
                    {scoreBar(latestEdu.progressPercent != null ? latestEdu.progressPercent * 10 : null)}
                  </div>
                </div>
              )}
              <EduChart records={detail.educationRecords} />
              <div style={TABLE_SCROLL}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['Date', 'Level', 'School', 'Status', 'Attendance', 'Progress', 'Completion', 'Notes', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.educationRecords.map((e, i) => (
                      <tr key={e.educationRecordId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(e.recordDate)}</td>
                        <td style={{ padding: '8px 12px' }}>{e.educationLevel || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.schoolName || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.enrollmentStatus || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.attendanceRate != null ? `${(Number(e.attendanceRate) * 100).toFixed(0)}%` : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.progressPercent != null ? `${(Number(e.progressPercent) * 100).toFixed(0)}%` : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{e.completionStatus || '—'}</td>
                        <td style={{ padding: '8px 12px', maxWidth: 180, color: '#64748B' }}>{e.notes?.trim() || '—'}</td>
                        {canWrite && <RowActions onEdit={() => openEduEdit(e)} onDelete={() => setEduDeleteTarget(e)} />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* ── Health & Wellbeing ────────────────────────────────────────────────── */}
        <Card id="section-health" style={{ marginBottom: 20 }}>
          <SectionCrudHeader
            icon="heart-pulse" title="Health & wellbeing" count={detail.healthRecords.length}
            accentBg="#DCFCE7" accentText="#166534"
            canWrite={canWrite} onAdd={openHealthCreate}
          />
          {detail.healthRecords.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No health records on file.</p>
          ) : (
            <>
              {latestHealth && (
                <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '16px 20px', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                    Latest record — {fmtDate(latestHealth.recordDate)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                    {[
                      { label: 'General health', val: latestHealth.generalHealthScore },
                      { label: 'Nutrition', val: latestHealth.nutritionScore },
                      { label: 'Sleep quality', val: latestHealth.sleepQualityScore },
                      { label: 'Energy level', val: latestHealth.energyLevelScore },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{label}</div>
                        {val != null ? scoreBar(val) : <span style={{ fontSize: 12, color: '#94A3B8' }}>—</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                    {latestHealth.heightCm && <div style={{ fontSize: 12, color: '#475569' }}>Height: <strong>{Number(latestHealth.heightCm).toFixed(1)} cm</strong></div>}
                    {latestHealth.weightKg && <div style={{ fontSize: 12, color: '#475569' }}>Weight: <strong>{Number(latestHealth.weightKg).toFixed(1)} kg</strong></div>}
                    {latestHealth.bmi && <div style={{ fontSize: 12, color: '#475569' }}>BMI: <strong>{Number(latestHealth.bmi).toFixed(1)}</strong></div>}
                    <div style={{ fontSize: 12, color: '#475569' }}>Medical: <strong>{yn(latestHealth.medicalCheckupDone)}</strong></div>
                    <div style={{ fontSize: 12, color: '#475569' }}>Dental: <strong>{yn(latestHealth.dentalCheckupDone)}</strong></div>
                    <div style={{ fontSize: 12, color: '#475569' }}>Psychological: <strong>{yn(latestHealth.psychologicalCheckupDone)}</strong></div>
                  </div>
                </div>
              )}
              <HealthChart records={detail.healthRecords} />
              <div style={TABLE_SCROLL}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['Date', 'Health', 'Nutrition', 'Sleep', 'Energy', 'Ht (cm)', 'Wt (kg)', 'BMI', 'Med', 'Dent', 'Psych', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.healthRecords.map((h, i) => (
                      <tr key={h.healthRecordId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(h.recordDate)}</td>
                        <td style={{ padding: '8px 12px' }}>{h.generalHealthScore != null ? Number(h.generalHealthScore).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{h.nutritionScore != null ? Number(h.nutritionScore).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{h.sleepQualityScore != null ? Number(h.sleepQualityScore).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{h.energyLevelScore != null ? Number(h.energyLevelScore).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{h.heightCm != null ? Number(h.heightCm).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{h.weightKg != null ? Number(h.weightKg).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{h.bmi != null ? Number(h.bmi).toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{yn(h.medicalCheckupDone)}</td>
                        <td style={{ padding: '8px 12px' }}>{yn(h.dentalCheckupDone)}</td>
                        <td style={{ padding: '8px 12px' }}>{yn(h.psychologicalCheckupDone)}</td>
                        {canWrite && <RowActions onEdit={() => openHealthEdit(h)} onDelete={() => setHealthDeleteTarget(h)} />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* ── Session Recordings ────────────────────────────────────────────────── */}
        <Card id="section-sessions" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi bi-journal-text" style={{ color: '#0D9488', fontSize: 16 }} />
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E3A5F', margin: 0 }}>Session recordings</h2>
              <span style={{ background: '#E0F2FE', color: '#0369A1', borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 700 }}>{recordings.length}</span>
            </div>
            {canWrite && (
              <Link
                to={`/admin/residents/process-recordings?residentId=${r.residentId}`}
                style={{ fontSize: 12, color: '#0D9488', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <i className="bi bi-plus-circle" /> Add session
              </Link>
            )}
          </div>
          {recordings.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No session recordings on file.</p>
          ) : (
            <div style={TABLE_SCROLL}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['Date', 'Type', 'Social worker', 'Duration', 'Emotional state', 'Progress', 'Concerns', 'Narrative'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((rec, i) => (
                    <tr key={rec.recordingId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(rec.sessionDate)}</td>
                      <td style={{ padding: '8px 12px' }}>{rec.sessionType || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{rec.conductedBy || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{rec.durationMinutes ?? '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{rec.emotionalStateObserved || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{rec.progressNoted === true ? '✓ Yes' : rec.progressNoted === false ? 'No' : '—'}</td>
                      <td style={{ padding: '8px 12px', color: rec.concernsFlagged ? '#991B1B' : undefined, fontWeight: rec.concernsFlagged ? 700 : undefined }}>
                        {rec.concernsFlagged === true ? '⚠ Yes' : rec.concernsFlagged === false ? 'No' : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', maxWidth: 260, color: '#64748B' }}>{rec.sessionNarrative?.trim().slice(0, 120) || '—'}{(rec.sessionNarrative?.length ?? 0) > 120 ? '…' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Intervention Plans ────────────────────────────────────────────────── */}
        <Card id="section-plans" style={{ marginBottom: 20 }}>
          <SectionCrudHeader
            icon="diagram-3" title="Intervention plans" count={detail.interventionPlans.length}
            accentBg="#F5F3FF" accentText="#6B21A8"
            canWrite={canWrite} onAdd={openPlanCreate}
          />
          {detail.interventionPlans.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No intervention plans on file.</p>
          ) : (
            <div style={TABLE_SCROLL}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['Category', 'Status', 'Target date', 'Conference date', 'Services provided', 'Description', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.interventionPlans.map((p, i) => (
                    <tr key={p.planId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.planCategory || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: p.status === 'Completed' ? '#DCFCE7' : p.status === 'Active' ? '#DBEAFE' : '#F1F5F9', color: p.status === 'Completed' ? '#166534' : p.status === 'Active' ? '#1E40AF' : '#475569', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                          {p.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(p.targetDate)}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(p.caseConferenceDate)}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 180, color: '#64748B' }}>{p.servicesProvided?.trim() || '—'}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 220, color: '#64748B' }}>{p.planDescription?.trim().slice(0, 100) || '—'}{(p.planDescription?.length ?? 0) > 100 ? '…' : ''}</td>
                      {canWrite && <RowActions onEdit={() => openPlanEdit(p)} onDelete={() => setPlanDeleteTarget(p)} />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Incident Reports ──────────────────────────────────────────────────── */}
        <Card id="section-incidents" style={{ marginBottom: 20 }}>
          <StaticSectionHeader icon="shield-exclamation" title="Incident reports" />
          {detail.incidents.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No incident reports on file.</p>
          ) : (
            <div style={TABLE_SCROLL}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['Date', 'Type', 'Severity', 'Resolved', 'Resolution date', 'Follow-up', 'Reported by', 'Description', 'Response'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.incidents.map((inc, i) => (
                    <tr key={inc.incidentId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(inc.incidentDate)}</td>
                      <td style={{ padding: '8px 12px' }}>{inc.incidentType || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: inc.severity === 'High' || inc.severity === 'Critical' ? '#FEE2E2' : '#F1F5F9', color: inc.severity === 'High' || inc.severity === 'Critical' ? '#991B1B' : '#475569', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                          {inc.severity || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{yn(inc.resolved)}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(inc.resolutionDate)}</td>
                      <td style={{ padding: '8px 12px' }}>{yn(inc.followUpRequired)}</td>
                      <td style={{ padding: '8px 12px' }}>{inc.reportedBy || '—'}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 200, color: '#64748B' }}>{inc.description?.trim() || '—'}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 200, color: '#64748B' }}>{inc.responseTaken?.trim() || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── Home Visitations ──────────────────────────────────────────────────── */}
        <Card id="section-visits" style={{ marginBottom: 40 }}>
          <SectionCrudHeader
            icon="house-door" title="Home visitations" count={visits.length}
            accentBg="#E0F2FE" accentText="#0369A1"
            canWrite={canWrite} onAdd={openVisitCreate}
          />
          {visits.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>No home visitations on file.</p>
          ) : (
            <div style={TABLE_SCROLL}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    {['Date', 'Conducted by', 'Purpose', 'Outcome', 'Follow-up', 'Notes', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v, i) => (
                    <tr key={v.visitationId} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(v.visitDate)}</td>
                      <td style={{ padding: '8px 12px' }}>{v.conductedBy || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{v.purpose || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{v.outcome || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{yn(v.followUpRequired)}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 220, color: '#64748B' }}>{v.notes?.trim() || '—'}</td>
                      {canWrite && <RowActions onEdit={() => openVisitEdit(v)} onDelete={() => setVisitDeleteTarget(v)} />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>

      {/* ── Education Modal ───────────────────────────────────────────────────── */}
      {eduEdit != null && (
        <ModalShell
          title={eduEdit === 'new' ? 'Add Education Record' : 'Edit Education Record'}
          onClose={() => setEduEdit(null)} onSave={handleEduSave}
          saving={eduSaving} error={eduError}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <MF label="Record date"><input type="date" style={inputStyle} value={eduForm.recordDate} onChange={e => setEduForm(f => ({ ...f, recordDate: e.target.value }))} /></MF>
            <MF label="Education level"><input type="text" style={inputStyle} value={eduForm.educationLevel} onChange={e => setEduForm(f => ({ ...f, educationLevel: e.target.value }))} placeholder="e.g. Elementary, High School" /></MF>
            <MF label="School name"><input type="text" style={inputStyle} value={eduForm.schoolName} onChange={e => setEduForm(f => ({ ...f, schoolName: e.target.value }))} /></MF>
            <MF label="Enrollment status">
              <select style={selectStyle} value={eduForm.enrollmentStatus} onChange={e => setEduForm(f => ({ ...f, enrollmentStatus: e.target.value }))}>
                {['Enrolled', 'Withdrawn', 'Graduated', 'On Leave'].map(s => <option key={s}>{s}</option>)}
              </select>
            </MF>
            <MF label="Attendance rate (0–1)"><input type="number" style={inputStyle} value={eduForm.attendanceRate} min={0} max={1} step={0.01} onChange={e => setEduForm(f => ({ ...f, attendanceRate: e.target.value }))} placeholder="e.g. 0.85" /></MF>
            <MF label="Progress % (0–1)"><input type="number" style={inputStyle} value={eduForm.progressPercent} min={0} max={1} step={0.01} onChange={e => setEduForm(f => ({ ...f, progressPercent: e.target.value }))} placeholder="e.g. 0.70" /></MF>
            <MF label="Completion status"><input type="text" style={inputStyle} value={eduForm.completionStatus} onChange={e => setEduForm(f => ({ ...f, completionStatus: e.target.value }))} /></MF>
          </div>
          <MF label="Notes"><textarea style={textareaStyle} value={eduForm.notes} onChange={e => setEduForm(f => ({ ...f, notes: e.target.value }))} /></MF>
        </ModalShell>
      )}

      {/* ── Health Modal ──────────────────────────────────────────────────────── */}
      {healthEdit != null && (
        <ModalShell
          title={healthEdit === 'new' ? 'Add Health Record' : 'Edit Health Record'}
          onClose={() => setHealthEdit(null)} onSave={handleHealthSave}
          saving={healthSaving} error={healthError}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <MF label="Record date"><input type="date" style={inputStyle} value={healthForm.recordDate} onChange={e => setHealthForm(f => ({ ...f, recordDate: e.target.value }))} /></MF>
            <div />
            <MF label="General health (0–10)"><input type="number" style={inputStyle} value={healthForm.generalHealthScore} min={0} max={10} step={0.1} onChange={e => setHealthForm(f => ({ ...f, generalHealthScore: e.target.value }))} /></MF>
            <MF label="Nutrition (0–10)"><input type="number" style={inputStyle} value={healthForm.nutritionScore} min={0} max={10} step={0.1} onChange={e => setHealthForm(f => ({ ...f, nutritionScore: e.target.value }))} /></MF>
            <MF label="Sleep quality (0–10)"><input type="number" style={inputStyle} value={healthForm.sleepQualityScore} min={0} max={10} step={0.1} onChange={e => setHealthForm(f => ({ ...f, sleepQualityScore: e.target.value }))} /></MF>
            <MF label="Energy level (0–10)"><input type="number" style={inputStyle} value={healthForm.energyLevelScore} min={0} max={10} step={0.1} onChange={e => setHealthForm(f => ({ ...f, energyLevelScore: e.target.value }))} /></MF>
            <MF label="Height (cm)"><input type="number" style={inputStyle} value={healthForm.heightCm} min={0} step={0.1} onChange={e => setHealthForm(f => ({ ...f, heightCm: e.target.value }))} /></MF>
            <MF label="Weight (kg)"><input type="number" style={inputStyle} value={healthForm.weightKg} min={0} step={0.1} onChange={e => setHealthForm(f => ({ ...f, weightKg: e.target.value }))} /></MF>
            <MF label="BMI"><input type="number" style={inputStyle} value={healthForm.bmi} min={0} step={0.1} onChange={e => setHealthForm(f => ({ ...f, bmi: e.target.value }))} /></MF>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            {[
              { label: 'Medical checkup done', key: 'medicalCheckupDone' as const },
              { label: 'Dental checkup done', key: 'dentalCheckupDone' as const },
              { label: 'Psychological checkup done', key: 'psychologicalCheckupDone' as const },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={healthForm[key]} onChange={e => setHealthForm(f => ({ ...f, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <MF label="Notes"><textarea style={textareaStyle} value={healthForm.notes} onChange={e => setHealthForm(f => ({ ...f, notes: e.target.value }))} /></MF>
        </ModalShell>
      )}

      {/* ── Plan Modal ────────────────────────────────────────────────────────── */}
      {planEdit != null && (
        <ModalShell
          title={planEdit === 'new' ? 'Add Intervention Plan' : 'Edit Intervention Plan'}
          onClose={() => setPlanEdit(null)} onSave={handlePlanSave}
          saving={planSaving} error={planError}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <MF label="Plan category *"><input type="text" style={inputStyle} value={planForm.planCategory} onChange={e => setPlanForm(f => ({ ...f, planCategory: e.target.value }))} placeholder="e.g. Education, Health" /></MF>
            <MF label="Status *">
              <select style={selectStyle} value={planForm.status} onChange={e => setPlanForm(f => ({ ...f, status: e.target.value }))}>
                {['Active', 'Completed', 'Paused', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
              </select>
            </MF>
            <MF label="Target date"><input type="date" style={inputStyle} value={planForm.targetDate} onChange={e => setPlanForm(f => ({ ...f, targetDate: e.target.value }))} /></MF>
            <MF label="Case conference date"><input type="date" style={inputStyle} value={planForm.caseConferenceDate} onChange={e => setPlanForm(f => ({ ...f, caseConferenceDate: e.target.value }))} /></MF>
            <MF label="Target value"><input type="number" style={inputStyle} value={planForm.targetValue} onChange={e => setPlanForm(f => ({ ...f, targetValue: e.target.value }))} /></MF>
          </div>
          <MF label="Services provided"><textarea style={textareaStyle} value={planForm.servicesProvided} onChange={e => setPlanForm(f => ({ ...f, servicesProvided: e.target.value }))} /></MF>
          <MF label="Plan description"><textarea style={textareaStyle} value={planForm.planDescription} onChange={e => setPlanForm(f => ({ ...f, planDescription: e.target.value }))} /></MF>
        </ModalShell>
      )}

      {/* ── Visit Modal ───────────────────────────────────────────────────────── */}
      {visitEdit != null && (
        <ModalShell
          title={visitEdit === 'new' ? 'Add Home Visitation' : 'Edit Home Visitation'}
          onClose={() => setVisitEdit(null)} onSave={handleVisitSave}
          saving={visitSaving} error={visitError}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <MF label="Visit date"><input type="date" style={inputStyle} value={visitForm.visitDate} onChange={e => setVisitForm(f => ({ ...f, visitDate: e.target.value }))} /></MF>
            <MF label="Conducted by"><input type="text" style={inputStyle} value={visitForm.conductedBy} onChange={e => setVisitForm(f => ({ ...f, conductedBy: e.target.value }))} /></MF>
            <MF label="Purpose"><input type="text" style={inputStyle} value={visitForm.purpose} onChange={e => setVisitForm(f => ({ ...f, purpose: e.target.value }))} /></MF>
            <MF label="Outcome"><input type="text" style={inputStyle} value={visitForm.outcome} onChange={e => setVisitForm(f => ({ ...f, outcome: e.target.value }))} /></MF>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={visitForm.followUpRequired} onChange={e => setVisitForm(f => ({ ...f, followUpRequired: e.target.checked }))} />
              Follow-up required
            </label>
          </div>
          <MF label="Notes"><textarea style={textareaStyle} value={visitForm.notes} onChange={e => setVisitForm(f => ({ ...f, notes: e.target.value }))} /></MF>
        </ModalShell>
      )}

      {/* ── Delete confirmations ──────────────────────────────────────────────── */}
      <DeleteConfirmModal
        show={!!eduDeleteTarget}
        itemLabel={`education record from ${fmtDate(eduDeleteTarget?.recordDate)}`}
        onConfirm={handleEduDelete}
        onCancel={() => setEduDeleteTarget(null)}
      />
      <DeleteConfirmModal
        show={!!healthDeleteTarget}
        itemLabel={`health record from ${fmtDate(healthDeleteTarget?.recordDate)}`}
        onConfirm={handleHealthDelete}
        onCancel={() => setHealthDeleteTarget(null)}
      />
      <DeleteConfirmModal
        show={!!planDeleteTarget}
        itemLabel={`intervention plan "${planDeleteTarget?.planCategory ?? ''}"`}
        onConfirm={handlePlanDelete}
        onCancel={() => setPlanDeleteTarget(null)}
      />
      <DeleteConfirmModal
        show={!!visitDeleteTarget}
        itemLabel={`home visitation on ${fmtDate(visitDeleteTarget?.visitDate)}`}
        onConfirm={handleVisitDelete}
        onCancel={() => setVisitDeleteTarget(null)}
      />
    </div>
  );
}
