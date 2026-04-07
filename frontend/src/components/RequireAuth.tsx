import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
  /** If provided, user must have this role or be redirected to /unauthorized */
  role?: string;
}

/**
 * Wraps a route so unauthenticated users are sent to /login.
 * If `role` is specified, users without that role see a 403 page instead.
 */
export default function RequireAuth({ children, role }: RequireAuthProps) {
  const { isAuthenticated, isLoading, authSession } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="container text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && !authSession.roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
