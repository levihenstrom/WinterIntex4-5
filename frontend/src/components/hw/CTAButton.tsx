import React from 'react';

type Variant = 'primary' | 'ghost' | 'coral';

interface CTAButtonProps {
  variant?: Variant;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  as?: 'button' | 'a';
  href?: string;
}

const variantClasses: Record<Variant, string> = {
  primary: 'hw-btn-glass text-white font-semibold',
  ghost: 'hw-btn-ghost font-semibold',
  coral: 'hw-btn-coral font-semibold rounded-full',
};

export default function CTAButton({
  variant = 'primary',
  children,
  onClick,
  className = '',
  as: Tag = 'button',
  href,
}: CTAButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-sm tracking-wide cursor-pointer';
  const cls = `${base} ${variantClasses[variant]} ${className}`;

  if (Tag === 'a') {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }

  return (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
