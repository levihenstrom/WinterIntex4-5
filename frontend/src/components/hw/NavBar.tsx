import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import 'bootstrap-icons/font/bootstrap-icons.css';

const NAV_LINKS = [
  { label: 'Home', hash: '#hero' },
  { label: 'About', hash: '#mission' },
  { label: 'Donate', hash: '#donate' },
  { label: 'Impact', to: '/impact' },
  { label: 'Stories', to: '/stories' },
];

const ADMIN_NAV_LINKS = [
  { label: 'Home', to: '/admin/home' },
  { label: 'Donations', to: '/admin/donations' },
  { label: 'Residents', to: '/admin/residents' },
  { label: 'Social Media', to: '/admin/social-media' },
  { label: 'Reports', to: '/admin/reports' },
];

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authSession, isLoading } = useAuth();
  const isHome = location.pathname === '/';
  const isAdminPortalUser =
    authSession.roles.includes('Admin') || authSession.roles.includes('Staff');
  const isAdmin = authSession.roles.includes('Admin');

  /** Section anchors only exist on `/`; from other routes link to `/#section`. */
  function sectionHref(hash: string) {
    return isHome ? hash : `/${hash}`;
  }

  /** Close dropdown when clicking outside */
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  /** Toggle dark mode on <html> */
  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  }

  // ── Dropdown menu (desktop) ─────────────────────────────────────────────────
  const dropdownMenu = dropdownOpen && (
    <div className="absolute right-0 top-[calc(100%+8px)] bg-white/95 backdrop-blur-3xl rounded-2xl shadow-[0_16px_50px_rgba(30,58,95,0.15)] min-w-[250px] z-[3000] overflow-hidden border border-stone-200/60 p-1.5 flex flex-col hw-fade-in translate-y-1 transition-all duration-300">
      {/* Email header */}
      <div className="px-4 py-3.5 border-b border-stone-100 bg-stone-50/50 rounded-xl mb-1.5">
        <p className="m-0 text-[9px] text-stone-400 font-extrabold uppercase tracking-[0.15em]">Signed in as</p>
        <p className="mt-0.5 mb-0 text-xs text-[#1E3A5F] font-bold break-all tracking-tight">{authSession.email}</p>
      </div>

      {/* Dark / Light mode toggle */}
      <button
        type="button"
        onClick={toggleDarkMode}
        className="w-full bg-transparent border-none cursor-pointer px-4 py-2.5 flex items-center gap-3 text-[13px] text-[#1E3A5F] font-semibold text-left rounded-xl hover:bg-stone-50 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 text-stone-600">
          <i className={`bi ${darkMode ? 'bi-sun-fill text-[#D97706]' : 'bi-moon-stars-fill text-[#1E3A5F]'} text-[13px]`} />
        </span>
        <span className="flex-1">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        {/* Toggle pill */}
        <span className={`relative inline-flex items-center w-[30px] h-[16px] rounded-full transition-colors flex-shrink-0 ${darkMode ? 'bg-[#0D9488]' : 'bg-stone-300'}`}>
          <span className={`absolute left-[2px] w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-all duration-300 ${darkMode ? 'translate-x-[14px]' : 'translate-x-0'}`} />
        </span>
      </button>

      {/* User Manager — Admin only */}
      {isAdmin && (
        <Link
          to="/admin/user-manager"
          onClick={() => setDropdownOpen(false)}
          className="w-full bg-transparent border-none cursor-pointer px-4 py-2.5 flex items-center gap-3 text-[13px] text-[#1E3A5F] font-semibold text-left rounded-xl hover:bg-violet-50 transition-colors no-underline"
        >
          <span className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-[#6B21A8]">
            <i className="bi bi-shield-lock-fill text-[13px]" />
          </span>
          User Manager
        </Link>
      )}

      <div className="h-[1px] bg-stone-100 my-1 mx-2" />

      {/* Log Out */}
      <button
        type="button"
        onClick={() => {
          setDropdownOpen(false);
          navigate('/logout');
        }}
        className="group w-full bg-transparent border-none cursor-pointer px-4 py-2.5 flex items-center gap-3 text-[13px] text-red-600 font-bold text-left rounded-xl hover:bg-red-50 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-red-50 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600 transition-colors">
          <i className="bi bi-box-arrow-right text-[13px]" />
        </span>
        Log Out
      </button>
    </div>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 shadow-sm bg-[#1E3A5F]/75 backdrop-blur-xl border-b border-white/20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-16 lg:h-18">

        {/* Logo */}
        <a
          href={isAdminPortalUser ? '/' : sectionHref('#hero')}
          className="flex items-center gap-2 no-underline flex-shrink-0"
        >
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path
              d="M14 26C14 26 3 19 3 11C3 7.13 6.13 4 10 4C11.9 4 13.6 4.78 14 5C14.4 4.78 16.1 4 18 4C21.87 4 25 7.13 25 11C25 19 14 26 14 26Z"
              fill="#0D9488"
              opacity="0.9"
            />
            <path
              d="M14 26C14 26 7 17 7 11C7 8.24 9.24 6 12 6C13.1 6 14 6.45 14 6.45V26Z"
              fill="#5eead4"
              opacity="0.5"
            />
          </svg>
          <span
            className="font-bold text-lg text-white tracking-tight"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            HealingWings
          </span>
        </a>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-7">
          {isAdminPortalUser ? (
            ADMIN_NAV_LINKS.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) =>
                  'text-sm font-medium no-underline transition-colors ' +
                  (isActive ? 'text-white' : 'text-white/75 hover:text-white')
                }
              >
                {link.label}
              </NavLink>
            ))
          ) : (
            NAV_LINKS.map((link) =>
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-sm font-medium text-white/75 hover:text-white transition-colors no-underline"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={sectionHref(link.hash!)}
                  className="text-sm font-medium text-white/75 hover:text-white transition-colors no-underline"
                >
                  {link.label}
                </a>
              )
            )
          )}
        </nav>

        {/* Desktop: account or auth CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          {isLoading ? null : isAuthenticated ? (
            /* ── Teal avatar icon + dropdown ── */
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                aria-label="Account menu"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <i
                  className="bi bi-person-circle"
                  style={{
                    fontSize: '2rem',
                    color: '#0D9488',
                    filter: 'drop-shadow(0 0 6px rgba(13,148,136,0.45))',
                    transition: 'filter 0.2s',
                  }}
                />
              </button>
              {dropdownMenu}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="hw-nav-login px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="hw-nav-signup px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden p-2 text-white"
          aria-label="Menu"
        >
          <svg
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {menuOpen ? (
              <>
                <line x1="4" y1="4" x2="20" y2="20" />
                <line x1="20" y1="4" x2="4" y2="20" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/20 px-6 py-4 bg-[#1E3A5F]/75 backdrop-blur-xl">
          {isAdminPortalUser ? (
            ADMIN_NAV_LINKS.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  'block py-3 font-medium text-sm border-b border-white/10 no-underline transition-colors ' +
                  (isActive ? 'text-white' : 'text-white/75 hover:text-white')
                }
              >
                {link.label}
              </NavLink>
            ))
          ) : (
            NAV_LINKS.map((link) =>
              link.to ? (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3 text-white/75 hover:text-white font-medium text-sm border-b border-white/10 no-underline transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={sectionHref(link.hash!)}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3 text-white/75 hover:text-white font-medium text-sm border-b border-white/10 no-underline transition-colors"
                >
                  {link.label}
                </a>
              )
            )
          )}

          {/* Mobile account section */}
          <div className="mt-5 flex flex-col gap-1">
            {isLoading ? null : isAuthenticated ? (
              <>
                {/* Email */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 mb-1.5 border border-white/5 shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)]">
                  <p className="m-0 text-[10px] text-white/50 font-extrabold uppercase tracking-[0.15em]">Signed in as</p>
                  <p className="mt-1 mb-0 text-sm text-white font-semibold break-all tracking-tight">{authSession.email}</p>
                </div>

                {/* Dark mode toggle */}
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="w-full bg-white/5 border border-transparent rounded-xl cursor-pointer p-3.5 flex items-center gap-3 text-[13px] text-white font-medium text-left hover:bg-white/10 transition-colors mb-1.5"
                >
                  <i className={`bi ${darkMode ? 'bi-sun-fill text-[#D97706]' : 'bi-moon-stars-fill text-teal-400'} text-[15px]`} />
                  <span className="flex-1">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                  <span className={`relative inline-flex items-center w-[32px] h-[18px] rounded-full transition-colors ${darkMode ? 'bg-[#0D9488]' : 'bg-white/30'}`}>
                    <span className={`absolute left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-300 ${darkMode ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                  </span>
                </button>

                {/* User Manager — Admin only */}
                {isAdmin && (
                  <Link
                    to="/admin/user-manager"
                    onClick={() => setMenuOpen(false)}
                    className="w-full bg-white/5 border border-transparent rounded-xl p-3.5 flex items-center gap-3 text-[13px] text-white font-medium text-left hover:bg-violet-900/40 transition-colors mb-1.5 no-underline border-l-[3px] border-l-violet-400"
                  >
                    <i className="bi bi-shield-lock-fill text-[15px] text-violet-300" />
                    User Manager
                  </Link>
                )}

                {/* Log Out */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/logout');
                  }}
                  className="w-full bg-red-900/20 border border-red-500/20 rounded-xl cursor-pointer p-3.5 flex items-center gap-3 text-[13px] text-red-300 font-bold text-left hover:bg-red-900/40 transition-colors mt-2"
                >
                  <i className="bi bi-box-arrow-right text-[15px]" />
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/login');
                  }}
                  className="hw-nav-login w-full py-3 rounded-full text-sm font-semibold cursor-pointer"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/register');
                  }}
                  className="hw-nav-signup w-full py-3 rounded-full text-sm font-semibold cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
