import { auth } from './authClient';

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
    readonly cancelled = false
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

export function getPasskeyErrorMessage(error: unknown): string {
  if (error instanceof PasskeyError) return error.message;
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return 'Face ID cancelado ou não reconhecido. Tente de novo.';
  }
  if (name === 'InvalidStateError') return 'Este aparelho já está cadastrado.';
  if (name === 'SecurityError') return 'O Face ID não funciona neste endereço do site.';
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
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new PasskeyError(body.error || 'Não foi possível concluir. Tente de novo.');
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

/** Cria a passkey deste aparelho (pede o Face ID) e cadastra a chave pública na conta. */
export async function registerPasskey(): Promise<void> {
  const begin = await authorizedJson<{ options: unknown; challengeToken: string }>(
    '/api/auth/passkeys/register/options',
    { method: 'POST', body: '{}' }
  );
  const { startRegistration } = await import('@simplewebauthn/browser');
  const response = await startRegistration({ optionsJSON: begin.options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
  await authorizedJson('/api/auth/passkeys/register/verify', {
    method: 'POST',
    body: JSON.stringify({ response, challengeToken: begin.challengeToken, label: describeDevice() }),
  });
  setPasskeyEnabledHere(true);
}
