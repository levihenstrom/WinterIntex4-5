import { useState, useEffect } from 'react';
import { fetchJson, postJson, deleteJson } from '../../lib/apiClient';

interface PendingVolunteer {
  supporterId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  organizationName: string | null;
  relationshipType: string | null;
  region: string | null;
  country: string | null;
  acquisitionChannel: string | null;
  createdAt: string | null;
}

export default function VolunteerSubmissionsPage() {
  const [volunteers, setVolunteers] = useState<PendingVolunteer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [actionId, setActionId]     = useState<number | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PendingVolunteer[]>('/api/supporters/pending-volunteers');
      setVolunteers(data);
    } catch {
      setError('Failed to load pending volunteer applications.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function approve(id: number) {
    setActionId(id);
    try {
      await postJson(`/api/supporters/${id}/approve-volunteer`, {});
      setVolunteers(v => v.filter(x => x.supporterId !== id));
      showToast('Volunteer approved and added to supporters ✓', true);
    } catch (e: any) {
      showToast(e.message ?? 'Error approving volunteer.', false);
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: number) {
    if (!confirm('Reject and delete this application? This cannot be undone.')) return;
    setActionId(id);
    try {
      await deleteJson(`/api/supporters/${id}/reject-volunteer`);
      setVolunteers(v => v.filter(x => x.supporterId !== id));
      showToast('Application rejected and removed.', true);
    } catch (e: any) {
      showToast(e.message ?? 'Error rejecting application.', false);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', background: '#f8f9fb' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999,
          background: toast.ok ? '#065F46' : '#991B1B',
          color: 'white', borderRadius: 12, padding: '12px 20px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className={`bi ${toast.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 2, color: '#0D9488' }}>ADMINISTRATION</p>
          <h1 style={{ margin: '4px 0 6px', fontSize: '1.9rem', fontWeight: 800,
            color: '#1E3A5F', fontFamily: 'Poppins, sans-serif' }}>
            Volunteer Submissions
          </h1>
          <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
            Review pending volunteer applications. Approve to add them as active supporters, or reject to remove.
          </p>
        </div>
        <button onClick={load} style={{
          background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>

      {/* Badge count */}
      {!loading && !error && (
        <div style={{ marginBottom: '1.25rem' }}>
          <span style={{
            background: volunteers.length > 0 ? '#FEF3C7' : '#D1FAE5',
            color: volunteers.length > 0 ? '#92400E' : '#065F46',
            borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 700,
          }}>
            {volunteers.length === 0
              ? '✓ No pending submissions'
              : `${volunteers.length} pending ${volunteers.length === 1 ? 'application' : 'applications'}`}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
        <div className="card-body" style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9CA3AF' }}>
              <div className="spinner-border spinner-border-sm me-2" role="status" />
              Loading applications...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#DC2626' }}>
              <i className="bi bi-exclamation-triangle-fill me-2" />
              {error}
              <br />
              <button onClick={load} style={{
                marginTop: 12, background: '#1E3A5F', color: 'white',
                border: 'none', borderRadius: 8, padding: '8px 20px',
                cursor: 'pointer', fontSize: 13,
              }}>Retry</button>
            </div>
          ) : volunteers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9CA3AF' }}>
              <i className="bi bi-person-check" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, opacity: 0.4 }} />
              No pending volunteer applications right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {volunteers.map(v => {
                const busy = actionId === v.supporterId;
                return (
                  <div key={v.supporterId} style={{
                    border: '1px solid #E5E7EB', borderRadius: 14, padding: '1.25rem 1.5rem',
                    background: 'white', display: 'flex', flexWrap: 'wrap',
                    justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
                  }}>
                    {/* Info */}
                    <div style={{ flex: '1 1 300px' }}>
                      {/* Name + date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: '#EDE9FE', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0,
                        }}>
                          <i className="bi bi-person-fill" style={{ color: '#6B21A8', fontSize: 16 }} />
                        </span>
                        <div>
                          <p style={{ margin: 0, fontWeight: 800, color: '#1E3A5F', fontSize: 15 }}>
                            {v.firstName} {v.lastName}
                          </p>
                          {v.createdAt && (
                            <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
                              Submitted {new Date(v.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 16px' }}>
                        {v.email && <Detail icon="bi-envelope" label="Email" value={v.email} />}
                        {v.phone && <Detail icon="bi-telephone" label="Phone" value={v.phone} />}
                        {v.country && <Detail icon="bi-globe" label="Country" value={[v.region, v.country].filter(Boolean).join(', ')} />}
                        {v.organizationName && <Detail icon="bi-building" label="Organization" value={v.organizationName} />}
                        {v.relationshipType && <Detail icon="bi-people" label="Relationship" value={v.relationshipType} />}
                        {v.acquisitionChannel && <Detail icon="bi-megaphone" label="Found us via" value={v.acquisitionChannel} />}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignSelf: 'center' }}>
                      <button
                        onClick={() => approve(v.supporterId)}
                        disabled={busy}
                        style={{
                          background: '#0D9488', color: 'white', border: 'none',
                          borderRadius: 10, padding: '9px 20px', fontSize: 13,
                          fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-check2-circle" />}
                        Approve
                      </button>
                      <button
                        onClick={() => reject(v.supporterId)}
                        disabled={busy}
                        style={{
                          background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA',
                          borderRadius: 10, padding: '9px 20px', fontSize: 13,
                          fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        <i className="bi bi-x-circle" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <i className={`bi ${icon}`} style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2, flexShrink: 0 }} />
      <div>
        <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 500 }}>{value}</p>
      </div>
    </div>
  );
}
