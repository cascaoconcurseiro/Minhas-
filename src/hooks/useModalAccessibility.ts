import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]';

function visibleFocusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement
  );
}

function topDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR));
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
}

/**
 * Acessibilidade comum a todas as janelas (role="dialog" aria-modal): ao abrir, o foco entra na janela; Tab não sai
 * dela; Esc fecha (pelo botão de fechar da própria janela); ao fechar, o foco volta para onde estava.
 */
export function useModalAccessibility(): void {
  useEffect(() => {
    const returnTargets = new WeakMap<HTMLElement, HTMLElement | null>();
    let known = new Set<HTMLElement>();

    const sync = () => {
      const current = new Set(Array.from(document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)));
      for (const dialog of current) {
        if (known.has(dialog)) continue;
        returnTargets.set(dialog, document.activeElement instanceof HTMLElement ? document.activeElement : null);
        window.setTimeout(() => {
          if (!dialog.isConnected || dialog.contains(document.activeElement)) return;
          // Primeiro campo de texto da janela; se não houver, o primeiro controle
          // No celular não abre o teclado sozinho: o foco vai para a própria janela
          if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
            if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
            dialog.focus({ preventScroll: true });
            return;
          }
          const field = dialog.querySelector<HTMLElement>('input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), textarea');
          (field ?? visibleFocusables(dialog)[0] ?? dialog).focus({ preventScroll: true });
        }, 60);
      }
      for (const dialog of known) {
        if (current.has(dialog)) continue;
        const target = returnTargets.get(dialog);
        if (target && target.isConnected && !topDialog()) target.focus({ preventScroll: true });
      }
      known = current;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = topDialog();
      if (!dialog) return;
      if (event.key === 'Tab') {
        const items = visibleFocusables(dialog);
        if (items.length === 0) {
          event.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !dialog.contains(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === 'Escape' && !event.defaultPrevented) {
        const closeButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
          /^(fechar|close|cancelar|concluído|concluido)\b/i.test(
            (button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '').trim()
          )
        );
        if (closeButton) {
          event.preventDefault();
          closeButton.click();
        }
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', onKeyDown);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
