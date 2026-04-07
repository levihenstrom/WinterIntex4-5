import type { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

export type AdminSectionTabItem = {
  to: string;
  label: string;
  end?: boolean;
  /** Bootstrap Icons class, e.g. `bi-people` */
  icon?: string;
};

const navStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
  borderBottom: '1px solid #E2E8F0',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  listStyle: 'none',
  margin: 0,
  padding: '12px 0',
  alignItems: 'center',
};

const baseLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  color: '#64748B',
  textDecoration: 'none',
  border: '1px solid transparent',
  transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
};

const activeLink: CSSProperties = {
  color: '#1E3A5F',
  background: '#fff',
  borderColor: '#CBD5E1',
  boxShadow: '0 2px 8px rgba(30, 58, 95, 0.08)',
};

/** Secondary nav for admin sub-routes (donations, caseload, social). */
export default function AdminSectionTabs({ tabs }: { tabs: AdminSectionTabItem[] }) {
  if (tabs.length === 0) return null;

  return (
    <nav style={navStyle} aria-label="Section">
      <div className="container">
        <ul style={listStyle}>
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                style={({ isActive }) => ({
                  ...baseLink,
                  ...(isActive ? activeLink : {}),
                })}
              >
                {({ isActive }) => (
                  <>
                    {tab.icon ? (
                      <i
                        className={`bi ${tab.icon}`}
                        style={{ fontSize: 16, opacity: isActive ? 1 : 0.75 }}
                        aria-hidden
                      />
                    ) : null}
                    <span>{tab.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        nav[aria-label="Section"] a:focus-visible {
          outline: 2px solid #0D9488;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          nav[aria-label="Section"] a {
            transition: none;
          }
        }
      `}</style>
    </nav>
  );
}
