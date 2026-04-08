import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import GoogleIcon from '../components/hw/GoogleIcon';
import { useAuth } from '../context/AuthContext';
import {
  buildExternalLoginUrl,
  getExternalProviders,
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
import 'bootstrap-icons/font/bootstrap-icons.css';

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
  const { isAuthenticated, isLoading, authSession } = useAuth();
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
  const confirmMismatch =
    confirmTouched && confirmPassword.length > 0 && confirmPassword !== password;
  const passwordShowInvalid =
    passwordTouched && password.length > 0 && !passwordMeetsPolicy(password);

  useEffect(() => {
    void (async () => {
      try {
        setExternalProviders(await getExternalProviders());
      } catch {
        setExternalProviders([]);
      }
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
      setSuccessMessage('Registration succeeded. You can log in now.');
      setTimeout(() => navigate('/login'), 800);
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

  if (isAuthenticated) {
    return <Navigate to={resolvePostLoginPath(undefined, authSession.roles)} replace />;
  }

  const formValid =
    passwordMeetsPolicy(password) && password === confirmPassword && email.trim().length > 0;

  return (
    <div className="hw-auth-shell">
      <div className="container py-4 py-md-5">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
            <div className="hw-auth-card p-4 p-md-5">
              <p className="hw-eyebrow mb-2">Account</p>
              <h1 className="hw-heading hw-heading-font h3 mb-2">Sign up</h1>
              <p className="text-secondary small mb-4">
                Email and password, or a provider when available.
              </p>
              <form onSubmit={handleSubmit} noValidate>
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
                <div className="mb-2">
                  <label className="hw-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className={`hw-input${passwordShowInvalid ? ' hw-input--invalid' : ''}`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                      {PASSWORD_MIN_UNIQUE_CHARS === 1 ? '' : 's'} (currently{' '}
                      {countUniqueChars(password)})
                    </PasswordRule>
                  </div>
                  {passwordShowInvalid ? (
                    <p className="text-danger small mt-2 mb-0" role="alert">
                      Password must satisfy every rule above (same requirements as the server).
                    </p>
                  ) : null}
                </div>
                <div className="mb-4">
                  <label className="hw-label" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className={`hw-input${confirmMismatch ? ' hw-input--invalid' : ''}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    autoComplete="new-password"
                    aria-invalid={confirmMismatch}
                  />
                  {confirmMismatch ? (
                    <p className="text-danger small mt-2 mb-0" role="alert">
                      Passwords must match.
                    </p>
                  ) : null}
                </div>
                {errorMessage ? (
                  <div className="hw-alert-error mb-3" role="alert">
                    {errorMessage}
                  </div>
                ) : null}
                {successMessage ? (
                  <div className="hw-alert-success mb-3" role="alert">
                    {successMessage}
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="hw-btn-magenta w-100 py-2 rounded-3 fw-semibold"
                  disabled={isSubmitting || !formValid}
                >
                  {isSubmitting ? 'Signing up...' : 'Sign up'}
                </button>
              </form>

              {externalProviders.length > 0 ? (
                <>
                  <div className="hw-divider-or">or sign up with</div>
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
                        Sign up with {provider.displayName}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <p className="hw-auth-footer-hint mb-0">
                Already have an account?{' '}
                <Link className="hw-link" to="/login">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
