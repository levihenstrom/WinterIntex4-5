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

/**
 * SOC-1 sub-page scaffold — next-post suggestion.
 * Calls /api/social-media-suggestions/next-post, which currently returns a
 * simple heuristic over historical engagement. ML-3 will replace the scoring
 * later without changing the response shape.
 */
export default function SocialMediaSuggestPage() {
  const [data, setData] = useState<NextPostSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson<NextPostSuggestion>('/api/social-media-suggestions/next-post')
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="container my-4">
      <div className="d-flex justify-content-between align-items-center">
        <h2>Suggest Next Post</h2>
        <Link to="/admin/social-media" className="btn btn-sm btn-outline-secondary">
          ← Back to history
        </Link>
      </div>
      <p className="text-muted">SOC-1 sub-page — ML-3 powered recommendation (scaffold)</p>

      {loading && <div>Loading recommendation…</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <div className="card p-4 mt-3">
          <div className="row">
            <div className="col-md-3">
              <div className="small text-muted">Recommended platform</div>
              <div className="h4">{data.platform ?? '—'}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Post type</div>
              <div className="h4">{data.postType ?? '—'}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Day of week</div>
              <div className="h4">{data.dayOfWeek ?? '—'}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Hour (24h)</div>
              <div className="h4">{data.postHour != null ? `${data.postHour}:00` : '—'}</div>
            </div>
          </div>
          <hr />
          <p className="small mb-1">{data.explanation}</p>
          <p className="small text-muted mb-0">Based on {data.sampleSize} historical posts.</p>
        </div>
      )}
    </section>
  );
}
