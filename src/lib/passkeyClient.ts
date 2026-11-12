import { auth } from './authClient';
import {
  createPrepared,
  getLoadedPasskeyLibrary,
  loadPasskeyLibrary,
  loginPrepared,
  type PasskeyOptionsPayload,
} from './passkeyPrepare';

const ENABLED_KEY = 'minhas_passkey_enabled_v1';
const OFFER_KEY = 'minhas_passkey_offer_v1';

export interface PasskeySummary {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export class PasskeyError extends Error {
  constructor(
    message: string,
    readonly cancelled = false,
    readonly detail = ''
  ) {
    super(message);
    this.name = 'PasskeyError';
  }
}

function readFlag(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeFlag(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Armazenamento bloqueado: o Face ID continua funcionando, só não lembramos a preferência.
  }
}

/** Este aparelho já tem Face ID ativado para o app. */
export function isPasskeyEnabledHere(): boolean {
  return readFlag(ENABLED_KEY) === '1';
}

export function setPasskeyEnabledHere(enabled: boolean): void {
  writeFlag(ENABLED_KEY, enabled ? '1' : null);
}

export function wasPasskeyOfferDismissed(): boolean {
  return readFlag(OFFER_KEY) === 'dismissed';
}

export function dismissPasskeyOffer(): void {
  writeFlag(OFFER_KEY, 'dismissed');
}

/** O aparelho tem Face ID, Touch ID ou biometria equivalente que o navegador consegue usar. */
export async function isPasskeySupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Nome e mensagem técnicos do erro, para conseguir diagnosticar sem adivinhar. */
export function describePasskeyFailure(error: unknown): string {
  const e = error as { name?: string; message?: string; code?: string; detail?: string; status?: number } | null;
  const parts = [e?.name, e?.status ? `HTTP ${e.status}` : '', e?.code, e?.detail, e?.message].filter((value): value is string => Boolean(value && value.trim()));
  return [...new Set(parts)].join(' · ').slice(0, 160) || 'erro sem detalhe';
}

export function getPasskeyErrorMessage(error: unknown): string {
  if (error instanceof PasskeyError) return error.message;
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return 'O Face ID não foi concluído (cancelado ou o iPhone não chegou a abrir). Toque no botão para tentar de novo.';
  }
  if (name === 'InvalidStateError') return 'Este aparelho já está cadastrado.';
  if (name === 'SecurityError') return 'O Face ID não funciona neste endereço do site.';
  if (name === 'AuthError') return (error as Error).message;
  return 'Não foi possível usar o Face ID agora. Tente de novo.';
}

export function isPasskeyCancellation(error: unknown): boolean {
  if (error instanceof PasskeyError) return error.cancelled;
  const name = (error as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

async function authorizedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new PasskeyError('Entre na sua conta para configurar o Face ID.');
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
    });
  } catch {
    throw new PasskeyError('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
  if (!response.ok) {
    throw new PasskeyError(
      body.error || 'Não foi possível concluir. Tente de novo.',
      false,
      `HTTP ${response.status}${body.detail ? ` · ${body.detail}` : ''}`
    );
  }
  return body as T;
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  const result = await authorizedJson<{ passkeys: PasskeySummary[] }>('/api/auth/passkeys');
  return result.passkeys;
}

export async function removePasskey(id: string): Promise<void> {
  await authorizedJson<void>(`/api/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function describeDevice(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Este aparelho';
}

const registerPrepared = createPrepared<PasskeyOptionsPayload>(() =>
  authorizedJson<PasskeyOptionsPayload>('/api/auth/passkeys/register/options', { method: 'POST', body: '{}' })
);

/** Busca o desafio e a biblioteca antes do toque. Resolve true quando o botão já pode ser usado. */
export async function preparePasskeyRegistration(): Promise<boolean> {
  const [ready] = await Promise.all([registerPrepared.whenReady(), loadPasskeyLibrary().then(() => true, () => false)]);
  return ready && getLoadedPasskeyLibrary() !== null;
}

/** Cria a passkey deste aparelho (pede o Face ID) e cadastra a chave pública na conta. */
export async function registerPasskey(): Promise<void> {
  // Sem espera de rede antes do Face ID: o iPhone só abre o Face ID logo depois do toque.
  const ready = registerPrepared.takeReady();
  const library = getLoadedPasskeyLibrary();
  if (!ready || !library) {
    registerPrepared.prepare();
    void loadPasskeyLibrary();
    throw new PasskeyError('Preparando o Face ID. Toque de novo em instantes.');
  }
  let response;
  try {
    response = await library.startRegistration({
      optionsJSON: ready.options as Parameters<typeof library.startRegistration>[0]['optionsJSON'],
    });
  } catch (error) {
    registerPrepared.prepare();
    throw error;
  }
  try {
    await authorizedJson('/api/auth/passkeys/register/verify', {
      method: 'POST',
      body: JSON.stringify({ response, challengeToken: ready.challengeToken, label: describeDevice() }),
    });
  } finally {
    registerPrepared.prepare();
  }
  setPasskeyEnabledHere(true);
}

/** Busca o desafio de login e a biblioteca antes do toque. Resolve true quando o botão já pode ser usado. */
export async function waitPasskeyLoginReady(): Promise<boolean> {
  const [ready] = await Promise.all([loginPrepared.whenReady(), loadPasskeyLibrary().then(() => true, () => false)]);
  return ready && getLoadedPasskeyLibrary() !== null;
}
