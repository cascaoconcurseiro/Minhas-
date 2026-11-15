import React from 'react';

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

interface DayOfMonthSelectProps {
  id: string;
  value: number;
  onChange: (day: number) => void;
  className?: string;
}

/** Dia do mês (1 a 31) escolhido numa lista: evita o campo vazio virar 0 e o "05" ao digitar. */
export const DayOfMonthSelect: React.FC<DayOfMonthSelectProps> = ({ id, value, onChange, className }) => (
  <select
    id={id}
    value={String(Math.max(1, Math.min(31, Math.trunc(value) || 1)))}
    onChange={(event) => onChange(Number(event.target.value))}
    className={className}
  >
    {DAYS.map((day) => (
      <option key={day} value={String(day)}>{day}</option>
    ))}
  </select>
);
