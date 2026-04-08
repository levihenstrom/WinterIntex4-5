import { useState } from 'react';
import { getResidentReadiness, type ResidentMlScoreRow } from '../../lib/mlApi';
import {
  formatRelativeReadinessPercentile,
  formatResidentPriorityRank,
} from '../../lib/mlDisplayHelpers';
import { ErrorState, LoadingState } from '../../components/common/AsyncStatus';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function MLInsightsPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResidentMlScoreRow | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await getResidentReadiness(code.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve readiness score.');
    } finally {
      setLoading(false);
    }
  }

  const readinessPct = result?.readinessPercentileAmongCurrentResidents;
  const pctValue = readinessPct != null ? Number(readinessPct) : null;
  const pctColor = pctValue != null
    ? pctValue > 70 ? '#166534' : pctValue > 40 ? '#854D0E' : '#991B1B'
    : '#64748B';
  const pctBg = pctValue != null
    ? pctValue > 70 ? '#DCFCE7' : pctValue > 40 ? '#FEF9C3' : '#FEE2E2'
    : '#F1F5F9';

  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">
        <div className="mb-5">
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: '#0D9488',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Machine Learning
          </span>
          <h1
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: 28,
              color: '#1E3A5F',
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            ML Insights
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: 14 }}>
            AI-powered tools to support staff decision-making.
          </p>
        </div>

        {/* Reintegration Readiness Scorer */}
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: '24px 28px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 12px rgba(30,58,95,0.06)',
            maxWidth: 600,
          }}
        >
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 700, color: '#1E3A5F', marginBottom: 4 }}>
            Reintegration Readiness Scorer
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
            Enter a resident code to view their AI-assessed readiness score.
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} className="d-flex gap-2 mb-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. LS-0006"
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                background: '#1E3A5F',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontWeight: 600,
                fontSize: 13,
                cursor: loading ? 'wait' : 'pointer',
                opacity: !code.trim() ? 0.5 : 1,
              }}
            >
              {loading ? 'Loading...' : 'Get Score'}
            </button>
          </form>

          {loading && <LoadingState message="Fetching readiness data..." size="compact" />}
          {error && <ErrorState message={error} />}

          {result && (
            <div
              className="mt-3 p-3 rounded-3"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <div className="d-flex align-items-center gap-3 mb-3">
                <div
                  className="d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: 64,
                    height: 64,
                    background: pctBg,
                    border: `2px solid ${pctColor}`,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 800, color: pctColor }}>
                    {formatRelativeReadinessPercentile(readinessPct)}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>
                    {result.residentCode}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569' }}>
                    {formatResidentPriorityRank(result.supportPriorityRank)}
                  </div>
                  <div className="d-flex gap-2 mt-1">
                    <span
                      className="badge rounded-pill"
                      style={{
                        background: pctBg,
                        color: pctColor,
                        border: `1px solid ${pctColor}40`,
                        fontSize: 11,
                      }}
                    >
                      {result.operationalBand}
                    </span>
                  </div>
                </div>
              </div>

              {result.topPositiveFactors.length > 0 && (
                <div className="mb-2">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Positive Factors</div>
                  <div className="d-flex flex-wrap gap-1">
                    {result.topPositiveFactors.slice(0, 4).map((f) => (
                      <span key={f} className="badge" style={{ background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 500 }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.topRiskFactors.length > 0 && (
                <div className="mb-2">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', marginBottom: 4 }}>Risk Factors</div>
                  <div className="d-flex flex-wrap gap-1">
                    {result.topRiskFactors.slice(0, 4).map((f) => (
                      <span key={f} className="badge" style={{ background: '#FEE2E2', color: '#991B1B', fontSize: 11, fontWeight: 500 }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}

              <div
                className="mt-3 pt-2"
                style={{ borderTop: '1px solid #E2E8F0', fontSize: 11, color: '#94A3B8' }}
              >
                <i className="bi bi-info-circle me-1" />
                AI-assisted insight — not a clinical assessment. Always consult the assigned social worker for care decisions.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
