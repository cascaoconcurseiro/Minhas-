import { useEffect } from 'react';

export interface TipRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const GAP = 8;
const EDGE = 8;

/** Posição do balão: acima do elemento, centralizado; vai para baixo se faltar espaço e nunca sai da tela. */
export function computeTooltipPosition(
  anchor: TipRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number }
): { left: number; top: number } {
  const centered = anchor.left + anchor.width / 2 - tip.width / 2;
  const left = Math.max(EDGE, Math.min(centered, viewport.width - tip.width - EDGE));
  const above = anchor.top - tip.height - GAP;
  const top = above >= EDGE ? above : Math.min(anchor.top + anchor.height + GAP, viewport.height - tip.height - EDGE);
  return { left, top: Math.max(EDGE, top) };
}

/**
 * Balão de dica instantâneo para todo o app. O `title` nativo do navegador só aparece depois de ~1 s e esse
 * atraso não é configurável; aqui qualquer elemento com `title` ganha um balão imediato, no mouse e no foco do
 * teclado. O `title` é guardado em `data-tip` enquanto o balão está aberto (para o navegador não mostrar o dele)
 * e devolvido ao fechar, mantendo o nome acessível do elemento.
 */
export function InstantTooltip() {
  useEffect(() => {
    const tip = document.createElement('div');
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('data-testid', 'instant-tooltip');
    tip.className =
      'pointer-events-none fixed z-[200] hidden max-w-[min(20rem,calc(100vw-1rem))] whitespace-pre-line rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg dark:bg-slate-100 dark:text-slate-900';
    document.body.append(tip);

    let current: HTMLElement | null = null;

    const hide = () => {
      if (current) {
        const saved = current.getAttribute('data-tip');
        if (saved !== null && !current.hasAttribute('title')) current.setAttribute('title', saved);
        current.removeAttribute('data-tip');
        current.removeAttribute('aria-describedby');
        current = null;
      }
      tip.classList.add('hidden');
    };

    const show = (el: HTMLElement) => {
      if (el === current) return;
      hide();
      const text = el.getAttribute('title');
      if (!text || !text.trim()) return;
      el.setAttribute('data-tip', text);
      el.removeAttribute('title');
      tip.id = tip.id || 'instant-tooltip-box';
      el.setAttribute('aria-describedby', tip.id);
      current = el;
      tip.textContent = text;
      tip.classList.remove('hidden');
      const rect = el.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const { left, top } = computeTooltipPosition(
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight }
      );
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };

    const findTarget = (node: EventTarget | null): HTMLElement | null =>
      node instanceof Element ? node.closest<HTMLElement>('[title]:not([title=""])') : null;

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return; // toque não tem "passar o mouse"
      const target = findTarget(event.target);
      if (target) show(target);
      else if (current && !(event.target instanceof Node && current.contains(event.target))) hide();
    };
    const onOut = (event: PointerEvent) => {
      if (current && !(event.relatedTarget instanceof Node && current.contains(event.relatedTarget))) hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = findTarget(event.target);
      if (target) show(target);
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);

    return () => {
      hide();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('keydown', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
      tip.remove();
    };
  }, []);

  return null;
}
