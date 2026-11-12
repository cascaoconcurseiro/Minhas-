/**
 * Preparação antecipada do Face ID.
 *
 * O Safari do iPhone só abre o Face ID se a chamada acontecer logo depois do toque do usuário. Se o
 * toque primeiro esperar a rede (buscar o desafio no servidor) ou carregar a biblioteca, o iPhone recusa.
 * Por isso o desafio e a biblioteca são buscados ANTES, quando a tela abre, e o toque só usa o que já está pronto.
 */

export interface PreparedHandle<T> {
  /** Começa a buscar (ou refaz, se falhou ou venceu). Não faz nada se já há um valor válido a caminho. */
  prepare: () => void;
  /** Valor já pronto (consome) ou null. Nunca espera a rede. */
  takeReady: () => T | null;
  /** Resolve quando há um valor pronto (ou false se falhou). */
  whenReady: () => Promise<boolean>;
}

interface Entry<T> {
  promise: Promise<T>;
  at: number;
  value?: T;
  failed?: boolean;
}

/** O desafio do servidor vale 5 minutos; renovamos antes disso. */
export const PREPARED_TTL_MS = 4 * 60 * 1000;

export function createPrepared<T>(
  load: () => Promise<T>,
  options: { ttlMs?: number; now?: () => number } = {}
): PreparedHandle<T> {
  const ttlMs = options.ttlMs ?? PREPARED_TTL_MS;
  const now = options.now ?? (() => Date.now());
  let entry: Entry<T> | null = null;

  const isFresh = (e: Entry<T>) => !e.failed && now() - e.at <= ttlMs;

  const start = (): Entry<T> => {
    const next: Entry<T> = { promise: load(), at: now() };
    next.promise.then(
      (value) => {
        next.value = value;
      },
      () => {
        next.failed = true;
      }
    );
    entry = next;
    return next;
  };

  return {
    prepare() {
      if (!entry || !isFresh(entry)) start();
    },
    takeReady() {
      const current = entry;
      if (current && current.value !== undefined && isFresh(current)) {
        entry = null;
        return current.value;
      }
      return null;
    },
    async whenReady() {
      if (!entry || !isFresh(entry)) start();
      try {
        await entry!.promise;
        return true;
      } catch {
        return false;
      }
    },
  };
}

type PasskeyLibrary = typeof import('@simplewebauthn/browser');

let libraryPromise: Promise<PasskeyLibrary> | null = null;
let loadedLibrary: PasskeyLibrary | null = null;

/** Carrega a biblioteca do navegador uma vez e guarda para uso imediato no toque. */
export function loadPasskeyLibrary(): Promise<PasskeyLibrary> {
  libraryPromise ??= import('@simplewebauthn/browser').then((lib) => {
    loadedLibrary = lib;
    return lib;
  });
  return libraryPromise;
}

export function getLoadedPasskeyLibrary(): PasskeyLibrary | null {
  return loadedLibrary;
}

export interface PasskeyOptionsPayload {
  options: unknown;
  challengeToken: string;
}

async function fetchLoginOptions(): Promise<PasskeyOptionsPayload> {
  const response = await fetch('/api/auth/passkeys/login/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = (await response.json().catch(() => ({}))) as Partial<PasskeyOptionsPayload> & { error?: string };
  if (!response.ok || !body.options || !body.challengeToken) {
    throw new Error(body.error || 'Não foi possível preparar o Face ID agora.');
  }
  return { options: body.options, challengeToken: body.challengeToken };
}

/** Desafio de login (público) já buscado, à espera do toque. */
export const loginPrepared = createPrepared<PasskeyOptionsPayload>(fetchLoginOptions);
