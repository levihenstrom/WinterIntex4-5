import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

function CookieConsentBanner() {
  const { hasResponded, acceptNecessaryOnly, acceptAll } = useCookieConsent();

  if (hasResponded) {
    return null;
  }

  return (
    <aside
      className="hw-cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby="hw-cookie-title"
      aria-describedby="hw-cookie-desc"
    >
      <div className="hw-cookie-copy">
        <p className="hw-cookie-eyebrow mb-2" id="hw-cookie-title">
          Cookies &amp; your privacy
        </p>
        <p className="mb-2" id="hw-cookie-desc">
          <strong>Necessary cookies</strong> keep sign-in and security working (including the session
          data your browser needs to stay logged in). Google sign-in may set additional provider
          cookies during that flow.
        </p>
        <p className="mb-2 small" style={{ opacity: 0.92 }}>
          If you choose <strong>Accept all</strong>, we may also store optional preferences on this
          device (under keys starting with <code className="text-warning">intex-optional-</code>).
          We do <strong>not</strong> use marketing or analytics cookies.
        </p>
        <p className="mb-0 small" style={{ opacity: 0.88 }}>
          See the{' '}
          <Link to="/privacy" className="text-reset">
            privacy policy
          </Link>{' '}
          for details. Your choice is saved in local storage until you clear site data.
        </p>
      </div>
      <div className="hw-cookie-actions">
        <button
          type="button"
          className="hw-cookie-btn hw-cookie-btn-primary"
          onClick={acceptNecessaryOnly}
        >
          Necessary only
        </button>
        <button type="button" className="hw-cookie-btn hw-cookie-btn-secondary" onClick={acceptAll}>
          Accept all
        </button>
      </div>
    </aside>
  );
}

export default CookieConsentBanner;
