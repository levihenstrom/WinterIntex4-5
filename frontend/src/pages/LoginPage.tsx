import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/hw/GoogleIcon';
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
    <div className="hw-auth-shell">
      <div className="container py-4 py-md-5">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
            <div className="hw-auth-card p-4 p-md-5">
              <p className="hw-eyebrow mb-2">Account</p>
              <h1 className="hw-heading hw-heading-font h3 mb-2">Sign in</h1>
              <p className="text-secondary small mb-4">
                Email and password. Expand below if you use MFA.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="hw-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="hw-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="mb-3">
                  <label className="hw-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="hw-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <details className="hw-auth-details">
                  <summary>Authenticator or recovery code</summary>
                  <div className="hw-auth-details-body">
                    <div className="mb-3">
                      <label className="hw-label" htmlFor="twoFactorCode">
                        Authenticator code
                      </label>
                      <input
                        id="twoFactorCode"
                        type="text"
                        className="hw-input"
                        inputMode="numeric"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        autoComplete="one-time-code"
                      />
                      <div className="hw-form-hint">
                        Leave blank unless MFA is enabled.
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="hw-label" htmlFor="recoveryCode">
                        Recovery code
                      </label>
                      <input
                        id="recoveryCode"
                        type="text"
                        className="hw-input"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        autoComplete="off"
                      />
                      <div className="hw-form-hint">
                        If you cannot use your authenticator app.
                      </div>
                    </div>
                  </div>
                </details>

                <div className="form-check mb-4">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    className="form-check-input hw-check"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label
                    className="form-check-label small"
                    style={{ color: 'var(--hw-navy)' }}
                    htmlFor="rememberMe"
                  >
                    Keep me signed in on this device
                  </label>
                </div>
                {errorMessage ? (
                  <div className="hw-alert-error mb-3" role="alert">
                    {errorMessage}
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="hw-btn-magenta w-100 py-2 rounded-3 fw-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              {externalProviders.length > 0 ? (
                <>
                  <div className="hw-divider-or">or continue with</div>
                  <div className="d-grid gap-2">
                    {externalProviders.map((provider) => (
                      <button
                        key={provider.name}
                        type="button"
                        className="hw-btn-external"
                        onClick={() => handleExternalLogin(provider.name)}
                      >
                        {provider.displayName.toLowerCase() === 'google' ? (
                          <GoogleIcon />
                        ) : null}
                        Continue with {provider.displayName}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <p className="hw-auth-footer-hint mb-0">
                Need an account?{' '}
                <Link className="hw-link" to="/register">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
