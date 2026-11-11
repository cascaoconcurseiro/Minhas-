import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

/** Compact Minhas Economias wallet mark shared by the app shell and sign-in page. */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b78f2] to-[#1747b6] text-white shadow-sm ${
      size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
    } ${className}`}
  >
    <svg viewBox="0 0 40 40" className={size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'} fill="none">
      <path
        d="M9 13.5h21.5a3.5 3.5 0 0 1 3.5 3.5v12a3 3 0 0 1-3 3H9a4 4 0 0 1-4-4V12a5 5 0 0 1 5-5h18a3.5 3.5 0 0 1 3.5 3.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M25 19h10v8H25a4 4 0 0 1 0-8Z" fill="currentColor" />
      <circle cx="27" cy="23" r="1.25" fill="var(--app-accent)" />
    </svg>
  </span>
);
