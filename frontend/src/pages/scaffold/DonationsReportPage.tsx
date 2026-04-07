import PagedTable from '../../components/scaffold/PagedTable';

export default function DonationsReportPage() {
  return <PagedTable endpoint="/api/donations" heading="REP-1 — Donation Trends" />;
}
