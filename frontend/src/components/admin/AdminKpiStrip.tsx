import type { CSSProperties } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';

export interface AdminKpiItem {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  /** Explicit card group for layout control. */
  group?: 'filterable' | 'info';
  /** Bootstrap Icons name without `bi-` prefix (e.g. `people` → `bi-people`). */
  icon?: string;
  /** When provided, the card renders as a clickable button. */
  onClick?: () => void;
  /** Highlights the card as the currently active filter. */
  active?: boolean;
}

const stripStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  rowGap: 12,
  columnGap: 16,
  marginBottom: 24,
};

const baseCardStyle: CSSProperties = {
  flex: '1 1 170px',
  minWidth: 160,
  background: '#fff',
  borderRadius: 12,
  padding: '14px 16px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
};

/** Consistent KPI row for admin pages (no emoji — use optional accent bar). */
export default function AdminKpiStrip({ items }: { items: AdminKpiItem[] }) {
  const filterableItems = items.filter((k) => (k.group ?? (k.onClick ? 'filterable' : 'info')) === 'filterable');
  const infoItems = items.filter((k) => (k.group ?? (k.onClick ? 'filterable' : 'info')) === 'info');

  function renderCard(k: AdminKpiItem, idx: number) {
    const key = `${k.label}-${idx}`;
    const filterBadge = k.onClick ? (
      <span
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          fontSize: 10,
          fontWeight: 700,
          color: '#1E3A5F',
          background: '#E0F2FE',
          border: '1px solid #BAE6FD',
          borderRadius: 999,
          padding: '2px 8px',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        Click to filter
      </span>
    ) : null;

    const inner = (
      <>
        {filterBadge}
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
          key={key}
          type="button"
          onClick={k.onClick}
          style={{
            ...baseCardStyle,
            position: 'relative',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'box-shadow 0.15s, transform 0.15s',
            ...(k.active ? { border: `2px solid ${k.accent ?? '#1E3A5F'}`, boxShadow: `0 0 0 3px ${k.accent ?? '#1E3A5F'}22` } : {}),
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
      <div key={key} style={{ ...baseCardStyle, position: 'relative' }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={stripStyle}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, flex: '2 1 520px' }}>
        {filterableItems.map(renderCard)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, flex: '1 1 340px', justifyContent: 'flex-end' }}>
        {infoItems.map(renderCard)}
      </div>
    </div>
  );
}
