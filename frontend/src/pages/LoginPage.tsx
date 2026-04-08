import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleIcon from '../components/hw/GoogleIcon';
import {
  buildExternalLoginUrl,
  completeTwoFactorLogin,
  getExternalProviders,
  loginUser,
  type ExternalAuthProvider,
} from '../lib/authAPI';
import { resolvePostLoginPath } from '../lib/authRedirect';

type LoginStep = 'credentials' | 'twoFactor';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromPathname = (location.state as { from?: Location })?.from?.pathname;
  const { refreshAuthState, isAuthenticated, isLoading, authSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
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
      const result = await loginUser(email, password, rememberMe);

      if (result.requiresTwoFactor) {
        setLoginStep('twoFactor');
        setTwoFactorCode('');
        setRecoveryCode('');
        return;
      }

      await refreshAuthState();
      navigate(resolvePostLoginPath(fromPathname, result.roles), { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to log in.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const result = await completeTwoFactorLogin(
        rememberMe,
        twoFactorCode || undefined,
        recoveryCode || undefined
      );
      await refreshAuthState();
      navigate(resolvePostLoginPath(fromPathname, result.roles), { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to verify MFA.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToCredentials() {
    setLoginStep('credentials');
    setTwoFactorCode('');
    setRecoveryCode('');
    setErrorMessage('');
  }

  function handleExternalLogin(providerName: string) {
    window.location.assign(
      buildExternalLoginUrl(providerName, resolvePostLoginPath(fromPathname, []))
    );
  }

  if (isLoading) {
    return (
      <div className="hw-auth-shell d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center text-secondary">
          <div className="spinner-border text-primary mb-2" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <p className="small mb-0">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !searchParams.get('externalError')) {
    return (
      <Navigate
        to={resolvePostLoginPath(fromPathname, authSession.roles)}
        replace
      />
    );
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
                {loginStep === 'credentials'
                  ? 'Enter your email and password.'
                  : 'Enter your authenticator code or a recovery code to finish signing in.'}
              </p>
              {loginStep === 'credentials' ? (
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
                    {isSubmitting ? 'Signing in...' : 'Continue'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleTwoFactorSubmit}>
                  <div
                    className="rounded-3 border px-3 py-2 mb-3 small"
                    style={{ borderColor: 'rgba(30, 58, 95, 0.18)', color: 'var(--hw-navy)' }}
                  >
                    Second factor required for <strong>{email}</strong>
                  </div>
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
                      Use the 6-digit code from your authenticator app.
                    </div>
                  </div>
                  <div className="mb-4">
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
                      Use this only if you cannot access your authenticator app.
                    </div>
                  </div>
                  {errorMessage ? (
                    <div className="hw-alert-error mb-3" role="alert">
                      {errorMessage}
                    </div>
                  ) : null}
                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="hw-btn-magenta w-100 py-2 rounded-3 fw-semibold"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Verifying...' : 'Verify and sign in'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleBackToCredentials}
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}

              {loginStep === 'credentials' && externalProviders.length > 0 ? (
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

              {loginStep === 'credentials' ? (
                <p className="hw-auth-footer-hint mb-0">
                  Need an account?{' '}
                  <Link className="hw-link" to="/register">
                    Sign up
                  </Link>
                </p>
              ) : (
                <p className="hw-auth-footer-hint mb-0">
                  MFA is only required for accounts that have it enabled in{' '}
                  <Link className="hw-link" to="/mfa">
                    account settings
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
