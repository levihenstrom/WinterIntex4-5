import type { CSSProperties } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';

export interface AdminKpiItem {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  /** Bootstrap Icons name without `bi-` prefix (e.g. `people` → `bi-people`). */
  icon?: string;
  /** When provided, the card renders as a clickable button. */
  onClick?: () => void;
}

const stripStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 24,
};

const baseCardStyle: CSSProperties = {
  flex: '1 1 140px',
  background: '#fff',
  borderRadius: 12,
  padding: '14px 16px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
};

/** Consistent KPI row for admin pages (no emoji — use optional accent bar). */
export default function AdminKpiStrip({ items }: { items: AdminKpiItem[] }) {
  return (
    <div style={stripStyle}>
      {items.map((k) => {
        const inner = (
          <>
            {k.icon ? (
              <div style={{ fontSize: 20, marginBottom: 8, color: k.accent ?? '#64748B', lineHeight: 1 }}>
                <i className={`bi bi-${k.icon}`} aria-hidden />
              </div>
            ) : k.accent ? (
              <div
                style={{
                  width: 36,
                  height: 3,
                  borderRadius: 2,
                  background: k.accent,
                  marginBottom: 10,
                }}
              />
            ) : null}
            <div style={{ fontSize: 22, fontWeight: 700, color: k.accent ?? '#1E3A5F', lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginTop: 6 }}>{k.label}</div>
            {k.sub ? <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{k.sub}</div> : null}
          </>
        );

        if (k.onClick) {
          return (
            <button
              key={k.label}
              type="button"
              onClick={k.onClick}
              style={{
                ...baseCardStyle,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'box-shadow 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${k.accent ?? '#1E3A5F'}22`;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = baseCardStyle.boxShadow as string;
                (e.currentTarget as HTMLElement).style.transform = '';
              }}
            >
              {inner}
            </button>
          );
        }

        return (
          <div key={k.label} style={baseCardStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
