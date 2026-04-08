import { useState, useEffect, useMemo } from 'react';
import { fetchJson, postJson } from '../../lib/apiClient';

interface UserRecord {
  email: string;
  roles: string[];
}

const ROLE_OPTIONS = ['Admin', 'Staff', 'Donor'];

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  Admin:          { bg: '#EDE9FE', color: '#6B21A8' },
  Staff:          { bg: '#DBEAFE', color: '#1D4ED8' },
  Donor:          { bg: '#D1FAE5', color: '#065F46' },
  LegacyCustomer: { bg: '#FEF3C7', color: '#92400E' },
};

export default function UserManagerPage() {
  const [users, setUsers]           = useState<UserRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<UserRecord[]>('/api/auth/users');
      setUsers(data);
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? users.filter(u => u.email?.toLowerCase().includes(q)) : users;
  }, [users, search]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAssign(email: string) {
    const role = pendingRole[email];
    if (!role) return;
    setSaving(email);
    try {
      await postJson('/api/auth/assign-role', { email, role });
      setUsers(prev =>
        prev.map(u => u.email === email ? { ...u, roles: [role] } : u)
      );
      setPendingRole(prev => { const n = { ...prev }; delete n[email]; return n; });
      showToast(`Rol actualizado a "${role}" para ${email}`, true);
    } catch {
      showToast('Error al actualizar el rol.', false);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', background: '#f8f9fb' }}>

      {/* Toast notification */}
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

      {/* Page header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#0D9488' }}>
          ADMINISTRATION
        </p>
        <h1 style={{ margin: '4px 0 6px', fontSize: '1.9rem', fontWeight: 800, color: '#1E3A5F', fontFamily: 'Poppins, sans-serif' }}>
          User Manager
        </h1>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
          Manage the roles of all registered users. Only administrators can change roles.
        </p>
      </div>

      {/* Main card */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
        <div className="card-body" style={{ padding: '1.5rem' }}>

          {/* Search bar + controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <i className="bi bi-search" style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: '#9CA3AF', fontSize: 14, pointerEvents: 'none',
              }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search by email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14 }}
              />
            </div>

            <span style={{ color: '#6B7280', fontSize: 13, whiteSpace: 'nowrap' }}>
              <i className="bi bi-people me-1" />
              {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
            </span>

            <button
              onClick={loadUsers}
              style={{
                background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '6px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className="bi bi-arrow-clockwise" />
              Actualizar
            </button>
          </div>

          {/* Role legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {ROLE_OPTIONS.map(r => {
              const s = ROLE_STYLE[r] ?? { bg: '#F3F4F6', color: '#374151' };
              return (
                <span key={r} style={{
                  background: s.bg, color: s.color, borderRadius: 20,
                  padding: '2px 12px', fontSize: 12, fontWeight: 700,
                }}>
                  {r}
                </span>
              );
            })}
          </div>

          {/* Content states */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9CA3AF' }}>
              <div className="spinner-border spinner-border-sm me-2" role="status" />
              Loading users...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#DC2626' }}>
              <i className="bi bi-exclamation-triangle-fill me-2" />
              {error}
              <br />
              <button
                onClick={loadUsers}
                style={{ marginTop: 12, background: '#1E3A5F', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9CA3AF' }}>
              <i className="bi bi-people" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, opacity: 0.4 }} />
              {search ? 'No se encontraron usuarios con ese correo.' : 'No hay usuarios registrados.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                    <th style={{ fontWeight: 700, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, padding: '10px 16px', background: 'transparent', border: 'none' }}>
                      Email
                    </th>
                    <th style={{ fontWeight: 700, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, padding: '10px 16px', background: 'transparent', border: 'none' }}>
                      Current Role
                    </th>
                    <th style={{ fontWeight: 700, color: '#6B7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, padding: '10px 16px', background: 'transparent', border: 'none', width: 300 }}>
                      Change Role
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => {
                    const currentRole = user.roles[0] ?? 'Sin rol';
                    const roleStyle   = ROLE_STYLE[currentRole] ?? { bg: '#F3F4F6', color: '#374151' };
                    const selected    = pendingRole[user.email] ?? '';
                    const isSaving    = saving === user.email;

                    return (
                      <tr key={user.email} style={{ borderBottom: '1px solid #f9f9f9' }}>

                        {/* Email */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              width: 34, height: 34, borderRadius: '50%',
                              background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <i className="bi bi-person-fill" style={{ color: '#6B21A8', fontSize: 15 }} />
                            </span>
                            <span style={{ color: '#1E3A5F', fontWeight: 500 }}>{user.email}</span>
                          </div>
                        </td>

                        {/* Current role badge */}
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{
                            background: roleStyle.bg,
                            color: roleStyle.color,
                            borderRadius: 20,
                            padding: '4px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            {currentRole}
                          </span>
                        </td>

                        {/* Role selector + apply */}
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select
                              className="form-select form-select-sm"
                              value={selected}
                              onChange={e => setPendingRole(prev => ({ ...prev, [user.email]: e.target.value }))}
                              disabled={isSaving}
                              style={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, maxWidth: 150, color: selected ? '#1E3A5F' : '#9CA3AF' }}
                            >
                              <option value="">Seleccionar...</option>
                              {ROLE_OPTIONS.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleAssign(user.email)}
                              disabled={!selected || isSaving}
                              style={{
                                background: selected && !isSaving ? '#0D9488' : '#E5E7EB',
                                color: selected && !isSaving ? 'white' : '#9CA3AF',
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 16px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: selected && !isSaving ? 'pointer' : 'not-allowed',
                                transition: 'background 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isSaving ? (
                                <>
                                  <span className="spinner-border spinner-border-sm" role="status" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-check2" />
                                  Apply
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
