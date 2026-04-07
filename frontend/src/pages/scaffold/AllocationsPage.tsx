import PagedTable from '../../components/scaffold/PagedTable';

export default function AllocationsPage() {
  return <PagedTable endpoint="/api/donation-allocations" heading="DON-3 — Donation allocations (scaffold)" />;
}
