import { useEffect, useRef, useState } from 'react';

interface MetricCardProps {
  target: number;
  suffix?: string;
  prefix?: string;
  label: string;
  /** Plain-language line for public dashboards (e.g. Impact page). */
  description?: string;
  duration?: number;
  /** When set, show this string instead of animating prefix+target+suffix (e.g. formatted currency). */
  staticDisplay?: string;
}

export default function MetricCard({
  target,
  suffix = '',
  prefix = '',
  label,
  description,
  duration = 2000,
  staticDisplay,
}: MetricCardProps) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isStatic = staticDisplay !== undefined && staticDisplay !== '';

  useEffect(() => {
    if (isStatic) return;
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started, isStatic]);

  useEffect(() => {
    if (isStatic || !started) return;
    if (safeTarget === 0) {
      setCount(0);
      return;
    }
    const step = Math.max(1, Math.ceil(safeTarget / (duration / 16)));
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, safeTarget);
      setCount(current);
      if (current >= safeTarget) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [started, safeTarget, duration, isStatic]);

  return (
    <div ref={ref} className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span
        className="hw-metric-num font-extrabold leading-none text-white"
        style={
          isStatic
            ? { fontSize: 'clamp(1.25rem, 3.5vw, 2.25rem)', lineHeight: 1.2, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }
            : undefined
        }
      >
        {isStatic ? (
          staticDisplay
        ) : (
          <span className="text-5xl md:text-6xl">
            {prefix}{count.toLocaleString()}{suffix}
          </span>
        )}
      </span>
      <span className="mt-3 text-xs uppercase tracking-widest font-semibold" style={{ color: '#5eead4' }}>
        {label}
      </span>
      {description && (
        <p className="mt-2 mb-0 max-w-[14rem] mx-auto text-[0.65rem] leading-snug font-normal normal-case tracking-normal text-white/55">
          {description}
        </p>
      )}
    </div>
  );
}
