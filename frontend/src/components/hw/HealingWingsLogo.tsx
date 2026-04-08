import React from 'react';

interface HealingWingsLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default function HealingWingsLogo({
  size = 120,
  className,
  style,
}: HealingWingsLogoProps) {
  return (
    <img
      src="/wingslogo.png"
      alt="HealingWings logo"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain', ...style }}
    />
  );
}
