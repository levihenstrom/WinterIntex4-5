import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  buildExternalLoginUrl,
  getExternalProviders,
  registerUser,
  type ExternalAuthProvider,
} from '../lib/authAPI';

function RegisterPage() {
  const navigate = useNavigate();
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
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Register</h2>
              <p className="text-muted">Create a new account.</p>
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
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {errorMessage ? (
                  <div className="alert alert-danger" role="alert">
                    {errorMessage}
                  </div>
                ) : null}
                {successMessage ? (
                  <div className="alert alert-success" role="alert">
                    {successMessage}
                  </div>
                ) : null}
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating account...' : 'Create account'}
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
                Already registered? <Link to="/login">Go to login</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
