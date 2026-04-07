import PagedTable from '../../components/scaffold/PagedTable';

export default function ContributionsPage() {
  return <PagedTable endpoint="/api/donations" heading="DON-2 — Donations" allowDelete />;
}
