import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  resetRecoveryCodes,
} from '../lib/authAPI';
import type { TwoFactorStatus } from '../types/TwoFactorStatus';

function ManageMFAPage() {
  const { authSession, isAuthenticated, isLoading } = useAuth();
  const [twoFactorStatus, setTwoFactorStatus] =
    useState<TwoFactorStatus | null>(null);
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authenticatorUri = useMemo(() => {
    if (!authSession.email || !twoFactorStatus?.sharedKey) {
      return '';
    }

    const issuer = 'Intex';
    const label = `${issuer}:${authSession.email}`;
    const searchParams = new URLSearchParams({
      secret: twoFactorStatus.sharedKey,
      issuer,
    });

    return `otpauth://totp/${encodeURIComponent(label)}?${searchParams.toString()}`;
  }, [authSession.email, twoFactorStatus?.sharedKey]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void loadTwoFactorStatus();
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!authenticatorUri) {
      setQrCodeDataUrl('');
      return;
    }

    QRCode.toDataURL(authenticatorUri, { width: 224, margin: 1 })
      .then(setQrCodeDataUrl)
      .catch(() => setQrCodeDataUrl(''));
  }, [authenticatorUri]);

  async function loadTwoFactorStatus() {
    setErrorMessage('');
    try {
      const status = await getTwoFactorStatus();
      setTwoFactorStatus(status);
      setRecoveryCodes(status.recoveryCodes ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load MFA status.'
      );
    }
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const status = await enableTwoFactor(authenticatorCode);
      setTwoFactorStatus(status);
      setRecoveryCodes(status.recoveryCodes ?? []);
      setAuthenticatorCode('');
      setSuccessMessage('MFA is now enabled. Save the recovery codes below.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to enable MFA.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisable() {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const status = await disableTwoFactor();
      setTwoFactorStatus(status);
      setRecoveryCodes([]);
      setSuccessMessage('MFA has been disabled for this account.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to disable MFA.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetRecoveryCodes() {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const status = await resetRecoveryCodes();
      setTwoFactorStatus(status);
      setRecoveryCodes(status.recoveryCodes ?? []);
      setSuccessMessage('Recovery codes were reset. Save the new list.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to reset recovery codes.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Authenticator App MFA</h2>
              <p className="text-muted mb-3">
                Manage multi-factor authentication for your account using an
                authenticator app.
              </p>

              {isLoading ? <p>Checking session...</p> : null}

              {!isLoading && !isAuthenticated ? (
                <div className="alert alert-warning" role="alert">
                  Sign in first, then return to the{' '}
                  <Link to="/mfa">MFA page</Link> to configure your
                  authenticator app.
                </div>
              ) : null}

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

              {isAuthenticated && twoFactorStatus ? (
                <>
                  <div className="mb-3">
                    <span
                      className={`badge rounded-pill ${
                        twoFactorStatus.isTwoFactorEnabled
                          ? 'text-bg-success'
                          : 'text-bg-warning'
                      }`}
                    >
                      {twoFactorStatus.isTwoFactorEnabled
                        ? 'MFA enabled'
                        : 'MFA not enabled'}
                    </span>
                  </div>

                  <div className="row g-4">
                    <div className="col-md-5">
                      <div className="border rounded p-3 h-100 bg-light-subtle">
                        <h3 className="h6">Authenticator setup</h3>
                        {qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt="Authenticator app QR code"
                            className="img-fluid border rounded bg-white p-2 mb-3"
                          />
                        ) : null}
                        <p className="mb-2">
                          <strong>Shared key</strong>
                        </p>
                        <code className="d-block mb-3">
                          {twoFactorStatus.sharedKey ?? 'Unavailable'}
                        </code>
                        <p className="small text-muted mb-0">
                          Scan the QR code or enter the shared key manually in
                          your authenticator app.
                        </p>
                      </div>
                    </div>
                    <div className="col-md-7">
                      {!twoFactorStatus.isTwoFactorEnabled ? (
                        <form onSubmit={handleEnable}>
                          <div className="mb-3">
                            <label
                              className="form-label"
                              htmlFor="authenticatorCode"
                            >
                              Authenticator code
                            </label>
                            <input
                              id="authenticatorCode"
                              type="text"
                              className="form-control"
                              inputMode="numeric"
                              value={authenticatorCode}
                              onChange={(e) =>
                                setAuthenticatorCode(e.target.value)
                              }
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Enabling...' : 'Enable MFA'}
                          </button>
                        </form>
                      ) : (
                        <div>
                          <p className="mb-3">
                            MFA is active for this account. You can keep using
                            authenticator codes at login or fall back to a
                            recovery code if needed.
                          </p>
                          <div className="d-flex gap-2 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={handleResetRecoveryCodes}
                              disabled={isSubmitting}
                            >
                              Reset recovery codes
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={handleDisable}
                              disabled={isSubmitting}
                            >
                              Disable MFA
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {recoveryCodes.length > 0 ? (
                    <div className="alert alert-warning mt-4 mb-0" role="alert">
                      <h3 className="h6">Recovery codes</h3>
                      <p className="mb-2">
                        Save these now. They are shown only when newly
                        generated.
                      </p>
                      <ul className="mb-0">
                        {recoveryCodes.map((code) => (
                          <li key={code}>
                            <code>{code}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4 mb-0 text-muted">
                      Recovery codes left: {twoFactorStatus.recoveryCodesLeft}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManageMFAPage;
