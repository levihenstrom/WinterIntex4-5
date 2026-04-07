import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson } from '../../lib/apiClient';

interface NextPostSuggestion {
  platform: string | null;
  postType: string | null;
  dayOfWeek: string | null;
  postHour: number | null;
  sampleSize: number;
  explanation: string;
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '28px 32px',
  border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(30,58,95,0.06)',
};

const metricBox = (accent: string): React.CSSProperties => ({
  background: `${accent}12`, borderRadius: 12, padding: '16px 18px', border: `1px solid ${accent}35`,
});

/**
 * SOC-1 — next-post suggestion via /api/social-media-suggestions/next-post.
 */
export default function SocialMediaSuggestPage() {
  const [data, setData] = useState<NextPostSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson<NextPostSuggestion>('/api/social-media-suggestions/next-post')
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container">

        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', letterSpacing: 2, textTransform: 'uppercase' }}>Outreach &amp; Communication</span>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 28, color: '#1E3A5F', marginBottom: 4 }}>
              Suggest Next Post
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, marginBottom: 0 }}>
              Heuristic recommendation from historical engagement (ML-3 can extend the same API shape).
            </p>
          </div>
          <Link
            to="/admin/social-media"
            style={{
              background: 'none', color: '#1E3A5F', textDecoration: 'none', borderRadius: 8,
              border: '1px solid #CBD5E1', padding: '10px 18px', fontWeight: 600, fontSize: 14,
            }}
          >
            Post history
          </Link>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '56px 0', color: '#94A3B8' }}>
            <div className="spinner-border text-secondary mb-3" role="status" aria-label="Loading">
              <span className="visually-hidden">Loading…</span>
            </div>
            <p className="fw-semibold fs-6 mb-0">Loading recommendation…</p>
          </div>
        )}

        {error && (
          <div style={{ borderRadius: 12, padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 14 }}>
            {error}
          </div>
        )}

        {data && !loading && (
          <div style={cardStyle}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}>
              <div style={metricBox('#1E40AF')}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Platform</div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#1E3A5F' }}>{data.platform ?? '—'}</div>
              </div>
              <div style={metricBox('#6B21A8')}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Post type</div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#6B21A8' }}>{data.postType ?? '—'}</div>
              </div>
              <div style={metricBox('#0D9488')}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Day</div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#0F766E' }}>{data.dayOfWeek ?? '—'}</div>
              </div>
              <div style={metricBox('#D97706')}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Hour (24h)</div>
                <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#B45309' }}>
                  {data.postHour != null ? `${data.postHour}:00` : '—'}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
              <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.6, marginBottom: 12 }}>{data.explanation}</p>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                Based on <strong style={{ color: '#475569' }}>{data.sampleSize}</strong> historical posts in the database.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
