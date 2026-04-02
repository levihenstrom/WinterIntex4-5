import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LogoutPage from './pages/LogoutPage';
import ManageMFAPage from './pages/ManageMFAPage';

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
    <AuthProvider>
      <Router>
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/mfa" element={<ManageMFAPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
