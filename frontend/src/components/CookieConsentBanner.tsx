import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

function CookieConsentBanner() {
  const { hasAcknowledgedConsent, acknowledgeConsent } = useCookieConsent();

  if (hasAcknowledgedConsent) {
    return null;
  }

  return (
    <aside
      className="hw-cookie-banner"
      role="dialog"
      aria-live="polite"
    >
      <div className="hw-cookie-copy">
        <p className="hw-cookie-eyebrow mb-2">Cookie notice</p>
        <p className="mb-2">
          This site uses essential cookies for sign-in and security features.
          Google sign-in may also set provider cookies during the external login
          flow.
        </p>
        <p className="mb-0">
          We do not use analytics or marketing cookies. Read our{' '}
          <Link to="/privacy">privacy policy</Link> for more details.
        </p>
      </div>
      <button
        type="button"
        className="hw-btn-magenta px-4 py-2 rounded-3 fw-semibold text-nowrap"
        onClick={acknowledgeConsent}
      >
        Acknowledge essential cookies
      </button>
    </aside>
  );
}

export default CookieConsentBanner;
