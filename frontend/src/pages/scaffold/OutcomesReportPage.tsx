import { NavLink } from 'react-router-dom';
import PagedTable from '../../components/scaffold/PagedTable';

export default function OutcomesReportPage() {
  return (
    <div>
      <div className="container mt-3">
        <ul className="nav nav-pills">
          <li className="nav-item">
            <NavLink to="/admin/reports/donations" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              REP-1 Donation trends
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/admin/reports/outcomes" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              REP-2 Resident outcomes
            </NavLink>
          </li>
        </ul>
      </div>
      <PagedTable endpoint="/api/residents" heading="REP-2 — Resident outcomes (scaffold)" />
    </div>
  );
}
