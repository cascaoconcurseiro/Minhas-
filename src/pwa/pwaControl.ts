/**
 * Controle da atualização do app: guarda o registro do service worker e a função que aplica a versão
 * nova, para a tela poder buscar e aplicar a atualização na hora, sem esperar o ciclo automático.
 */

export interface AppBuildInfo {
  sha: string;
  builtAt: string;
}

export function getAppBuild(): AppBuildInfo {
  try {
    return typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : { sha: 'local', builtAt: '' };
  } catch {
    return { sha: 'local', builtAt: '' };
  }
}

export type UpdateCheckResult = 'updating' | 'latest' | 'unsupported' | 'offline';

interface PwaControlState {
  registration?: ServiceWorkerRegistration;
  applyUpdate?: () => Promise<void>;
  updatePending: boolean;
  listeners: Set<() => void>;
}

const state: PwaControlState = { updatePending: false, listeners: new Set() };

export function registerPwaControl(parts: { registration?: ServiceWorkerRegistration; applyUpdate?: () => Promise<void> }): void {
  if (parts.registration) state.registration = parts.registration;
  if (parts.applyUpdate) state.applyUpdate = parts.applyUpdate;
}

/** Chamada quando o navegador terminou de baixar uma versão nova e ela está esperando para entrar. */
export function markUpdatePending(): void {
  state.updatePending = true;
  state.listeners.forEach((listener) => listener());
}

export function isUpdatePending(): boolean {
  return state.updatePending;
}

/** Avisa quando uma versão nova ficar pronta. Devolve a função para cancelar. */
export function subscribeUpdatePending(listener: () => void): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/** Resolve quando uma versão nova ficar pronta (true) ou o tempo acabar (false). */
function waitForPending(timeoutMs: number): Promise<boolean> {
  if (state.updatePending) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      window.clearTimeout(timer);
      state.listeners.delete(onPending);
      resolve(value);
    };
    const onPending = () => finish(true);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    state.listeners.add(onPending);
  });
}

/**
 * Procura uma versão nova agora. Se houver, aplica na hora (a página recarrega) e devolve 'updating'.
 * Chamada só por ação da pessoa (botão), então não espera o momento "seguro" do ciclo automático.
 */
export async function checkAndApplyUpdate(timeoutMs = 20_000): Promise<UpdateCheckResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const { registration, applyUpdate } = state;
  if (!registration || !applyUpdate) return 'unsupported';
  try {
    await registration.update();
  } catch {
    return 'offline';
  }
  const hasNew = Boolean(registration.waiting || registration.installing) ? await waitForPending(timeoutMs) : state.updatePending;
  if (!hasNew) return 'latest';
  await applyUpdate();
  return 'updating';
}

/** Só para testes. */
export function resetPwaControlForTests(): void {
  state.registration = undefined;
  state.applyUpdate = undefined;
  state.updatePending = false;
  state.listeners.clear();
}
