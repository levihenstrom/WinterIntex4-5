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
  storeSession,
  type ExternalAuthProvider,
} from '../lib/authAPI';
import { resolvePostLoginPath } from '../lib/authRedirect';

type LoginStep = 'credentials' | 'twoFactor';

// ── Background image (mission-aligned: children & community) ──────────────────
const BG_URL =
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1920&q=80';

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
  const [externalProviders, setExternalProviders] = useState<ExternalAuthProvider[]>([]);
  const [errorMessage, setErrorMessage] = useState(searchParams.get('externalError') ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { void loadExternalProviders(); }, []);

  async function loadExternalProviders() {
    try { setExternalProviders(await getExternalProviders()); }
    catch { setExternalProviders([]); }
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
      const session = {
        isAuthenticated: result.isAuthenticated,
        userName: result.userName,
        email: result.email,
        roles: result.roles,
      };
      storeSession(session, result.refreshToken);
      await refreshAuthState({ session });
      navigate(resolvePostLoginPath(fromPathname, result.roles), { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to log in.');
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
        rememberMe, twoFactorCode || undefined, recoveryCode || undefined
      );
      const session = {
        isAuthenticated: result.isAuthenticated,
        userName: result.userName,
        email: result.email,
        roles: result.roles,
      };
      storeSession(session, result.refreshToken);
      await refreshAuthState({ session });
      navigate(resolvePostLoginPath(fromPathname, result.roles), { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to verify MFA.');
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2744' }}>
        <div className="text-center text-white">
          <div className="spinner-border mb-2" role="status" style={{ color: '#0D9488' }}>
            <span className="visually-hidden">Loading…</span>
          </div>
          <p className="small mb-0" style={{ color: 'rgba(255,255,255,0.6)' }}>Checking your session…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !searchParams.get('externalError')) {
    return <Navigate to={resolvePostLoginPath(fromPathname, authSession.roles)} replace />;
  }

  return (
    <>
      {/* ── Full-bleed blurred background ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -2,
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover', backgroundPosition: 'center 30%',
        filter: 'blur(6px)',
        transform: 'scale(1.08)',
      }} />
      {/* ── Dark gradient overlay ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1,
        background: 'rgba(15,39,68,0.82)',
      }} />

      {/* ── Page content ── */}
      <div style={{
        minHeight: 'calc(100vh - 4rem)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2.5rem 1rem',
      }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* ── Auth card ── */}
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 20,
            boxShadow: '0 30px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>

            {/* Card top accent bar */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #0D9488 0%, #6B21A8 100%)' }} />

            <div style={{ padding: '2.5rem 2.5rem 2rem' }}>

              {/* Brand mark */}
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 26C14 26 3 19 3 11C3 7.13 6.13 4 10 4C11.9 4 13.6 4.78 14 5C14.4 4.78 16.1 4 18 4C21.87 4 25 7.13 25 11C25 19 14 26 14 26Z" fill="#0D9488" opacity="0.9" />
                    <path d="M14 26C14 26 7 17 7 11C7 8.24 9.24 6 12 6C13.1 6 14 6.45 14 6.45V26Z" fill="#5eead4" opacity="0.5" />
                  </svg>
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E3A5F', letterSpacing: '-0.3px' }}>
                    HealingWings
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#0D9488', marginBottom: 6 }}>
                  {loginStep === 'credentials' ? 'Welcome back' : 'Two-factor authentication'}
                </p>
                <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#1E3A5F', fontFamily: 'Poppins, sans-serif' }}>
                  {loginStep === 'credentials' ? 'Sign in to your account' : 'Verify your identity'}
                </h1>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7280' }}>
                  {loginStep === 'credentials'
                    ? 'Enter your credentials below to continue.'
                    : 'Enter your authenticator code or a recovery code.'}
                </p>
              </div>

              {/* ── Credentials form ── */}
              {loginStep === 'credentials' ? (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="hw-label" htmlFor="email">Email</label>
                    <input
                      id="email" type="email" className="hw-input"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      required autoComplete="email"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="hw-label" htmlFor="password">Password</label>
                    <input
                      id="password" type="password" className="hw-input"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      required autoComplete="current-password"
                    />
                  </div>
                  <div className="form-check mb-4">
                    <input
                      id="rememberMe" type="checkbox"
                      className="form-check-input hw-check"
                      checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label className="form-check-label small" style={{ color: '#4B5563' }} htmlFor="rememberMe">
                      Keep me signed in on this device
                    </label>
                  </div>

                  {errorMessage && (
                    <div className="hw-alert-error mb-3" role="alert">{errorMessage}</div>
                  )}

                  <button
                    type="submit"
                    className="hw-btn-magenta w-100 rounded-3 fw-semibold"
                    style={{ padding: '0.7rem 1rem', fontSize: 15 }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <><span className="spinner-border spinner-border-sm me-2" role="status" />Signing in…</>
                    ) : 'Sign in'}
                  </button>
                </form>
              ) : (
                /* ── Two-factor form ── */
                <form onSubmit={handleTwoFactorSubmit}>
                  <div className="rounded-3 border px-3 py-2 mb-3 small"
                    style={{ borderColor: 'rgba(30,58,95,0.18)', color: '#1E3A5F', background: 'rgba(13,148,136,0.05)' }}>
                    Second factor required for <strong>{email}</strong>
                  </div>
                  <div className="mb-3">
                    <label className="hw-label" htmlFor="twoFactorCode">Authenticator code</label>
                    <input
                      id="twoFactorCode" type="text" className="hw-input" inputMode="numeric"
                      value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)}
                      autoComplete="one-time-code"
                    />
                    <div className="hw-form-hint">Use the 6-digit code from your authenticator app.</div>
                  </div>
                  <div className="mb-4">
                    <label className="hw-label" htmlFor="recoveryCode">Recovery code</label>
                    <input
                      id="recoveryCode" type="text" className="hw-input"
                      value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)}
                      autoComplete="off"
                    />
                    <div className="hw-form-hint">Use this only if you cannot access your authenticator app.</div>
                  </div>
                  {errorMessage && (
                    <div className="hw-alert-error mb-3" role="alert">{errorMessage}</div>
                  )}
                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="hw-btn-magenta w-100 rounded-3 fw-semibold"
                      style={{ padding: '0.7rem 1rem', fontSize: 15 }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Verifying…' : 'Verify and sign in'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary"
                      onClick={handleBackToCredentials} disabled={isSubmitting}>
                      Back
                    </button>
                  </div>
                </form>
              )}

              {/* ── External providers ── */}
              {loginStep === 'credentials' && externalProviders.length > 0 && (
                <>
                  <div className="hw-divider-or">or continue with</div>
                  <div className="d-grid gap-2">
                    {externalProviders.map((provider) => (
                      <button key={provider.name} type="button" className="hw-btn-external"
                        onClick={() => handleExternalLogin(provider.name)}>
                        {provider.displayName.toLowerCase() === 'google' && <GoogleIcon />}
                        Continue with {provider.displayName}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Footer hint ── */}
              <p style={{ textAlign: 'center', fontSize: 13.5, color: '#6B7280', marginTop: '1.5rem', marginBottom: 0 }}>
                {loginStep === 'credentials' ? (
                  <>Don't have an account?{' '}
                    <Link className="hw-link" to="/register">Create one</Link>
                  </>
                ) : (
                  <>MFA is only required for accounts that have it enabled in{' '}
                    <Link className="hw-link" to="/mfa">account settings</Link>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* ── Below-card tagline ── */}
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: 13, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3 }}>
            Empowering children. Restoring hope. Rebuilding lives.
          </p>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
