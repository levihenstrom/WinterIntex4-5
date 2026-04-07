import { useParams } from 'react-router-dom';
import PagedTable from '../../components/scaffold/PagedTable';

export default function VisitsPage() {
  const { id } = useParams();
  const endpoint = id
    ? `/api/home-visitations?residentId=${id}`
    : '/api/home-visitations';
  return (
    <PagedTable
      endpoint={endpoint}
      heading={`CASE-3 — Home Visitations${id ? ` (resident ${id})` : ''}`}
      allowDelete
    />
  );
}
