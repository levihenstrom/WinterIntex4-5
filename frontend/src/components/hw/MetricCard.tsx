import { useEffect, useRef, useState } from 'react';

interface MetricCardProps {
  target: number;
  suffix?: string;
  prefix?: string;
  label: string;
  duration?: number;
}

export default function MetricCard({
  target,
  suffix = '',
  prefix = '',
  label,
  duration = 2000,
}: MetricCardProps) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const step = Math.ceil(target / (duration / 16));
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(current);
      if (current >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return (
    <div ref={ref} className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="hw-metric-num text-5xl md:text-6xl font-extrabold leading-none text-white">
        {prefix}{count.toLocaleString()}{suffix}
      </span>
      <span className="mt-3 text-xs uppercase tracking-widest font-semibold" style={{ color: '#5eead4' }}>
        {label}
      </span>
    </div>
  );
}
