import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

/** Logo oficial do Minhas Economias, usada no menu e na tela de entrada. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', className = '' }) => (
  <img
    src="/brand-mark.png"
    alt=""
    aria-hidden="true"
    draggable={false}
    width={size === 'sm' ? 32 : 40}
    height={size === 'sm' ? 32 : 40}
    className={`inline-block shrink-0 select-none rounded-[22%] shadow-sm ${
      size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
    } ${className}`}
  />
);
