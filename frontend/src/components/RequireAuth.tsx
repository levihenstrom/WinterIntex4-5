import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
  /** If provided, user must have at least one of these roles or be redirected to /unauthorized */
  role?: string | string[];
}

/**
 * Wraps a route so unauthenticated users are sent to /login.
 * If `role` is specified, users without that role see a 403 page instead.
 * `role` accepts a single string or an array — the user needs ANY one of them.
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

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    const hasRole = allowed.some((r) => authSession.roles.includes(r));
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
