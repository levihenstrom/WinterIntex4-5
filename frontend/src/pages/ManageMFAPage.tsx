import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
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
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [savedRecoveryCodes, setSavedRecoveryCodes] = useState(false);

  const twoFactorEnabled = Boolean(twoFactorStatus?.isTwoFactorEnabled);

  const authenticatorUri = useMemo(() => {
    if (!authSession.email || !twoFactorStatus?.sharedKey) return '';
    const issuer = 'Intex';
    const label = `${issuer}:${authSession.email}`;
    const searchParams = new URLSearchParams({ secret: twoFactorStatus.sharedKey, issuer });
    return `otpauth://totp/${encodeURIComponent(label)}?${searchParams.toString()}`;
  }, [authSession.email, twoFactorStatus?.sharedKey]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) void loadTwoFactorStatus();
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!authenticatorUri || (!isSetupMode && !twoFactorEnabled)) {
      setQrCodeDataUrl('');
      return;
    }
    QRCode.toDataURL(authenticatorUri, { width: 224, margin: 1 })
      .then(setQrCodeDataUrl)
      .catch(() => setQrCodeDataUrl(''));
  }, [authenticatorUri, isSetupMode, twoFactorEnabled]);

  async function loadTwoFactorStatus() {
    setErrorMessage('');
    try {
      const status = await getTwoFactorStatus();
      setTwoFactorStatus(status);
      setRecoveryCodes(status.recoveryCodes ?? []);
      if (status.isTwoFactorEnabled) setIsSetupMode(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load MFA status.');
    }
  }

  function startSetupFlow() {
    setErrorMessage('');
    setSuccessMessage('');
    setAuthenticatorCode('');
    setIsSetupMode(true);
  }

  function cancelSetupFlow() {
    setErrorMessage('');
    setSuccessMessage('');
    setAuthenticatorCode('');
    setIsSetupMode(false);
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const status = await enableTwoFactor(authenticatorCode.trim());
      setTwoFactorStatus(status);
      setRecoveryCodes(status.recoveryCodes ?? []);
      setSavedRecoveryCodes(false);
      setAuthenticatorCode('');
      setIsSetupMode(false);
      setSuccessMessage('MFA is enabled. Save the recovery codes below before leaving this page.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to enable MFA.');
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
      setSavedRecoveryCodes(false);
      setIsSetupMode(false);
      setSuccessMessage('MFA has been turned off for this account.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to disable MFA.');
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
      setSavedRecoveryCodes(false);
      setSuccessMessage('Recovery codes were reset. Save this new list.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reset recovery codes.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const showSetupFlow = Boolean(isAuthenticated && twoFactorStatus && !twoFactorEnabled && isSetupMode);

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-9 col-xl-8">
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Authenticator App MFA</h2>
              <p className="text-muted mb-3">
                Add an extra security step to your account. After password login, you enter a 6-digit code from your phone.
              </p>

              {isLoading ? <p>Checking MFA status...</p> : null}

              {errorMessage ? <div className="alert alert-danger" role="alert">{errorMessage}</div> : null}
              {successMessage ? <div className="alert alert-success" role="alert">{successMessage}</div> : null}

              {isAuthenticated && twoFactorStatus ? (
                <>
                  <div className="mb-3">
                    <span className={`badge rounded-pill ${twoFactorEnabled ? 'text-bg-success' : 'text-bg-warning'}`}>
                      {twoFactorEnabled ? 'MFA enabled' : 'MFA not enabled'}
                    </span>
                  </div>

                  {!twoFactorEnabled && !showSetupFlow ? (
                    <div className="border rounded-3 p-3 p-md-4 bg-light-subtle">
                      <h3 className="h5 mb-2">Turn on MFA</h3>
                      <p className="text-muted mb-3">
                        MFA is currently off. Turn it on to protect your account.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-lg w-100 w-md-auto"
                        onClick={startSetupFlow}
                        disabled={isSubmitting}
                      >
                        Turn on MFA
                      </button>
                    </div>
                  ) : null}

                  {showSetupFlow ? (
                    <div className="row g-4 mt-1">
                      <div className="col-12 col-md-5">
                        <div className="border rounded p-3 h-100 bg-light-subtle">
                          <h3 className="h6 mb-2">Step 1: Install an app</h3>
                          <ul className="small mb-3">
                            <li>Google Authenticator</li>
                            <li>Microsoft Authenticator</li>
                            <li>Authy</li>
                          </ul>
                          <h3 className="h6 mb-2">Step 2: Add this account</h3>
                          {qrCodeDataUrl ? (
                            <img
                              src={qrCodeDataUrl}
                              alt="Authenticator app QR code"
                              className="img-fluid border rounded bg-white p-2 mb-3"
                            />
                          ) : null}
                          <p className="mb-1 small"><strong>Shared key</strong></p>
                          <code className="d-block mb-2 text-break">{twoFactorStatus.sharedKey ?? 'Unavailable'}</code>
                          <p className="small text-muted mb-0">Scan the QR code, or manually enter the shared key in your app.</p>
                        </div>
                      </div>

                      <div className="col-12 col-md-7">
                        <div className="border rounded p-3 h-100">
                          <h3 className="h6 mb-2">Step 3: Verify and enable</h3>
                          <p className="small text-muted mb-3">
                            Enter the 6-digit code from your phone here, then click <strong>Enable MFA</strong>.
                          </p>
                          <form onSubmit={handleEnable}>
                            <div className="mb-3">
                              <label className="form-label" htmlFor="authenticatorCode">
                                6-digit authenticator code
                              </label>
                              <input
                                id="authenticatorCode"
                                type="text"
                                className="form-control form-control-lg"
                                inputMode="numeric"
                                value={authenticatorCode}
                                onChange={(e) => setAuthenticatorCode(e.target.value)}
                                required
                              />
                            </div>
                            <div className="d-flex flex-column flex-sm-row gap-2">
                              <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
                                {isSubmitting ? 'Enabling...' : 'Enable MFA'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-lg"
                                disabled={isSubmitting}
                                onClick={cancelSetupFlow}
                              >
                                Cancel setup
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {twoFactorEnabled ? (
                    <div className="border rounded-3 p-3 p-md-4">
                      <h3 className="h5 mb-2">MFA is on</h3>
                      <p className="mb-3 text-muted">
                        You will enter a phone code after your password when signing in.
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
                          Turn off MFA
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {recoveryCodes.length > 0 ? (
                    <div className="alert alert-warning mt-4 mb-0" role="alert">
                      <h3 className="h6">Step 4: Save recovery codes</h3>
                      <p className="mb-2">
                        Save these now. Each code can be used once if you lose access to your authenticator app.
                      </p>
                      <ul className="mb-3">
                        {recoveryCodes.map((code) => (
                          <li key={code}><code>{code}</code></li>
                        ))}
                      </ul>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="savedRecoveryCodes"
                          checked={savedRecoveryCodes}
                          onChange={(e) => setSavedRecoveryCodes(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="savedRecoveryCodes">
                          I saved these recovery codes in a safe place
                        </label>
                      </div>
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
