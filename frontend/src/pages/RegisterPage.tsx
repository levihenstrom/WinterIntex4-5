import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import GoogleIcon from '../components/hw/GoogleIcon';
import { useAuth } from '../context/AuthContext';
import HealingWingsLogo from '../components/hw/HealingWingsLogo';
import {
  buildExternalLoginUrl,
  getExternalProviders,
  loginUser,
  registerUser,
  type ExternalAuthProvider,
} from '../lib/authAPI';
import { resolvePostLoginPath } from '../lib/authRedirect';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_UNIQUE_CHARS,
  countUniqueChars,
  passwordMeetsMinLength,
  passwordMeetsPolicy,
  passwordMeetsUniqueChars,
} from '../lib/passwordPolicy';


// ── Background image (mission-aligned: children & community) ──────────────────
const BG_URL =
  'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1920&q=80';

function PasswordRule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`hw-pwd-rule ${ok ? 'hw-pwd-rule--ok' : 'hw-pwd-rule--bad'}`}>
      <i className={`bi ${ok ? 'bi-check-circle-fill' : 'bi-circle'}`} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, authSession, refreshAuthState } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [externalProviders, setExternalProviders] = useState<ExternalAuthProvider[]>([]);

  const lenOk = passwordMeetsMinLength(password);
  const uniqueOk = passwordMeetsUniqueChars(password);
  const confirmMismatch = confirmTouched && confirmPassword.length > 0 && confirmPassword !== password;
  const passwordShowInvalid = passwordTouched && password.length > 0 && !passwordMeetsPolicy(password);

  useEffect(() => {
    void (async () => {
      try { setExternalProviders(await getExternalProviders()); }
      catch { setExternalProviders([]); }
    })();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setPasswordTouched(true);
    setConfirmTouched(true);

    if (!passwordMeetsPolicy(password)) {
      setErrorMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters and meet all rules below.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords must match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser(email, password);
      // Auto-login after successful registration
      const loginResult = await loginUser(email, password, false);
      const session = {
        isAuthenticated: true,
        userName: loginResult.userName,
        email: loginResult.email,
        roles: loginResult.roles,
      };
      
      const { storeSession } = await import('../lib/authAPI');
      storeSession(session, loginResult.refreshToken);
      await refreshAuthState({ session });

      setSuccessMessage('Registration succeeded! Logging you in...');
      // Success will trigger re-render and Move user to their dashboard via NavLink/Navigate in this component
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to register.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleExternalLogin(providerName: string) {
    window.location.assign(buildExternalLoginUrl(providerName, '/'));
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f2744' }}>
        <div className="text-center">
          <div className="spinner-border mb-2" role="status" style={{ color: '#0D9488' }}>
            <span className="visually-hidden">Loading…</span>
          </div>
          <p className="small mb-0" style={{ color: 'rgba(255,255,255,0.6)' }}>Checking your session…</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={resolvePostLoginPath(undefined, authSession.roles)} replace />;
  }

  const formValid = passwordMeetsPolicy(password) && password === confirmPassword && email.trim().length > 0;

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
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <HealingWingsLogo size={44} />
                  <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: 18, color: '#1E3A5F', letterSpacing: '-0.3px' }}>
                    HealingWings
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#0D9488', marginBottom: 6 }}>
                  Join us
                </p>
                <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#1E3A5F', fontFamily: 'Poppins, sans-serif' }}>
                  Create your account
                </h1>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7280' }}>
                  Be part of something that truly matters.
                </p>
              </div>

              {/* ── Inspiring message ── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(13,148,136,0.07) 0%, rgba(107,33,168,0.07) 100%)',
                border: '1px solid rgba(13,148,136,0.2)',
                borderLeft: '3.5px solid #0D9488',
                borderRadius: '0 12px 12px 0',
                padding: '14px 18px',
                marginBottom: '1.75rem',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="18" height="18" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M14 26C14 26 3 19 3 11C3 7.13 6.13 4 10 4C11.9 4 13.6 4.78 14 5C14.4 4.78 16.1 4 18 4C21.87 4 25 7.13 25 11C25 19 14 26 14 26Z" fill="#0D9488" />
                  </svg>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#374151', lineHeight: 1.65 }}>
                    Creating your account will give you personalized updates on how you are{' '}
                    <strong style={{ color: '#1E3A5F' }}>helping change the lives of these children</strong>.
                  </p>
                </div>
              </div>

              {/* ── Registration form ── */}
              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label className="hw-label" htmlFor="email">Email</label>
                  <input
                    id="email" type="email" className="hw-input"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email"
                  />
                </div>
                <div className="mb-2">
                  <label className="hw-label" htmlFor="password">Password</label>
                  <input
                    id="password" type="password"
                    className={`hw-input${passwordShowInvalid ? ' hw-input--invalid' : ''}`}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    autoComplete="new-password"
                    aria-invalid={passwordShowInvalid}
                    aria-describedby="password-rules"
                  />
                  <div id="password-rules" className="hw-pwd-rules">
                    <PasswordRule ok={lenOk}>
                      At least {PASSWORD_MIN_LENGTH} characters ({password.length}/{PASSWORD_MIN_LENGTH})
                    </PasswordRule>
                    <PasswordRule ok={uniqueOk}>
                      At least {PASSWORD_MIN_UNIQUE_CHARS} distinct character
                      {PASSWORD_MIN_UNIQUE_CHARS === 1 ? '' : 's'} (currently {countUniqueChars(password)})
                    </PasswordRule>
                  </div>
                  {passwordShowInvalid && (
                    <p className="text-danger small mt-2 mb-0" role="alert">
                      Password must satisfy every rule above.
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="hw-label" htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword" type="password"
                    className={`hw-input${confirmMismatch ? ' hw-input--invalid' : ''}`}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    autoComplete="new-password"
                    aria-invalid={confirmMismatch}
                  />
                  {confirmMismatch && (
                    <p className="text-danger small mt-2 mb-0" role="alert">Passwords must match.</p>
                  )}
                </div>

                {errorMessage && (
                  <div className="hw-alert-error mb-3" role="alert">{errorMessage}</div>
                )}
                {successMessage && (
                  <div className="hw-alert-success mb-3" role="alert">{successMessage}</div>
                )}

                <button
                  type="submit"
                  className="hw-btn-magenta w-100 rounded-3 fw-semibold"
                  style={{ padding: '0.7rem 1rem', fontSize: 15 }}
                  disabled={isSubmitting || !formValid}
                >
                  {isSubmitting ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status" />Creating account…</>
                  ) : 'Create account'}
                </button>
              </form>

              {/* ── External providers ── */}
              {externalProviders.length > 0 && (
                <>
                  <div className="hw-divider-or">or sign up with</div>
                  <div className="d-grid gap-2">
                    {externalProviders.map((provider) => (
                      <button key={provider.name} type="button" className="hw-btn-external"
                        onClick={() => handleExternalLogin(provider.name)}>
                        {provider.displayName.toLowerCase() === 'google' && <GoogleIcon />}
                        Sign up with {provider.displayName}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── Footer hint ── */}
              <p style={{ textAlign: 'center', fontSize: 13.5, color: '#6B7280', marginTop: '1.5rem', marginBottom: 0 }}>
                Already have an account?{' '}
                <Link className="hw-link" to="/login">Sign in</Link>
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

export default RegisterPage;
