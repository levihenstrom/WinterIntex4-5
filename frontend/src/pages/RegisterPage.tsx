import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleIcon from '../components/hw/GoogleIcon';
import { useAuth } from '../context/AuthContext';
import {
  buildExternalLoginUrl,
  getExternalProviders,
  registerUser,
  type ExternalAuthProvider,
} from '../lib/authAPI';
import { resolvePostLoginPath } from '../lib/authRedirect';

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, authSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [externalProviders, setExternalProviders] = useState<
    ExternalAuthProvider[]
  >([]);

  useEffect(() => {
    void (async () => {
      try {
        setExternalProviders(await getExternalProviders());
      } catch {
        setExternalProviders([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    navigate(resolvePostLoginPath(undefined, authSession.roles), { replace: true });
  }, [isLoading, isAuthenticated, authSession.roles, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

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
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to register.'
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
              <h1 className="hw-heading hw-heading-font h3 mb-2">Sign up</h1>
              <p className="text-secondary small mb-4">
                Email and password, or a provider when available.
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
                    autoComplete="new-password"
                  />
                </div>
                <div className="mb-4">
                  <label className="hw-label" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="hw-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
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
                  disabled={isSubmitting}
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
