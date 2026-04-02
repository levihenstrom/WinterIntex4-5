import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../lib/authAPI';

function LogoutPage() {
  const navigate = useNavigate();
  const { refreshAuthState } = useAuth();

  useEffect(() => {
    async function performLogout() {
      try {
        await logoutUser();
      } catch {
        // Ignore logout errors
      }
      await refreshAuthState();
      navigate('/login');
    }

    void performLogout();
  }, [navigate, refreshAuthState]);

  return (
    <div className="container mt-4 text-center">
      <p>Signing out...</p>
    </div>
  );
}

export default LogoutPage;
