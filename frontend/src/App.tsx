import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CookieConsentProvider } from './context/CookieConsentContext';
import CookieConsentBanner from './components/CookieConsentBanner';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LogoutPage from './pages/LogoutPage';
import ManageMFAPage from './pages/ManageMFAPage';
import PrivacyPage from './pages/PrivacyPage';
import HealingWingsHome from './pages/HealingWingsHome';
import NavBar from './components/hw/NavBar';
import RequireAuth from './components/RequireAuth';

// Scaffold layouts + pages (SCAF-1)
import AdminLayout from './layouts/AdminLayout';
import DonorLayout from './layouts/DonorLayout';
import ImpactPage from './pages/scaffold/ImpactPage';
import VolunteerPage from './pages/VolunteerPage';
import StoriesPage from './pages/StoriesPage';
import DonorDashboardPage from './pages/scaffold/DonorDashboardPage';
import AdminHomePage from './pages/scaffold/AdminHomePage';
import SupportersListPage from './pages/scaffold/SupportersListPage';
import ContributionsPage from './pages/scaffold/ContributionsPage';
import AllocationsPage from './pages/scaffold/AllocationsPage';
import ResidentsListPage from './pages/scaffold/ResidentsListPage';
import ProcessRecordingPage from './pages/scaffold/ProcessRecordingPage';
import VisitsPage from './pages/scaffold/VisitsPage';
import ResidentVisitsAndConferencesPage from './pages/scaffold/ResidentVisitsAndConferencesPage';
import SocialMediaHistoryPage from './pages/scaffold/SocialMediaHistoryPage';
import SocialMediaSuggestPage from './pages/scaffold/SocialMediaSuggestPage';
import ReportsAnalyticsPage from './pages/scaffold/ReportsAnalyticsPage';
import UserManagerPage from './pages/scaffold/UserManagerPage';
import VolunteerSubmissionsPage from './pages/scaffold/VolunteerSubmissionsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

// Auth pages — same fixed NavBar as the landing page (see NavBar.tsx)
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <NavBar />
      <div className="hw-auth-page-content flex-grow-1">{children}</div>
      <footer
        className="text-center py-3 mt-auto text-white-50 small"
        style={{ background: 'var(--hw-navy)' }}
      >
        <div className="container">
          <Link
            className="text-decoration-none"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            to="/privacy"
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Wait for the page to render, then scroll to the anchor
      const id = hash.replace('#', '');
      const attempt = (tries: number) => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else if (tries > 0) {
          setTimeout(() => attempt(tries - 1), 80);
        }
      };
      attempt(10);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

function RouteTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const titleByPathPrefix: Array<[string, string]> = [
      ['/admin/donations/contributions', 'Contributions'],
      ['/admin/donations/allocations', 'Allocations'],
      ['/admin/donations', 'Supporters'],
      ['/admin/residents/visits-conferences', 'Visits & Conferences'],
      ['/admin/residents/process-recordings', 'Session Notes'],
      ['/admin/residents/', 'Resident Detail'],
      ['/admin/residents', 'Residents'],
      ['/admin/social-media/suggest', 'Social Media Suggestions'],
      ['/admin/social-media', 'Social Media History'],
      ['/admin/reports', 'Reports & Analytics'],
      ['/admin/user-manager', 'User Manager'],
      ['/admin/home', 'Admin Home'],
      ['/admin', 'Admin'],
      ['/donor/dashboard', 'Donor Dashboard'],
      ['/donor', 'Donor Dashboard'],
      ['/volunteer', 'Volunteer'],
      ['/stories', 'Stories'],
      ['/impact', 'Impact'],
      ['/privacy', 'Privacy Policy'],
      ['/mfa', 'Manage MFA'],
      ['/logout', 'Logout'],
      ['/register', 'Register'],
      ['/login', 'Login'],
      ['/unauthorized', 'Unauthorized'],
      ['/oauth/callback', 'OAuth Callback'],
      ['/', 'Home'],
    ];

    const pageName =
      titleByPathPrefix.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ??
      'HealingWings';
    document.title = `HealingWings — ${pageName}`;
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <CookieConsentProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <RouteTitleManager />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HealingWingsHome />} />
            <Route path="/impact" element={<ImpactPage />} />
            <Route path="/volunteer" element={<VolunteerPage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
            <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
            <Route path="/logout" element={<AuthLayout><LogoutPage /></AuthLayout>} />
            <Route
              path="/mfa"
              element={
                <RequireAuth>
                  <AuthLayout><ManageMFAPage /></AuthLayout>
                </RequireAuth>
              }
            />
            <Route path="/privacy" element={<AuthLayout><PrivacyPage /></AuthLayout>} />
            <Route
              path="/unauthorized"
              element={
                <AuthLayout>
                  <div className="container text-center mt-5">
                    <h2>Access Denied</h2>
                    <p className="text-muted">You don't have permission to view this page.</p>
                  </div>
                </AuthLayout>
              }
            />

            {/* Donor portal (SCAF-1) */}
            <Route
              path="/donor"
              element={
                <RequireAuth role={['Donor', 'LegacyCustomer', 'Admin']}>
                  <DonorLayout />
                </RequireAuth>
              }
            >
              <Route index element={<DonorDashboardPage />} />
              <Route path="dashboard" element={<DonorDashboardPage />} />
            </Route>

            {/* Admin / staff portal (SCAF-1) */}
            <Route
              path="/admin"
              element={
                <RequireAuth role={['Admin', 'Staff']}>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminHomePage />} />
              <Route path="home" element={<AdminHomePage />} />
              <Route path="donations" element={<SupportersListPage />} />
              <Route path="donations/contributions" element={<ContributionsPage />} />
              <Route path="donations/allocations" element={<AllocationsPage />} />
              <Route path="residents" element={<ResidentsListPage />} />
              <Route path="residents/process-recordings" element={<ProcessRecordingPage />} />
              <Route path="residents/visits-conferences" element={<ResidentVisitsAndConferencesPage />} />
              <Route path="residents/:id/process" element={<ProcessRecordingPage />} />
              <Route path="residents/:id/visits" element={<VisitsPage />} />
              <Route
                path="social-media"
                element={
                  <RequireAuth role="Admin">
                    <SocialMediaHistoryPage />
                  </RequireAuth>
                }
              />
              <Route
                path="social-media/suggest"
                element={
                  <RequireAuth role="Admin">
                    <SocialMediaSuggestPage />
                  </RequireAuth>
                }
              />
              <Route path="reports" element={<ReportsAnalyticsPage />} />
              <Route
                path="user-manager"
                element={
                  <RequireAuth role="Admin">
                    <UserManagerPage />
                  </RequireAuth>
                }
              />
              <Route
                path="volunteer-submissions"
                element={
                  <RequireAuth role="Admin">
                    <VolunteerSubmissionsPage />
                  </RequireAuth>
                }
              />
              <Route path="reports/donations" element={<Navigate to="/admin/reports" replace />} />
              <Route path="reports/outcomes" element={<Navigate to="/admin/reports" replace />} />
            </Route>
          </Routes>
          <CookieConsentBanner />
        </Router>
      </AuthProvider>
    </CookieConsentProvider>
  );
}

export default App;
