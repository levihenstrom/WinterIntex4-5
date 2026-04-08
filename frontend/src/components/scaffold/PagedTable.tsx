import { useEffect, useState } from 'react';
import DeleteConfirmModal from '../DeleteConfirmModal';
import { deleteJson, fetchPaged, type PagedResult } from '../../lib/apiClient';
import { formatPhpAndUsd } from '../../lib/currency';
import { useAuth } from '../../context/AuthContext';

interface PagedTableProps {
  /** API path like "/api/donations" — page + pageSize are appended automatically. */
  endpoint: string;
  /** Heading to show above the table — e.g. "DON-1 — Supporter list (scaffold)". */
  heading: string;
  /** Rows per page. Defaults to 20. */
  pageSize?: number;
  /** Enables per-row delete action using DELETE `${endpoint}/{id}`. */
  allowDelete?: boolean;
}

/**
 * Minimal paged table for scaffold pages. Hits a `.NET PagedResult<T>` endpoint
 * and renders each item as a JSON row. No filters, no sorting, no styling —
 * the individual page cards own the real UX.
 */
export default function PagedTable({
  endpoint,
  heading,
  pageSize = 20,
  allowDelete = false,
}: PagedTableProps) {
  const { authSession } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedResult<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
  }, [endpoint, page, pageSize, reloadToken]);

  const columns = data && data.items.length > 0 ? Object.keys(data.items[0]) : [];
  const isAdmin = authSession.roles.includes('Admin');
  const isStaff = authSession.roles.includes('Staff');
  const canDelete = allowDelete && (isAdmin || isStaff);
  const deleteBaseEndpoint = endpoint.split('?')[0];

  async function confirmDelete() {
    if (!deleteTarget) return;

    const idField = inferIdField(deleteTarget);
    const idValue = idField ? deleteTarget[idField] : null;
    if (!idField || idValue === null || idValue === undefined || idValue === '') {
      setError('Unable to delete this row because no id field was found.');
      setDeleteTarget(null);
      return;
    }

    try {
      setDeleteBusy(true);
      setError(null);
      await deleteJson(`${deleteBaseEndpoint}/${idValue}`);
      setDeleteTarget(null);
      setReloadToken((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete this row.');
    } finally {
      setDeleteBusy(false);
    }
  }

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
                    {canDelete && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatCell(c, row[c])}
                        </td>
                      ))}
                      {canDelete && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setDeleteTarget(row)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
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

      <DeleteConfirmModal
        show={deleteTarget !== null}
        itemLabel={deleteTarget ? describeRow(deleteTarget) : 'this item'}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteBusy) void confirmDelete();
        }}
      />
    </section>
  );
}

const MONETARY_COLUMN_KEYS = new Set(['amount', 'amountAllocated']);

function formatCell(columnKey: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (MONETARY_COLUMN_KEYS.has(columnKey)) {
    if (typeof value === 'number' && !Number.isNaN(value)) return formatPhpAndUsd(value);
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      if (!Number.isNaN(n)) return formatPhpAndUsd(n);
    }
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function inferIdField(row: Record<string, unknown>): string | null {
  const exactPriority = [
    'supporterId',
    'donationId',
    'allocationId',
    'residentId',
    'recordingId',
    'visitationId',
    'planId',
    'postId',
  ];

  for (const key of exactPriority) {
    if (key in row) return key;
  }

  const generic = Object.keys(row).find((key) => /id$/i.test(key));
  return generic ?? null;
}

function describeRow(row: Record<string, unknown>): string {
  const labelFields = [
    'displayName',
    'organizationName',
    'firstName',
    'lastName',
    'caseControlNo',
    'internalCode',
    'campaignName',
    'platformPostId',
  ];

  for (const key of labelFields) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }

  const idField = inferIdField(row);
  if (idField) return `${idField}: ${formatCell(idField, row[idField])}`;
  return 'this item';
}
