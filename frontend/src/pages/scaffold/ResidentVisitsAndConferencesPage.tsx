import PagedTable from '../../components/scaffold/PagedTable';

export default function ResidentVisitsAndConferencesPage() {
  return (
    <>
      <PagedTable endpoint="/api/home-visitations" heading="CASE-3A — Home Visitations" />
      <PagedTable endpoint="/api/case-conferences" heading="CASE-3B — Case Conferences" />
    </>
  );
}
