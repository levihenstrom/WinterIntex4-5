import PagedTable from '../../components/scaffold/PagedTable';

export default function OutcomesReportPage() {
  return <PagedTable endpoint="/api/residents" heading="REP-2 — Resident Outcomes" />;
}
