import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/hw/NavBar';
import AdminSectionTabs, { type AdminSectionTabItem } from '../components/admin/AdminSectionTabs';

const sectionTabs: Record<'donations' | 'residents' | 'socialMedia' | 'reports', AdminSectionTabItem[]> = {
  donations: [
    { to: '/admin/donations', label: 'Supporters', end: true, icon: 'bi-people' },
    { to: '/admin/donations/contributions', label: 'Donations', end: false, icon: 'bi-heart' },
    { to: '/admin/donations/allocations', label: 'Allocations', end: false, icon: 'bi-diagram-3' },
  ],
  residents: [
    { to: '/admin/residents', label: 'Residents', end: true, icon: 'bi-person-lines-fill' },
    { to: '/admin/residents/process-recordings', label: 'Session notes', end: false, icon: 'bi-journal-text' },
    { to: '/admin/residents/visits-conferences', label: 'Visits & conferences', end: false, icon: 'bi-calendar-event' },
  ],
  socialMedia: [
    { to: '/admin/social-media', label: 'History', end: true, icon: 'bi-clock-history' },
    { to: '/admin/social-media/suggest', label: 'Suggest Next Post', end: false, icon: 'bi-lightbulb' },
  ],
  reports: [],
};

function getSectionKey(pathname: string): keyof typeof sectionTabs | null {
  if (pathname.startsWith('/admin/donations')) return 'donations';
  if (pathname.startsWith('/admin/residents')) return 'residents';
  if (pathname.startsWith('/admin/social-media')) return 'socialMedia';
  if (pathname.startsWith('/admin/reports')) return 'reports';
  return null;
}

export default function AdminLayout() {
  const { authSession } = useAuth();
  const location = useLocation();
  const activeSection = getSectionKey(location.pathname);
  const tabs = activeSection ? sectionTabs[activeSection] : [];

  return (
    <div className="d-flex flex-column min-vh-100">
      <NavBar />
      <div className="hw-auth-page-content flex-grow-1">
        <AdminSectionTabs tabs={tabs} />
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
