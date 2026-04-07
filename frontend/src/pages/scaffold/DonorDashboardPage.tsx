import PagedTable from '../../components/scaffold/PagedTable';

/**
 * DON-4 scaffold — authenticated donor sees their own donation history.
 * Hits /api/donations/mine, which is scoped by a "supporterId" claim on the
 * Identity user. The donor seed user (donor@intex.local) is pre-linked to
 * supporter #1.
 */
export default function DonorDashboardPage() {
  return (
    <div className="container my-4">
      <h1>My Donations</h1>
      <p className="text-muted">DON-4 — donor self-service dashboard (scaffold)</p>
      <PagedTable endpoint="/api/donations/mine" heading="My donation history" />
    </div>
  );
}
