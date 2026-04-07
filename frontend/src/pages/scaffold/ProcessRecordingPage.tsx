import { useParams } from 'react-router-dom';
import PagedTable from '../../components/scaffold/PagedTable';

export default function ProcessRecordingPage() {
  const { id } = useParams();
  const endpoint = id
    ? `/api/process-recordings?residentId=${id}`
    : '/api/process-recordings';
  return (
    <PagedTable
      endpoint={endpoint}
      heading={`CASE-2 — Process Recordings${id ? ` (resident ${id})` : ''} (scaffold)`}
    />
  );
}
