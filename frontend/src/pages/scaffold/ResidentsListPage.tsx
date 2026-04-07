import PagedTable from '../../components/scaffold/PagedTable';

export default function ResidentsListPage() {
  return <PagedTable endpoint="/api/residents" heading="CASE-1 — Caseload Inventory" />;
}
