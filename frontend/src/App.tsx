import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CookieConsentProvider } from './context/CookieConsentContext';
import CookieConsentBanner from './components/CookieConsentBanner';
import { exchangeAuthToken } from './lib/authAPI';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LogoutPage from './pages/LogoutPage';
import ManageMFAPage from './pages/ManageMFAPage';
import PrivacyPage from './pages/PrivacyPage';
import './App.css';

function NavBar() {
  const { isAuthenticated, authSession, isLoading } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
      <div className="container">
        <Link className="navbar-brand" to="/">
          Intex
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
              <Link className="nav-link" to="/mfa">
                MFA
              </Link>
              <Link className="nav-link" to="/logout">
                Logout
              </Link>
            </>
          ) : (
            <>
              <Link className="nav-link" to="/login">
                Login
              </Link>
              <Link className="nav-link" to="/register">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/**
 * After Google OAuth, the backend redirects here with ?authToken=...
 * We exchange it via fetch for session data + refresh token stored in localStorage.
 * This avoids relying on cross-origin cookies (which mobile Safari/Chrome block).
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
        // Remove authToken from URL without a full reload
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

function HomePage() {
  const { isAuthenticated, authSession } = useAuth();

  return (
    <div className="container">
      <h1>Welcome to Intex</h1>
      {isAuthenticated ? (
        <p>
          You are signed in as <strong>{authSession.email}</strong>.
        </p>
      ) : (
        <p>
          <Link to="/login">Sign in</Link> or{' '}
          <Link to="/register">create an account</Link> to get started.
        </p>
      )}
      <p className="text-muted">
        Add your domain pages and routes here once the rubric is available.
      </p>
    </div>
  );
}

function App() {
  return (
    <CookieConsentProvider>
      <AuthProvider>
        <Router>
          <AuthTokenExchanger />
          <NavBar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/mfa" element={<ManageMFAPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
          <footer className="bg-dark text-light text-center py-3 mt-auto">
            <div className="container">
              <Link className="text-light" to="/privacy">
                Privacy Policy
              </Link>
            </div>
          </footer>
          <CookieConsentBanner />
        </Router>
      </AuthProvider>
    </CookieConsentProvider>
  );
}

export default App;
