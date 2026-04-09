import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson, fetchPaged } from '../../lib/apiClient';
import { isOkrSuccessfulReintegration } from '../../lib/residentOutcome';
import { useAuth } from '../../context/AuthContext';

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

interface ProcessRecordingSummary {
  recordingId: number;
  sessionDate: string | null;
  sessionType: string | null;
  conductedBy: string | null;
  durationMinutes: number | null;
  progressNoted: boolean | null;
  concernsFlagged: boolean | null;
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

interface ProfileDetail {
  resident: Resident;
  incidents: IncidentSummary[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export interface ResidentProfileModalProps {
  residentId: number | null;
  onClose: () => void;
  /** When provided, shows "Edit this resident" button in the modal footer. */
  onEditResident?: (resident: Resident) => void;
}

export function ResidentProfileModal({ residentId, onClose, onEditResident }: ResidentProfileModalProps) {
  const { authSession } = useAuth();
  const canWrite = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<ProcessRecordingSummary[] | null>(null);
  const [recordingsLoading, setRecordingsLoading] = useState(false);

  useEffect(() => {
    if (residentId == null) {
      setDetail(null);
      setError(null);
      setRecordings(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setRecordings(null);
    fetchJson<ProfileDetail>(`/api/residents/${residentId}/detail`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Could not load resident profile.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    setRecordingsLoading(true);
    fetchPaged<ProcessRecordingSummary>('/api/process-recordings', 1, 20, { residentId: String(residentId) })
      .then((r) => { if (!cancelled) setRecordings(r.items); })
      .catch(() => { if (!cancelled) setRecordings([]); })
      .finally(() => { if (!cancelled) setRecordingsLoading(false); });

    return () => { cancelled = true; };
  }, [residentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (residentId == null) return null;

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
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true" aria-labelledby="residentProfileTitle">
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-bottom">
            <div className="flex-grow-1">
              <h5 className="modal-title fw-bold text-dark mb-0" id="residentProfileTitle">
                Resident profile
              </h5>
              <p className="small text-muted mb-0">Database ID {residentId} · read-only summary for staff review</p>
            </div>
            {canWrite && (
              <Link
                to={`/admin/residents/process-recordings?residentId=${residentId}`}
                className="btn btn-sm btn-outline-primary me-2 fw-semibold"
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                onClick={onClose}
              >
                <i className="bi bi-journal-plus me-1" />
                Record session
              </Link>
            )}
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {loading && <p className="text-muted">Loading full record…</p>}
            {error && <div className="alert alert-danger">{error}</div>}
            {detail && (() => {
              const r = detail.resident;
              const site =
                r.safehouse?.name?.trim() ||
                r.safehouse?.safehouseCode?.trim() ||
                `Safehouse #${r.safehouseId}`;
              return (
                <>
                  {isOkrSuccessfulReintegration(r.reintegrationStatus) && (
                    <div
                      className="mb-3 py-2 px-3 small rounded-2"
                      style={{
                        background: 'rgba(255, 251, 235, 0.95)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#92400e',
                      }}
                      role="status"
                    >
                      <i className="bi bi-award me-2" aria-hidden />
                      <strong>Successful reintegration</strong>
                      {' '}
                      — this resident counts toward the impact OKR (reintegration status: Completed). Case remains in the database for reporting and history.
                    </div>
                  )}
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
                  <h6 className="text-uppercase small fw-bold text-secondary mb-3 mt-4">Session recordings</h6>
                  {recordingsLoading && <p className="small text-muted">Loading sessions…</p>}
                  {!recordingsLoading && (!recordings || recordings.length === 0) && (
                    <p className="small text-muted">No session recordings on file for this resident.</p>
                  )}
                  {!recordingsLoading && recordings && recordings.length > 0 && (
                    <div className="table-responsive border rounded mb-4">
                      <table className="table table-sm table-striped mb-0 small">
                        <thead className="table-light">
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Social worker</th>
                            <th>Duration (min)</th>
                            <th>Progress?</th>
                            <th>Concerns?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recordings.map((rec) => (
                            <tr key={rec.recordingId}>
                              <td className="text-nowrap">{fmtDate(rec.sessionDate)}</td>
                              <td>{rec.sessionType || '—'}</td>
                              <td>{rec.conductedBy || '—'}</td>
                              <td>{rec.durationMinutes ?? '—'}</td>
                              <td>{rec.progressNoted === true ? 'Yes' : rec.progressNoted === false ? 'No' : '—'}</td>
                              <td>{rec.concernsFlagged === true ? 'Yes' : rec.concernsFlagged === false ? 'No' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <h6 className="text-uppercase small fw-bold text-secondary mb-3 mt-4">Incident reports</h6>
                  {detail.incidents.length === 0 ? (
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
                          {detail.incidents.map((inc) => (
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
              );
            })()}
          </div>
          <div className="modal-footer border-top">
            {detail && canWrite && onEditResident ? (
              <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEditResident(detail.resident); }}>
                Edit this resident
              </button>
            ) : null}
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
