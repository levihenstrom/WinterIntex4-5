import { useAuth } from '../../context/AuthContext';

/**
 * ADM-1 scaffold — command-center home tab. Per plan, this page is intentionally
 * empty: ADM-1's real implementation will compose widgets pulled from other pages.
 */
export default function AdminHomePage() {
  const { authSession } = useAuth();
  return (
    <section className="container my-4">
      <h1>Admin Home</h1>
      <p className="text-muted">ADM-1 — command center (scaffold — intentionally empty)</p>
      <div className="alert alert-secondary">
        Signed in as <strong>{authSession.email}</strong>
        <br />
        Roles: {authSession.roles.join(', ') || '(none)'}
      </div>
      <p className="small text-muted">
        The real dashboard will be assembled from pieces of Donations / Residents /
        Reports cards once those are built out.
      </p>
    </section>
  );
}
