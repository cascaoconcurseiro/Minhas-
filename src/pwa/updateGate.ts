type UpdateGateOptions = {
  document: Document;
  applyUpdate: () => void | Promise<void>;
  onDeferred?: (deferred: boolean) => void;
};

const EDITABLE_SELECTOR = 'input:not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select';
const EDIT_FORM_SELECTOR = 'form, dialog, [role="dialog"]';

function isVisible(element: HTMLElement) {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden) return false;
    if (current instanceof HTMLDialogElement && !current.open) return false;
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0')) return false;
  }
  return true;
}

function matchesInitialValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    return element.checked === element.defaultChecked;
  }

  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).every((option) => option.selected === option.defaultSelected);
  }

  return element.value === element.defaultValue;
}

export function createPwaUpdateGate({document, applyUpdate, onDeferred}: UpdateGateOptions) {
  const dirtyFields = new Set<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
  let updatePending = false;
  let updateStarted = false;

  const reportState = () => onDeferred?.(updatePending && dirtyFields.size > 0);

  const applyWhenSafe = () => {
    for (const field of dirtyFields) {
      if (!field.isConnected || !isVisible(field)) {
        dirtyFields.delete(field);
      }
    }

    reportState();
    if (updatePending && dirtyFields.size === 0 && !updateStarted) {
      updateStarted = true;
      void Promise.resolve(applyUpdate()).catch(() => {
        updateStarted = false;
      });
    }
  };

  const trackEdit = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(EDITABLE_SELECTOR)) return;
    const field = target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    // Search, filters, and other navigation controls outside an edit surface
    // should never hold a PWA update indefinitely.
    if (!field.closest(EDIT_FORM_SELECTOR)) return;
    if (matchesInitialValue(field)) dirtyFields.delete(field);
    else dirtyFields.add(field);
    applyWhenSafe();
  };

  const onReset = (event: Event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    queueMicrotask(() => {
      for (const field of dirtyFields) {
        if (form.contains(field) && matchesInitialValue(field)) dirtyFields.delete(field);
      }
      applyWhenSafe();
    });
  };

  document.addEventListener('input', trackEdit, true);
  document.addEventListener('change', trackEdit, true);
  document.addEventListener('reset', onReset, true);
  document.addEventListener('close', applyWhenSafe, true);

  const observer = new MutationObserver(applyWhenSafe);
  observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class', 'style', 'open']});

  return {
    updateAvailable() {
      updatePending = true;
      applyWhenSafe();
    },
    destroy() {
      observer.disconnect();
      document.removeEventListener('input', trackEdit, true);
      document.removeEventListener('change', trackEdit, true);
      document.removeEventListener('reset', onReset, true);
      document.removeEventListener('close', applyWhenSafe, true);
    },
  };
}
