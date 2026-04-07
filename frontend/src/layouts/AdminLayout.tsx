import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { to: '/admin/home', label: 'Home' },
  { to: '/admin/donations', label: 'Donations' },
  { to: '/admin/residents', label: 'Residents' },
  { to: '/admin/social-media', label: 'Social Media' },
  { to: '/admin/reports/donations', label: 'Reports' },
];

/**
 * Scaffold layout for /admin/*. Plain tab strip, no design.
 * Real admin shell design is the responsibility of ADM-1 and the individual
 * page cards; SCAF-1 only needs the navigation and routing to work.
 */
export default function AdminLayout() {
  const { authSession } = useAuth();
  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="bg-dark text-white p-3">
        <div className="container d-flex justify-content-between align-items-center">
          <strong>HealingWings — Admin Portal (scaffold)</strong>
          <span className="small">
            {authSession.email} · roles: {authSession.roles.join(', ') || 'none'}
          </span>
        </div>
      </header>
      <nav className="bg-light border-bottom">
        <div className="container">
          <ul className="nav nav-tabs border-0 pt-2">
            {tabs.map((tab) => (
              <li key={tab.to} className="nav-item">
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    'nav-link' + (isActive ? ' active' : '')
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
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
