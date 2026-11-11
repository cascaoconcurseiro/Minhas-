import React from 'react';
import type { CreditCard } from '../types/finance';
import { CardNetworkMark } from './CardNetworkMark';

interface CreditCardFaceProps {
  card: Pick<CreditCard, 'name' | 'brand' | 'color'>;
  size?: 'compact' | 'standard';
}

/** Decorative card face using the account's saved color and its real card network. */
export const CreditCardFace: React.FC<CreditCardFaceProps> = ({
  card,
  size = 'standard',
}) => {
  const compact = size === 'compact';

  return (
    <div
      aria-hidden="true"
      className={`relative isolate flex w-full flex-col justify-between overflow-hidden bg-slate-900 text-white shadow-md ${
        compact ? 'h-12 w-[4.75rem] shrink-0 rounded-lg p-2 sm:h-14 sm:w-24' : 'h-28 rounded-xl p-4'
      }`}
      style={{
        background: `linear-gradient(125deg, color-mix(in srgb, ${card.color || '#1e293b'} 38%, #0f172a) 0%, #0f172a 82%)`,
      }}
    >
      {!compact && (
        <div className="pointer-events-none absolute right-[-1.75rem] top-[-2.5rem] z-0 h-32 w-32 rounded-full bg-white/10 blur-xl" />
      )}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className={`max-w-[75%] truncate font-bold tracking-wide text-white/90 ${compact ? 'text-[8px] sm:text-[9px]' : 'text-xs'}`}>
          {card.name}
        </span>
        {!compact && (
          <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/90">
            CRÉDITO
          </span>
        )}
      </div>
      <div className="relative z-10 flex items-end justify-between">
        <span className={`inline-flex items-center justify-center rounded-md border border-amber-200/70 bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 shadow-inner ${compact ? 'h-2.5 w-3.5 rounded-[2px]' : 'h-7 w-9'}`}>
          {!compact && <span className="h-4 w-5 rounded-[3px] border border-amber-700/60 bg-amber-300/40" />}
        </span>
        {compact ? (
          <span className="text-[8px] font-black italic tracking-tight text-white">
            {card.brand === 'Mastercard' ? 'MC' : card.brand === 'Visa' ? 'VISA' : 'elo'}
          </span>
        ) : (
          <CardNetworkMark brand={card.brand} className="!text-white [&_span]:!text-white" />
        )}
      </div>
    </div>
  );
};
