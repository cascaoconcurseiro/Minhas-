import React from 'react';
import type { CreditCard } from '../types/finance';

interface CardNetworkMarkProps {
  brand: CreditCard['brand'];
  compact?: boolean;
  className?: string;
}

/** Small local network wordmark for cards already registered in the workspace. */
export const CardNetworkMark: React.FC<CardNetworkMarkProps> = ({ brand, compact = false, className = '' }) => {
  if (brand === 'Mastercard') {
    return (
      <span role="img" className={`inline-flex items-center ${compact ? '' : 'gap-1.5'} ${className}`} aria-label="Mastercard">
        <span className="inline-flex -space-x-1" aria-hidden="true">
          <span className={`${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} rounded-full bg-[#eb001b]`} />
          <span className={`${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} rounded-full bg-[#f79e1b]/95`} />
        </span>
        {!compact && <span className="text-[10px] font-bold tracking-tight text-slate-600 dark:text-slate-300">mastercard</span>}
      </span>
    );
  }

  if (brand === 'Visa') {
    return (
      <span role="img" className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black italic tracking-tight text-blue-800 dark:text-blue-300 ${className}`} aria-label="Visa">
        VISA
      </span>
    );
  }

  return (
    <span role="img" className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black italic tracking-tight text-sky-600 dark:text-sky-300 ${className}`} aria-label="Elo">
      elo
    </span>
  );
};
