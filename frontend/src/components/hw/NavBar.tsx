import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home', hash: '#hero' },
  { label: 'About', hash: '#mission' },
  { label: 'Impact', hash: '#impact' },
  { label: 'Stories', hash: '#stories' },
  { label: 'Donate', hash: '#donate' },
  { label: 'Contact', hash: '#footer' },
];

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authSession, isLoading } = useAuth();
  const isHome = location.pathname === '/';

  /** Section anchors only exist on `/`; from other routes link to `/#section`. */
  function sectionHref(hash: string) {
    return isHome ? hash : `/${hash}`;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 shadow-sm bg-[#1E3A5F]/75 backdrop-blur-xl border-b border-white/20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-16 lg:h-18">

        {/* Logo */}
        <a href={sectionHref('#hero')} className="flex items-center gap-2 no-underline flex-shrink-0">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M14 26C14 26 3 19 3 11C3 7.13 6.13 4 10 4C11.9 4 13.6 4.78 14 5C14.4 4.78 16.1 4 18 4C21.87 4 25 7.13 25 11C25 19 14 26 14 26Z" fill="#0D9488" opacity="0.9" />
            <path d="M14 26C14 26 7 17 7 11C7 8.24 9.24 6 12 6C13.1 6 14 6.45 14 6.45V26Z" fill="#5eead4" opacity="0.5" />
          </svg>
          <span className="font-bold text-lg text-white tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
            HealingWings
          </span>
        </a>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={sectionHref(link.hash)}
              className="text-sm font-medium text-white/75 hover:text-white transition-colors no-underline"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop: account or auth CTAs */}
        <div className="hidden lg:flex items-center gap-3 min-w-0">
          {isLoading ? null : isAuthenticated ? (
            <>
              <span className="text-sm text-white/70 truncate max-w-[180px]">
                {authSession.email}
              </span>
              {authSession.roles[0] && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  {authSession.roles[0]}
                </span>
              )}
              <button
                type="button"
                onClick={() => navigate('/logout')}
                className="hw-nav-login px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
              >
                Sign Out
              </button>
            </>
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
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={sectionHref(link.hash)}
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-white/75 hover:text-white font-medium text-sm border-b border-white/10 no-underline transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-5 flex flex-col gap-3">
            {isLoading ? null : isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <p className="text-sm text-white/70 truncate">{authSession.email}</p>
                  {authSession.roles[0] && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30 flex-shrink-0">
                      {authSession.roles[0]}
                    </span>
                  )}
                </div>
                <Link
                  to="/mfa"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center py-3 rounded-full text-sm font-semibold text-white/90 border border-white/30 no-underline"
                >
                  MFA
                </Link>
                <Link
                  to="/logout"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center py-3 rounded-full text-sm font-semibold text-white/90 border border-white/30 no-underline"
                >
                  Logout
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate('/login'); }}
                  className="hw-nav-login w-full py-3 rounded-full text-sm font-semibold cursor-pointer"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); navigate('/register'); }}
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
