import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  buildExternalLoginUrl,
  getExternalProviders,
  loginUser,
  type ExternalAuthProvider,
} from '../lib/authAPI';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAuthState } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [externalProviders, setExternalProviders] = useState<
    ExternalAuthProvider[]
  >([]);
  const [errorMessage, setErrorMessage] = useState(
    searchParams.get('externalError') ?? ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadExternalProviders();
  }, []);

  async function loadExternalProviders() {
    try {
      const providers = await getExternalProviders();
      setExternalProviders(providers);
    } catch {
      setExternalProviders([]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await loginUser(
        email,
        password,
        rememberMe,
        twoFactorCode || undefined,
        recoveryCode || undefined
      );
      await refreshAuthState();
      navigate('/');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to log in.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleExternalLogin(providerName: string) {
    window.location.assign(buildExternalLoginUrl(providerName, '/'));
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Login</h2>
              <p className="text-muted">
                Sign in with your account. If MFA is enabled, include either an
                authenticator code or a recovery code.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="twoFactorCode">
                    Authenticator code
                  </label>
                  <input
                    id="twoFactorCode"
                    type="text"
                    className="form-control"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                  />
                  <div className="form-text">
                    Leave blank unless MFA is enabled on the account.
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="recoveryCode">
                    Recovery code
                  </label>
                  <input
                    id="recoveryCode"
                    type="text"
                    className="form-control"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                  />
                  <div className="form-text">
                    Use a recovery code instead of an authenticator code when
                    needed.
                  </div>
                </div>
                <div className="form-check mb-3">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    className="form-check-input"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="rememberMe">
                    Keep me signed in across browser restarts
                  </label>
                </div>
                {errorMessage ? (
                  <div className="alert alert-danger" role="alert">
                    {errorMessage}
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              {externalProviders.length > 0 ? (
                <>
                  <div className="text-center text-muted my-3">or</div>
                  <div className="d-grid gap-2">
                    {externalProviders.map((provider) => (
                      <button
                        key={provider.name}
                        type="button"
                        className="btn btn-outline-dark"
                        onClick={() => handleExternalLogin(provider.name)}
                      >
                        Continue with {provider.displayName}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <p className="mt-3 mb-0">
                Need an account? <Link to="/register">Register here</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
