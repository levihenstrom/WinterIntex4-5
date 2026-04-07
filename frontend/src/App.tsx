import { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useSearchParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CookieConsentProvider } from './context/CookieConsentContext';
import CookieConsentBanner from './components/CookieConsentBanner';
import { exchangeAuthToken } from './lib/authAPI';
import { resolvePostLoginPath } from './lib/authRedirect';
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
import DonorDashboardPage from './pages/scaffold/DonorDashboardPage';
import AdminHomePage from './pages/scaffold/AdminHomePage';
import SupportersListPage from './pages/scaffold/SupportersListPage';
import ContributionsPage from './pages/scaffold/ContributionsPage';
import AllocationsPage from './pages/scaffold/AllocationsPage';
import ResidentsListPage from './pages/scaffold/ResidentsListPage';
import ProcessRecordingPage from './pages/scaffold/ProcessRecordingPage';
import VisitsPage from './pages/scaffold/VisitsPage';
import SocialMediaHistoryPage from './pages/scaffold/SocialMediaHistoryPage';
import SocialMediaSuggestPage from './pages/scaffold/SocialMediaSuggestPage';
import DonationsReportPage from './pages/scaffold/DonationsReportPage';
import OutcomesReportPage from './pages/scaffold/OutcomesReportPage';

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

/**
 * After Google OAuth, the backend redirects here with ?authToken=...
 */
function AuthTokenExchanger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshAuthState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    const authToken = searchParams.get('authToken');
    if (!authToken || exchanging) return;
    setExchanging(true);
    exchangeAuthToken(authToken)
      .then((session) => {
        void refreshAuthState();
        searchParams.delete('authToken');
        setSearchParams(searchParams, { replace: true });
        navigate(resolvePostLoginPath(location.pathname, session.roles), {
          replace: true,
        });
      })
      .catch(() => {
        navigate('/login?externalError=Unable+to+complete+sign-in.', { replace: true });
      });
  }, [searchParams, setSearchParams, refreshAuthState, navigate, exchanging, location.pathname]);

  if (searchParams.get('authToken')) {
    return (
      <div className="container text-center mt-5">
        <p>Completing sign-in...</p>
      </div>
    );
  }
  return null;
}

function App() {
  return (
    <CookieConsentProvider>
      <AuthProvider>
        <Router>
          <AuthTokenExchanger />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HealingWingsHome />} />
            <Route path="/impact" element={<ImpactPage />} />
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
              <Route path="residents/:id/process" element={<ProcessRecordingPage />} />
              <Route path="residents/:id/visits" element={<VisitsPage />} />
              <Route path="social-media" element={<SocialMediaHistoryPage />} />
              <Route path="social-media/suggest" element={<SocialMediaSuggestPage />} />
              <Route path="reports/donations" element={<DonationsReportPage />} />
              <Route path="reports/outcomes" element={<OutcomesReportPage />} />
            </Route>
          </Routes>
          <CookieConsentBanner />
        </Router>
      </AuthProvider>
    </CookieConsentProvider>
  );
}

export default App;
