import { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CookieConsentProvider } from './context/CookieConsentContext';
import CookieConsentBanner from './components/CookieConsentBanner';
import { exchangeAuthToken } from './lib/authAPI';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LogoutPage from './pages/LogoutPage';
import ManageMFAPage from './pages/ManageMFAPage';
import PrivacyPage from './pages/PrivacyPage';
import HealingWingsHome from './pages/HealingWingsHome';

// Auth pages nav — matches HealingWings hw.css (navy + amber CTAs)
function AuthNavBar() {
  const { isAuthenticated, authSession, isLoading } = useAuth();
  return (
    <header
      className="shadow-lg mb-0"
      style={{ background: 'var(--hw-navy)' }}
    >
      <div className="container d-flex align-items-center justify-content-between py-3 flex-wrap gap-2">
        <Link
          className="text-white text-decoration-none fw-bold hw-heading-font fs-5"
          to="/"
        >
          HealingWings
        </Link>
        <div className="d-flex align-items-center flex-wrap gap-2 gap-md-3">
          {isLoading ? null : isAuthenticated ? (
            <>
              <span className="text-white-50 small me-md-2">
                {authSession.email}
                {authSession.roles.length > 0 && (
                  <span
                    className="badge ms-2 rounded-pill"
                    style={{
                      background: 'var(--hw-teal)',
                      color: 'white',
                    }}
                  >
                    {authSession.roles.join(', ')}
                  </span>
                )}
              </span>
              <Link className="text-white-50 text-decoration-none small" to="/mfa">
                MFA
              </Link>
              <Link className="text-white-50 text-decoration-none small" to="/logout">
                Logout
              </Link>
            </>
          ) : (
            <>
              <Link
                className="hw-nav-login px-3 py-2 rounded-pill text-sm fw-semibold text-decoration-none d-inline-block"
                to="/login"
              >
                Log In
              </Link>
              <Link
                className="hw-nav-signup px-3 py-2 rounded-pill text-sm fw-semibold text-decoration-none text-white d-inline-block"
                to="/register"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Auth page — full-height column so hw-auth-shell fills viewport
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <AuthNavBar />
      {children}
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
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    const authToken = searchParams.get('authToken');
    if (!authToken || exchanging) return;
    setExchanging(true);
    exchangeAuthToken(authToken)
      .then(() => refreshAuthState())
      .then(() => {
        searchParams.delete('authToken');
        setSearchParams(searchParams, { replace: true });
        navigate('/', { replace: true });
      })
      .catch(() => {
        navigate('/login?externalError=Unable+to+complete+sign-in.', { replace: true });
      });
  }, [searchParams, setSearchParams, refreshAuthState, navigate, exchanging]);

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
            {/* HealingWings landing page — has its own NavBar */}
            <Route path="/" element={<HealingWingsHome />} />
            {/* Auth pages — use Bootstrap layout */}
            <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
            <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
            <Route path="/logout" element={<AuthLayout><LogoutPage /></AuthLayout>} />
            <Route path="/mfa" element={<AuthLayout><ManageMFAPage /></AuthLayout>} />
            <Route path="/privacy" element={<AuthLayout><PrivacyPage /></AuthLayout>} />
          </Routes>
          <CookieConsentBanner />
        </Router>
      </AuthProvider>
    </CookieConsentProvider>
  );
}

export default App;
