import { useEffect, useState } from 'react';
import { fetchPaged, type PagedResult } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

interface PagedTableProps {
  /** API path like "/api/donations" — page + pageSize are appended automatically. */
  endpoint: string;
  /** Heading to show above the table — e.g. "DON-1 — Supporter list (scaffold)". */
  heading: string;
  /** Rows per page. Defaults to 20. */
  pageSize?: number;
}

/**
 * Minimal paged table for scaffold pages. Hits a `.NET PagedResult<T>` endpoint
 * and renders each item as a JSON row. No filters, no sorting, no styling —
 * the individual page cards own the real UX.
 */
export default function PagedTable({ endpoint, heading, pageSize = 20 }: PagedTableProps) {
  const { authSession } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPaged<Record<string, unknown>>(endpoint, page, pageSize)
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
  }, [endpoint, page, pageSize]);

  const columns = data && data.items.length > 0 ? Object.keys(data.items[0]) : [];
  const isAdmin = authSession.roles.includes('Admin');
  const isStaff = authSession.roles.includes('Staff');

  return (
    <section className="container my-4">
      <h2>{heading}</h2>
      <p className="text-muted small">
        Endpoint: <code>{endpoint}</code>
      </p>

      {loading && <div>Loading…</div>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {data && !error && (
        <>
          <div className="mb-2 small text-muted">
            {data.totalCount} total &middot; page {data.page} of {data.totalPages || 1}
          </div>
          {data.items.length === 0 ? (
            <p>
              <em>
                {isAdmin
                  ? 'No rows returned. This usually means the current app database has no data for this entity yet.'
                  : isStaff
                    ? 'No rows returned. Your partner scope may not include this data.'
                    : 'No rows returned.'}
              </em>
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-bordered">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="d-flex gap-2 align-items-center">
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
              disabled={loading || (data.totalPages > 0 && page >= data.totalPages)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
            <span className="small text-muted">Page {page}</span>
          </div>
        </>
      )}
    </section>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
