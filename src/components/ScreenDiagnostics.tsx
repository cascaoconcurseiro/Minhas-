import React, { useEffect, useRef, useState } from 'react';

interface Reading {
  mode: string;
  screen: string;
  window: string;
  visual: string;
  safeTop: number;
  safeBottom: number;
  gap: number;
}

function readScreen(probe: HTMLElement | null): Reading {
  const standalone =
    (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  const style = probe ? getComputedStyle(probe) : null;
  const safeTop = style ? parseFloat(style.paddingTop) || 0 : 0;
  const safeBottom = style ? parseFloat(style.paddingBottom) || 0 : 0;
  const visualHeight = window.visualViewport?.height ?? window.innerHeight;
  return {
    mode: standalone ? 'App instalado' : 'Navegador',
    screen: `${window.screen.width} × ${window.screen.height}`,
    window: `${window.innerWidth} × ${window.innerHeight}`,
    visual: `${Math.round(visualHeight)}`,
    safeTop,
    safeBottom,
    gap: Math.round(window.screen.height - window.innerHeight),
  };
}

/** Medidas da tela do aparelho, para conferir problemas de layout no celular. */
export const ScreenDiagnostics: React.FC = () => {
  const probeRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    const update = () => setReading(readScreen(probeRef.current));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const rows: Array<[string, string]> = reading
    ? [
        ['Como está aberto', reading.mode],
        ['Tela do aparelho', reading.screen],
        ['Área do app', reading.window],
        ['Altura visível', reading.visual],
        ['Margem segura (topo / base)', `${reading.safeTop} / ${reading.safeBottom}`],
        ['Tela menos área do app', `${reading.gap}`],
      ]
    : [];

  return (
    <section
      aria-label="Diagnóstico da tela"
      data-testid="screen-diagnostics"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
    >
      <div
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      />
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Medidas da tela</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Se algo estiver cortado ou sobrando na tela do celular, tire um print desta lista e envie.
      </p>
      <dl className="grid grid-cols-1 gap-1.5 text-xs font-mono">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="font-bold text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
