const NON_RETURNABLE_PATHS = new Set([
  '/login',
  '/register',
  '/logout',
  '/oauth/callback',
]);

export function getDefaultPathForRoles(roles: string[]): string {
  if (roles.includes('Admin') || roles.includes('Staff')) {
    return '/admin/home';
  }

  if (roles.includes('Donor') || roles.includes('LegacyCustomer')) {
    return '/donor/dashboard';
  }

  // On native (Capacitor) there's no public landing page — fall back to login
  if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
    return '/login';
  }
  return '/';
}

export function resolvePostLoginPath(pathname: string | null | undefined, roles: string[]): string {
  if (pathname && pathname !== '/' && !NON_RETURNABLE_PATHS.has(pathname)) {
    return pathname;
  }

  return getDefaultPathForRoles(roles);
}
