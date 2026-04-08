import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  recommendSocialPost,
  type MlGoal,
  type SocialFixedInputsRequest,
  type SocialRecommendResponse,
} from '../../lib/mlApi';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '28px 32px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
};

const metricBox = (accent: string): React.CSSProperties => ({
  background: `${accent}12`,
  borderRadius: 12,
  padding: '12px 14px',
  border: `1px solid ${accent}35`,
});

/** Ranked post ideas from the social recommendation service (same API as the admin dashboard widget). */
export default function SocialMediaSuggestPage() {
  const [goal, setGoal] = useState<MlGoal>('donations');
  const [contentTopic, setContentTopic] = useState('');
  const [platform, setPlatform] = useState('');
  const [postType, setPostType] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [topK, setTopK] = useState(3);
  const [hasCallToAction, setHasCallToAction] = useState<'any' | 'yes' | 'no'>('any');
  const [featuresResidentStory, setFeaturesResidentStory] = useState<'any' | 'yes' | 'no'>('any');

  const [result, setResult] = useState<SocialRecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const fixedInputs: SocialFixedInputsRequest = {};
    if (contentTopic.trim()) fixedInputs.contentTopic = contentTopic.trim();
    if (platform.trim()) fixedInputs.platform = platform.trim();
    if (postType.trim()) fixedInputs.postType = postType.trim();
    if (mediaType.trim()) fixedInputs.mediaType = mediaType.trim();
    if (hasCallToAction === 'yes') fixedInputs.hasCallToAction = true;
    if (hasCallToAction === 'no') fixedInputs.hasCallToAction = false;
    if (featuresResidentStory === 'yes') fixedInputs.featuresResidentStory = true;
    if (featuresResidentStory === 'no') fixedInputs.featuresResidentStory = false;

    const topKClamped = Math.min(50, Math.max(1, Math.floor(topK) || 3));

    try {
      const res = await recommendSocialPost({
        goal,
        topK: topKClamped,
        ...(Object.keys(fixedInputs).length > 0 ? { fixedInputs } : {}),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-4" style={{ background: 'var(--hw-bg-gray)', minHeight: '100%' }}>
      <div className="container-xl">
        <div className="mb-5 d-flex justify-content-between align-items-end flex-wrap gap-3">
          <div>
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
              Outreach &amp; Communication
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
              Recommended next posts
            </h1>
            <p className="text-muted mb-0" style={{ fontSize: 14, maxWidth: 640 }}>
              Get ranked post ideas based on past performance patterns. Choose your goal and optional constraints,
              then see suggested formats and topics—use results as a starting point, not a guarantee.
            </p>
          </div>
          <Link
            to="/admin/social-media"
            style={{
              background: '#fff',
              color: '#1E3A5F',
              textDecoration: 'none',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: 14,
              boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <i className="bi bi-clock-history fs-5" />
            Post history
          </Link>
        </div>

        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 className="h6 fw-bold mb-3" style={{ color: '#1E3A5F' }}>
            What to optimize for
          </h2>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label small fw-semibold text-muted">Goal</label>
                <select
                  className="form-select"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as MlGoal)}
                  disabled={loading}
                >
                  <option value="donations">Donations</option>
                  <option value="awareness">Awareness</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div className="col-md-4">
                <label
                  className="form-label small fw-semibold text-muted"
                  htmlFor="social-suggest-num-suggestions"
                >
                  Number of suggestions
                </label>
                <input
                  id="social-suggest-num-suggestions"
                  type="number"
                  min={1}
                  max={50}
                  className="form-control"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  disabled={loading}
                  aria-describedby="social-suggest-num-suggestions-hint"
                />
                <div id="social-suggest-num-suggestions-hint" className="form-text text-muted small">
                  Choose how many post ideas you want to see.
                </div>
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <button
                  type="submit"
                  className="btn w-100 fw-semibold text-white"
                  style={{ background: '#0D9488', border: 'none', padding: '10px 16px', borderRadius: 8 }}
                  disabled={loading}
                >
                  {loading ? 'Getting recommendations…' : 'Get recommendations'}
                </button>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Content topic (optional)</label>
                <input
                  className="form-control"
                  placeholder="e.g. Reintegration"
                  value={contentTopic}
                  onChange={(e) => setContentTopic(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Platform (optional)</label>
                <input
                  className="form-control"
                  placeholder="e.g. Instagram"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Post type (optional)</label>
                <input
                  className="form-control"
                  placeholder="e.g. ImpactStory"
                  value={postType}
                  onChange={(e) => setPostType(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Media type (optional)</label>
                <input
                  className="form-control"
                  placeholder="e.g. Video"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Call to action</label>
                <select
                  className="form-select"
                  value={hasCallToAction}
                  onChange={(e) => setHasCallToAction(e.target.value as 'any' | 'yes' | 'no')}
                  disabled={loading}
                >
                  <option value="any">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-muted">Features resident story</label>
                <select
                  className="form-select"
                  value={featuresResidentStory}
                  onChange={(e) => setFeaturesResidentStory(e.target.value as 'any' | 'yes' | 'no')}
                  disabled={loading}
                >
                  <option value="any">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8' }}>
            <div className="spinner-border text-secondary mb-3" role="status" aria-label="Loading">
              <span className="visually-hidden">Loading…</span>
            </div>
            <p className="fw-semibold fs-6 mb-0">Loading suggestions…</p>
          </div>
        )}

        {error && (
          <div
            style={{
              borderRadius: 12,
              padding: '14px 18px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {result && !loading && (
          <div style={cardStyle}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
              <h2 className="h6 fw-bold mb-0" style={{ color: '#1E3A5F' }}>
                Top {result.recommendations.length} recommendation
                {result.recommendations.length !== 1 ? 's' : ''}
              </h2>
              <span className="small text-muted">
                Goal: <strong>{result.goal}</strong> · {result.topK} suggestion{result.topK !== 1 ? 's' : ''} requested
              </span>
            </div>

            {result.recommendations.length === 0 ? (
              <p className="text-muted mb-0">No suggestions matched. Try different constraints or number of suggestions.</p>
            ) : (
              <div className="d-flex flex-column gap-4">
                {result.recommendations.map((rec, idx) => (
                  <div
                    key={`${rec.platform}-${rec.postType}-${idx}`}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: 20,
                      background: '#FAFAFA',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span
                        className="badge rounded-pill"
                        style={{ background: '#1E3A5F', color: '#fff', fontSize: 12 }}
                      >
                        #{idx + 1}
                      </span>
                      <span className="fw-bold" style={{ color: '#1E3A5F', fontSize: 18 }}>
                        {rec.platform}
                      </span>
                      <span className="text-muted">· {rec.postType}</span>
                      <span className="text-muted">· {rec.mediaType}</span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <div style={metricBox('#0D9488')}>
                        <div className="small text-muted text-uppercase fw-bold mb-1">Post hour</div>
                        <div className="fw-bold" style={{ color: '#0F766E' }}>
                          {rec.postHour}:00
                        </div>
                      </div>
                      <div style={metricBox('#6B21A8')}>
                        <div className="small text-muted text-uppercase fw-bold mb-1">Topic</div>
                        <div className="fw-bold" style={{ color: '#5B21B6' }}>
                          {rec.contentTopic || '—'}
                        </div>
                      </div>
                      <div style={metricBox('#1D4ED8')}>
                        <div className="small text-muted text-uppercase fw-bold mb-1">Est. engagement</div>
                        <div className="fw-bold tabular-nums" style={{ color: '#1E40AF' }}>
                          {(rec.predictedEngagementRate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={metricBox('#D97706')}>
                        <div className="small text-muted text-uppercase fw-bold mb-1">Est. gift-link rate</div>
                        <div className="fw-bold tabular-nums" style={{ color: '#B45309' }}>
                          {(rec.predictedPAnyReferral * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div style={metricBox('#059669')}>
                        <div className="small text-muted text-uppercase fw-bold mb-1">Est. referrals</div>
                        <div className="fw-bold tabular-nums" style={{ color: '#047857' }}>
                          {rec.predictedReferralsCount != null
                            ? Number(rec.predictedReferralsCount).toFixed(1)
                            : '—'}
                        </div>
                      </div>
                      <div style={{ ...metricBox('#64748B'), opacity: 0.92 }}>
                        <div className="small text-muted text-uppercase fw-bold mb-1" style={{ fontSize: 10 }}>
                          Sort score
                        </div>
                        <div className="tabular-nums" style={{ color: '#64748B', fontSize: 14, fontWeight: 600 }}>
                          {Number(rec.rankingScore).toFixed(3)}
                        </div>
                      </div>
                    </div>

                    <p className="small text-muted mb-2">
                      CTA: <strong>{rec.hasCallToAction ? 'Yes' : 'No'}</strong>
                      {rec.callToActionType ? ` (${rec.callToActionType})` : ''} · Resident story:{' '}
                      <strong>{rec.featuresResidentStory ? 'Yes' : 'No'}</strong>
                    </p>
                    <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, margin: 0 }}>{rec.whyRecommended}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
