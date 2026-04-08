import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchJson } from '../../lib/apiClient';
import { getResidentReadiness, type ResidentMlScoreRow } from '../../lib/mlApi';
import {
  formatRelativeReadinessPercentile,
  formatResidentPriorityRank,
} from '../../lib/mlDisplayHelpers';
import { ErrorState, LoadingState } from '../../components/common/AsyncStatus';
import 'bootstrap-icons/font/bootstrap-icons.css';

interface ResidentDetail {
  residentId: number;
  caseControlNo: string | null;
  internalCode: string | null;
  safehouseId: number;
  caseStatus: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  caseCategory: string | null;
  dateOfAdmission: string | null;
  presentAge: string | null;
  lengthOfStay: string | null;
  assignedSocialWorker: string | null;
  currentRiskLevel: string | null;
  reintegrationType: string | null;
  reintegrationStatus: string | null;
  referralSource: string | null;
  safehouse?: { name?: string | null; safehouseCode?: string | null } | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  Low: { bg: '#DCFCE7', text: '#166534' },
  Medium: { bg: '#FEF9C3', text: '#854D0E' },
  High: { bg: '#FEE2E2', text: '#991B1B' },
  Critical: { bg: '#1E293B', text: '#F8FAFC' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active: { bg: '#DCFCE7', text: '#166534' },
  Closed: { bg: '#F1F5F9', text: '#64748B' },
  Transferred: { bg: '#DBEAFE', text: '#1E40AF' },
};

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{ display: 'inline-block', background: bg, color: text, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  );
}

export default function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [resident, setResident] = useState<ResidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mlScore, setMlScore] = useState<ResidentMlScoreRow | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<ResidentDetail>(`/api/residents/${id}`)
      .then((r) => {
        if (!cancelled) {
          setResident(r);
          if (r.internalCode) {
            getResidentReadiness(r.internalCode)
              .then((ml) => { if (!cancelled) setMlScore(ml); })
              .catch(() => { /* ML data optional */ });
          }
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Failed to load resident details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="py-5"><LoadingState message="Loading resident profile..." /></div>;
  if (error) return <div className="py-5 container-xl"><ErrorState message={error} /></div>;
  if (!resident) return <div className="py-5 container-xl"><ErrorState message="Resident not found." /></div>;

  const sCfg = STATUS_COLORS[resident.caseStatus ?? ''] ?? { bg: '#F1F5F9', text: '#64748B' };
  const rCfg = RISK_COLORS[resident.currentRiskLevel ?? ''];

  const readinessPct = mlScore?.readinessPercentileAmongCurrentResidents;
  const pctValue = readinessPct != null ? Number(readinessPct) : null;
  const pctColor = pctValue != null ? (pctValue > 70 ? '#166534' : pctValue > 40 ? '#854D0E' : '#991B1B') : '#64748B';

  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">
        <Link to="/admin/residents" className="text-decoration-none small fw-semibold mb-3 d-inline-block" style={{ color: '#6B21A8' }}>
          <i className="bi bi-arrow-left me-1" /> Back to residents
        </Link>

        <div className="mb-4">
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 24, color: '#1E3A5F', marginBottom: 8 }}>
            Resident {resident.internalCode || `#${resident.residentId}`}
          </h1>
          <div className="d-flex gap-2 flex-wrap">
            <Badge label={resident.caseStatus ?? '—'} bg={sCfg.bg} text={sCfg.text} />
            {rCfg && <Badge label={`Risk: ${resident.currentRiskLevel}`} bg={rCfg.bg} text={rCfg.text} />}
            {resident.caseCategory && <Badge label={resident.caseCategory} bg="#F3E8FF" text="#6B21A8" />}
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-body">
                <h6 className="fw-bold text-uppercase small text-secondary mb-3">Case Information</h6>
                <div className="row g-3">
                  {[
                    ['Case Control No.', resident.caseControlNo],
                    ['Internal Code', resident.internalCode],
                    ['Safehouse', resident.safehouse?.name ?? resident.safehouse?.safehouseCode ?? `ID ${resident.safehouseId}`],
                    ['Sex', resident.sex],
                    ['Date of Birth', fmtDate(resident.dateOfBirth)],
                    ['Present Age', resident.presentAge],
                    ['Date of Admission', fmtDate(resident.dateOfAdmission)],
                    ['Length of Stay', resident.lengthOfStay],
                    ['Assigned Social Worker', resident.assignedSocialWorker],
                    ['Referral Source', resident.referralSource],
                    ['Reintegration Type', resident.reintegrationType],
                    ['Reintegration Status', resident.reintegrationStatus],
                  ].map(([label, value]) => (
                    <div className="col-sm-6 col-lg-4" key={label as string}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 14, color: '#1E293B', marginTop: 2 }}>{value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            {mlScore && (
              <div className="card border-0 shadow-sm rounded-3 mb-3">
                <div className="card-body">
                  <h6 className="fw-bold text-uppercase small text-secondary mb-3">Reintegration Readiness</h6>
                  <div className="text-center mb-3">
                    <div style={{ fontSize: 36, fontWeight: 800, color: pctColor, lineHeight: 1 }}>
                      {formatRelativeReadinessPercentile(readinessPct)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>relative readiness percentile</div>
                  </div>
                  <div className="mb-2" style={{ fontSize: 13, color: '#475569' }}>
                    {formatResidentPriorityRank(mlScore.supportPriorityRank)}
                  </div>
                  <div className="mb-2" style={{ fontSize: 13, color: '#475569' }}>
                    Band: <strong>{mlScore.operationalBand}</strong>
                  </div>
                  {mlScore.topPositiveFactors.length > 0 && (
                    <div className="mb-2">
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>Positive factors</div>
                      {mlScore.topPositiveFactors.slice(0, 3).map((f) => (
                        <div key={f} style={{ fontSize: 12, color: '#475569' }}>{f}</div>
                      ))}
                    </div>
                  )}
                  {mlScore.topRiskFactors.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#991B1B' }}>Risk factors</div>
                      {mlScore.topRiskFactors.slice(0, 3).map((f) => (
                        <div key={f} style={{ fontSize: 12, color: '#475569' }}>{f}</div>
                      ))}
                    </div>
                  )}
                  <p className="text-muted mt-3 mb-0" style={{ fontSize: 11 }}>
                    AI-assisted assessment — not a clinical evaluation.
                  </p>
                </div>
              </div>
            )}

            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-body">
                <h6 className="fw-bold text-uppercase small text-secondary mb-3">Quick Actions</h6>
                <div className="d-grid gap-2">
                  <Link to={`/admin/residents/${resident.residentId}/process`} className="btn btn-outline-primary btn-sm">
                    <i className="bi bi-journal-text me-2" />Session Notes
                  </Link>
                  <Link to={`/admin/residents/${resident.residentId}/visits`} className="btn btn-outline-primary btn-sm">
                    <i className="bi bi-house-door me-2" />Field Visits
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
