import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Scaffold layout for /donor/*. Real donor portal design is DON-4's job.
 */
export default function DonorLayout() {
  const { authSession } = useAuth();
  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="bg-primary text-white p-3">
        <div className="container d-flex justify-content-between align-items-center">
          <strong>HealingWings — Donor Portal (scaffold)</strong>
          <span className="small">{authSession.email}</span>
        </div>
      </header>
      <nav className="bg-light border-bottom">
        <div className="container">
          <ul className="nav nav-tabs border-0 pt-2">
            <li className="nav-item">
              <NavLink
                to="/donor/dashboard"
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                My Dashboard
              </NavLink>
            </li>
            <li className="nav-item ms-auto">
              <NavLink to="/logout" className="nav-link">Logout</NavLink>
            </li>
          </ul>
        </div>
      </nav>
      <main className="flex-grow-1">
        <Outlet />
      </main>
    </div>
  );
}
