import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { exchangeAuthToken } from '../lib/authAPI';
import { resolvePostLoginPath } from '../lib/authRedirect';

/** Survives React Strict Mode remounts so the one-time token is only exchanged once. */
let oauthExchangeStartedForToken: string | null = null;

/**
 * Public route: backend redirects here after Google OAuth with ?authToken=…&returnPath=…
 * (never send users to a protected route before the token is exchanged).
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { refreshAuthState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const authToken = searchParams.get('authToken');
    const returnPath = searchParams.get('returnPath') ?? '/';

    if (!authToken) {
      navigate('/login?externalError=Unable+to+complete+sign-in.', { replace: true });
      return;
    }

    if (oauthExchangeStartedForToken === authToken) {
      return;
    }
    oauthExchangeStartedForToken = authToken;

    void (async () => {
      try {
        const session = await exchangeAuthToken(authToken);
        await refreshAuthState({ session });
        const dest = resolvePostLoginPath(returnPath, session.roles);
        navigate(dest, { replace: true });
      } catch {
        oauthExchangeStartedForToken = null;
        navigate('/login?externalError=Unable+to+complete+sign-in.', { replace: true });
      }
    })();
  }, [searchParams, refreshAuthState, navigate]);

  return (
    <div className="container text-center mt-5">
      <p>Completing sign-in…</p>
    </div>
  );
}
