import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import HealingWingsLogo from './HealingWingsLogo';

const SOCIAL_LINKS = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/accounts/login/',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/login/',
    icon: (
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 2H15C13.67 2 12 3.67 12 5V8H9V12H12V22H16V12H19L20 8H16V5C16 4.45 16.45 4 17 4H20V2H18Z" />
      </svg>
    ),
  },
  {
    name: 'X',
    href: 'https://x.com/i/flow/login',
    icon: (
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/login',
    icon: (
      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 8A6 6 0 0 1 22 14V21H18V14A2 2 0 0 0 14 14V21H10V9H14V11.5C14.7 10.5 15.85 9 17.5 9C18.5 9 16 8 16 8ZM6 21H2V9H6V21ZM4 7C2.9 7 2 6.1 2 5C2 3.9 2.9 3 4 3C5.1 3 6 3.9 6 5C6 6.1 5.1 7 4 7Z" />
      </svg>
    ),
  },
];

// Use { pathname, hash } so React Router handles navigation client-side
// and ScrollToTop in App.tsx can detect the hash and scroll correctly.
const QUICK_LINKS = [
  { label: 'Home',     to: { pathname: '/', hash: '' } },
  { label: 'About Us', to: { pathname: '/', hash: '#mission' } },
  { label: 'Impact',   to: { pathname: '/impact', hash: '' } },
];

const GET_INVOLVED_LINKS = [
  { label: 'Donate',    to: { pathname: '/', hash: '#donate' } },
  { label: 'Volunteer', to: { pathname: '/volunteer', hash: '' } },
];

export default function Footer() {
  const { authSession } = useAuth();
  const isStaff = authSession.roles.includes('Admin') || authSession.roles.includes('Staff');

  return (
    <footer id="footer" style={{ background: '#1E3A5F' }} className="text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Col 1: Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HealingWingsLogo size={22} />
              <span className="font-bold text-base text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                HealingWings
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Restoring hope. Rebuilding lives. — Serving girls who are survivors of trafficking and abuse in the Philippines.
            </p>
            {!isStaff && (
              <div className="flex gap-4">
                {SOCIAL_LINKS.map(({ name, href, icon }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="text-white/40 no-underline transition-colors"
                    style={{ transition: 'color 0.2s' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#0D9488')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '')}
                  >
                    {icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-widest mb-2">Quick Links</h4>
            <ul className="space-y-3">
              {QUICK_LINKS.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-white/50 text-sm no-underline hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Get Involved */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-widest mb-2">Get Involved</h4>
            <ul className="space-y-3">
              {GET_INVOLVED_LINKS.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-white/50 text-sm no-underline hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-widest mb-2">Contact</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:info@healingwings.org" className="text-white/50 text-sm no-underline transition-colors hover:text-white">
                  info@healingwings.org
                </a>
              </li>
              <li>
                <span className="text-white/50 text-sm">+1 (276) 266-6654</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Teal divider */}
        <div className="border-t mb-6" style={{ borderColor: '#0D9488', opacity: 0.5 }} />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/35">
          <p>© {new Date().getFullYear()} HealingWings. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-white/70 no-underline transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
