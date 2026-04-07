import React from 'react';

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function SectionContainer({
  children,
  className = '',
  style,
}: SectionContainerProps) {
  return (
    <div 
      className={`max-w-7xl mx-auto px-6 lg:px-10 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
