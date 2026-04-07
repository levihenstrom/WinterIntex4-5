import { Link } from 'react-router-dom';
import PagedTable from '../../components/scaffold/PagedTable';

export default function SocialMediaHistoryPage() {
  return (
    <div>
      <div className="container mt-3 d-flex justify-content-end">
        <Link to="/admin/social-media/suggest" className="btn btn-sm btn-outline-primary">
          Suggest next post →
        </Link>
      </div>
      <PagedTable endpoint="/api/social-media-posts" heading="SOC-1 — Post history (scaffold)" allowDelete />
    </div>
  );
}
