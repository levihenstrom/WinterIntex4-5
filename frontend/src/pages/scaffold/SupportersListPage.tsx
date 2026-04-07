import PagedTable from '../../components/scaffold/PagedTable';

export default function SupportersListPage() {
  return <PagedTable endpoint="/api/supporters" heading="DON-1 — Supporters (scaffold)" />;
}
