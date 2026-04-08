import type { CSSProperties } from 'react';

type Size = 'compact' | 'section';

function spinnerStyle(size: Size): CSSProperties {
  const dim = size === 'compact' ? 20 : 34;
  const border = size === 'compact' ? 3 : 4;
  return {
    width: dim,
    height: dim,
    borderRadius: '50%',
    border: `${border}px solid #cbd5e1`,
    borderTopColor: '#1E3A5F',
    animation: 'hw-spin 0.9s linear infinite',
  };
}

export function LoadingState({ message = 'Loading…', size = 'section' }: { message?: string; size?: Size }) {
  const wrapperStyle: CSSProperties =
    size === 'compact'
      ? { display: 'flex', alignItems: 'center', gap: 10, color: '#64748B', fontSize: 13 }
      : {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '40px 16px',
          color: '#64748B',
          fontSize: 14,
        };

  return (
    <div role="status" aria-live="polite" style={wrapperStyle}>
      <span style={spinnerStyle(size)} aria-hidden="true" />
      <span>{message}</span>
      <style>{`
        @keyframes hw-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        borderRadius: 12,
        padding: '12px 14px',
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        color: '#991B1B',
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}
