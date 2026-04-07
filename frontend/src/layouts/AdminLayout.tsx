import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/hw/NavBar';

const sectionTabs = {
  donations: [
    { to: '/admin/donations', label: 'Supporters', end: true },
    { to: '/admin/donations/contributions', label: 'Donations', end: false },
    { to: '/admin/donations/allocations', label: 'Allocations', end: false },
  ],
  residents: [
    { to: '/admin/residents', label: 'Caseload Inventory', end: true },
    { to: '/admin/residents/process-recordings', label: 'Process Recordings', end: false },
    { to: '/admin/residents/visits-conferences', label: 'Home Visits & Conferences', end: false },
  ],
  socialMedia: [
    { to: '/admin/social-media', label: 'History', end: true },
    { to: '/admin/social-media/suggest', label: 'Suggest Next Post', end: false },
  ],
  reports: [
    { to: '/admin/reports/donations', label: 'Donation Trends', end: true },
    { to: '/admin/reports/outcomes', label: 'Resident Outcomes', end: false },
  ],
} as const;

function getSectionKey(pathname: string): keyof typeof sectionTabs | null {
  if (pathname.startsWith('/admin/donations')) return 'donations';
  if (pathname.startsWith('/admin/residents')) return 'residents';
  if (pathname.startsWith('/admin/social-media')) return 'socialMedia';
  if (pathname.startsWith('/admin/reports')) return 'reports';
  return null;
}

/**
 * Scaffold layout for /admin/*. Plain tab strip, no design.
 * Real admin shell design is the responsibility of ADM-1 and the individual
 * page cards; SCAF-1 only needs the navigation and routing to work.
 */
export default function AdminLayout() {
  const { authSession } = useAuth();
  const location = useLocation();
  const activeSection = getSectionKey(location.pathname);
  const tabs = activeSection ? sectionTabs[activeSection] : [];

  return (
    <div className="d-flex flex-column min-vh-100">
      <NavBar />
      <div className="hw-auth-page-content flex-grow-1">
        {tabs.length > 0 ? (
          <nav className="bg-light border-bottom">
            <div className="container">
              <ul className="nav nav-tabs border-0 pt-2">
                {tabs.map((tab) => (
                  <li key={tab.to} className="nav-item">
                    <NavLink
                      to={tab.to}
                      end={tab.end}
                      className={({ isActive }) =>
                        'nav-link' + (isActive ? ' active' : '')
                      }
                    >
                      {tab.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        ) : null}
        <main className="flex-grow-1">
          <Outlet />
        </main>
        <footer
          className="text-center py-3 mt-auto text-white-50 small"
          style={{ background: 'var(--hw-navy)' }}
        >
          <div className="container">
            Signed in as {authSession.email}
          </div>
        </footer>
      </div>
    </div>
  );
}
