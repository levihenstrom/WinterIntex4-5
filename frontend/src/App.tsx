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
import './App.css';

// Bootstrap NavBar — shown on auth/utility pages only
function AuthNavBar() {
  const { isAuthenticated, authSession, isLoading } = useAuth();
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
      <div className="container">
        <Link className="navbar-brand" to="/">
          HealingWings
        </Link>
        <div className="navbar-nav ms-auto">
          {isLoading ? null : isAuthenticated ? (
            <>
              <span className="navbar-text me-3">
                {authSession.email}
                {authSession.roles.length > 0 && (
                  <span className="badge bg-info ms-2">
                    {authSession.roles.join(', ')}
                  </span>
                )}
              </span>
              <Link className="nav-link" to="/mfa">MFA</Link>
              <Link className="nav-link" to="/logout">Logout</Link>
            </>
          ) : (
            <>
              <Link className="nav-link" to="/login">Login</Link>
              <Link className="nav-link" to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// Auth page with Bootstrap nav wrapper
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthNavBar />
      {children}
      <footer className="bg-dark text-light text-center py-3 mt-auto">
        <div className="container">
          <Link className="text-light" to="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </>
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
