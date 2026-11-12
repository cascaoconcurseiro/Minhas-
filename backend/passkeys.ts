import type { Express, Request, RequestHandler, Response } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  SessionTokenError,
  signPurposeToken,
  verifyPurposeToken,
  type createAttemptLimiter,
} from './authSession.ts';

const RP_NAME = 'Minhas Economias';
const MAX_PASSKEYS_PER_USER = 10;
const CREDENTIAL_ID_PATTERN = /^[A-Za-z0-9_-]{16,1024}$/;
const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

export interface RelyingParty {
  rpID: string;
  origin: string;
}

/**
 * Domínio e origem em que a passkey vale. Vêm do próprio servidor (cabeçalhos de quem
 * recebeu o pedido, ou das variáveis PASSKEY_RP_ID / PASSKEY_ORIGIN), nunca do corpo do pedido.
 * O navegador amarra a passkey ao domínio real, então um site falso não consegue usá-la.
 */
export function resolveRelyingParty(req: Pick<Request, 'headers'>): RelyingParty | null {
  const envRpId = (process.env.PASSKEY_RP_ID ?? '').trim().toLowerCase();
  const envOrigin = (process.env.PASSKEY_ORIGIN ?? '').trim();
  if (envRpId && envOrigin) return { rpID: envRpId, origin: envOrigin };

  const forwarded = req.headers['x-forwarded-host'];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host ?? '';
  const host = raw.split(',')[0].trim().toLowerCase();
  if (!host || !HOST_PATTERN.test(host)) return null;
  const hostname = host.replace(/:\d{1,5}$/, '');
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return { rpID: hostname, origin: `${isLocal ? 'http' : 'https'}://${host}` };
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(value, 'base64url');
  const copy = new Uint8Array(new ArrayBuffer(buffer.length));
  copy.set(buffer);
  return copy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeTransports(value: unknown): AuthenticatorTransport[] {
  const allowed = new Set(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AuthenticatorTransport => typeof item === 'string' && allowed.has(item));
}

interface QueryResult {
  rows: Array<Record<string, any>>;
  rowCount: number | null;
}

export interface PasskeyRouteDeps {
  getPool: () => { query: (sql: string, params?: unknown[]) => Promise<QueryResult> };
  verifyAuthUser: RequestHandler;
  sendSession: (
    res: Response,
    status: number,
    user: { id: string; email: string; display_name: string; email_verified: boolean; token_version?: number }
  ) => void;
  limiter: ReturnType<typeof createAttemptLimiter>;
  isAuthConfigured: () => boolean;
}

export function registerPasskeyRoutes(app: Express, deps: PasskeyRouteDeps): void {
  const { getPool, verifyAuthUser, sendSession, limiter, isAuthConfigured } = deps;

  const noStore = (res: Response) => res.set('Cache-Control', 'no-store');
  const fail = (res: Response, status: number, error: string, cause?: unknown) => {
    noStore(res);
    // `detail` é só o texto técnico da biblioteca (origem, desafio…), sem segredos: serve para diagnosticar.
    const detail = cause instanceof Error ? cause.message.slice(0, 200) : undefined;
    res.status(status).json(detail ? { error, detail } : { error });
  };
  const unavailable = (res: Response) => fail(res, 503, 'Face ID indisponível no servidor agora.');
  const limitKeyFor = (req: Request) => `passkey|${req.ip || 'unknown'}`;

  const context = (req: Request, res: Response): RelyingParty | null => {
    if (!isAuthConfigured()) {
      unavailable(res);
      return null;
    }
    const rp = resolveRelyingParty(req);
    if (!rp) {
      fail(res, 400, 'Endereço do site inválido para o Face ID.');
      return null;
    }
    return rp;
  };

  app.get('/api/auth/passkeys', verifyAuthUser, async (_req, res) => {
    const user = res.locals.authUser as { uid: string };
    try {
      const result = await getPool().query(
        `SELECT id, device_label, created_at, last_used_at
           FROM public.app_user_passkeys WHERE user_id = $1 ORDER BY created_at`,
        [user.uid]
      );
      noStore(res);
      res.json({
        passkeys: result.rows.map((row) => ({
          id: String(row.id),
          label: String(row.device_label || 'Este aparelho'),
          createdAt: new Date(row.created_at).toISOString(),
          lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
        })),
      });
    } catch (error) {
      console.error('Erro ao listar passkeys:', error);
      fail(res, 503, 'Não foi possível consultar o Face ID agora.', error);
    }
  });

  app.post('/api/auth/passkeys/register/options', verifyAuthUser, async (req, res) => {
    const rp = context(req, res);
    if (!rp) return;
    const user = res.locals.authUser as { uid: string; email: string; name?: string };
    try {
      const existing = await getPool().query(
        `SELECT id, transports FROM public.app_user_passkeys WHERE user_id = $1`,
        [user.uid]
      );
      if ((existing.rowCount ?? existing.rows.length) >= MAX_PASSKEYS_PER_USER) {
        fail(res, 409, 'Limite de aparelhos com Face ID atingido. Remova algum antes de adicionar outro.');
        return;
      }
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: rp.rpID,
        userName: user.email,
        userDisplayName: user.name || user.email,
        userID: new TextEncoder().encode(user.uid),
        attestationType: 'none',
        excludeCredentials: existing.rows.map((row) => ({
          id: String(row.id),
          transports: sanitizeTransports(row.transports),
        })),
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
      });
      const challengeToken = signPurposeToken('passkey-register', {
        c: options.challenge,
        u: user.uid,
        r: rp.rpID,
      });
      noStore(res);
      res.json({ options, challengeToken });
    } catch (error) {
      console.error('Erro ao preparar cadastro de passkey:', error);
      fail(res, 503, 'Não foi possível preparar o Face ID agora.', error);
    }
  });

  app.post('/api/auth/passkeys/register/verify', verifyAuthUser, async (req, res) => {
    const rp = context(req, res);
    if (!rp) return;
    const user = res.locals.authUser as { uid: string };
    const body = isRecord(req.body) ? req.body : {};
    const response = body.response as RegistrationResponseJSON | undefined;
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 60) : '';
    if (!isRecord(response) || typeof response.id !== 'string' || !CREDENTIAL_ID_PATTERN.test(response.id)) {
      fail(res, 400, 'Resposta do Face ID inválida.');
      return;
    }
    let challenge: string;
    try {
      const data = verifyPurposeToken(String(body.challengeToken ?? ''), 'passkey-register');
      if (data.u !== user.uid || data.r !== rp.rpID || !data.c) throw new SessionTokenError('inválido', 401);
      challenge = data.c;
    } catch {
      fail(res, 401, 'O pedido expirou. Tente ativar o Face ID de novo.');
      return;
    }
    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) {
        fail(res, 400, 'Não foi possível confirmar o Face ID. Tente de novo.');
        return;
      }
      const { credential } = verification.registrationInfo;
      const inserted = await getPool().query(
        `INSERT INTO public.app_user_passkeys (id, user_id, public_key, counter, transports, rp_id, device_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          credential.id,
          user.uid,
          toBase64Url(credential.publicKey),
          credential.counter,
          sanitizeTransports(response.response?.transports),
          rp.rpID,
          label,
        ]
      );
      if (!inserted.rowCount) {
        fail(res, 409, 'Este aparelho já está cadastrado.');
        return;
      }
      noStore(res);
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error('Erro ao confirmar cadastro de passkey:', error);
      fail(res, 400, 'Não foi possível confirmar o Face ID. Tente de novo.', error);
    }
  });

  app.delete('/api/auth/passkeys/:id', verifyAuthUser, async (req, res) => {
    const user = res.locals.authUser as { uid: string };
    const id = String(req.params.id ?? '');
    if (!CREDENTIAL_ID_PATTERN.test(id)) {
      fail(res, 400, 'Identificador inválido.');
      return;
    }
    try {
      await getPool().query(`DELETE FROM public.app_user_passkeys WHERE id = $1 AND user_id = $2`, [id, user.uid]);
      noStore(res);
      res.status(204).end();
    } catch (error) {
      console.error('Erro ao remover passkey:', error);
      fail(res, 503, 'Não foi possível remover o Face ID agora.');
    }
  });

  app.post('/api/auth/passkeys/login/options', async (req, res) => {
    const rp = context(req, res);
    if (!rp) return;
    if (limiter.isBlocked(limitKeyFor(req))) {
      fail(res, 429, 'Muitas tentativas. Aguarde um pouco e tente novamente.');
      return;
    }
    try {
      const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required' });
      const challengeToken = signPurposeToken('passkey-login', { c: options.challenge, r: rp.rpID });
      noStore(res);
      res.json({ options, challengeToken });
    } catch (error) {
      console.error('Erro ao preparar login com passkey:', error);
      fail(res, 503, 'Não foi possível preparar o Face ID agora.', error);
    }
  });

  app.post('/api/auth/passkeys/login/verify', async (req, res) => {
    const rp = context(req, res);
    if (!rp) return;
    const key = limitKeyFor(req);
    if (limiter.isBlocked(key)) {
      fail(res, 429, 'Muitas tentativas. Aguarde um pouco e tente novamente.');
      return;
    }
    const body = isRecord(req.body) ? req.body : {};
    const response = body.response as AuthenticationResponseJSON | undefined;
    if (!isRecord(response) || typeof response.id !== 'string' || !CREDENTIAL_ID_PATTERN.test(response.id)) {
      fail(res, 400, 'Resposta do Face ID inválida.');
      return;
    }
    let challenge: string;
    try {
      const data = verifyPurposeToken(String(body.challengeToken ?? ''), 'passkey-login');
      if (data.r !== rp.rpID || !data.c) throw new SessionTokenError('inválido', 401);
      challenge = data.c;
    } catch {
      fail(res, 401, 'O pedido expirou. Toque em Entrar com Face ID de novo.');
      return;
    }
    try {
      const found = await getPool().query(
        `SELECT p.id, p.public_key, p.counter, p.transports, p.rp_id,
                u.id AS uid, u.email, u.display_name, u.email_verified, u.token_version
           FROM public.app_user_passkeys p
           JOIN public.app_users u ON u.id = p.user_id
          WHERE p.id = $1 LIMIT 1`,
        [response.id]
      );
      const row = found.rows[0];
      if (!row || row.rp_id !== rp.rpID) {
        limiter.recordFailure(key);
        fail(res, 401, 'Face ID não reconhecido neste aparelho. Entre com e-mail e senha e ative o Face ID de novo.');
        return;
      }
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
        credential: {
          id: String(row.id),
          publicKey: fromBase64Url(String(row.public_key)),
          counter: Number(row.counter),
          transports: sanitizeTransports(row.transports),
        },
      });
      if (!verification.verified) {
        limiter.recordFailure(key);
        fail(res, 401, 'Não foi possível confirmar o Face ID. Tente de novo.');
        return;
      }
      await getPool().query(
        `UPDATE public.app_user_passkeys SET counter = $2, last_used_at = now() WHERE id = $1`,
        [row.id, verification.authenticationInfo.newCounter]
      );
      limiter.reset(key);
      sendSession(res, 200, {
        id: String(row.uid),
        email: String(row.email),
        display_name: String(row.display_name),
        email_verified: row.email_verified === true,
        token_version: Number(row.token_version ?? 0),
      });
    } catch (error) {
      limiter.recordFailure(key);
      console.error('Erro ao confirmar login com passkey:', error);
      fail(res, 401, 'Não foi possível confirmar o Face ID. Tente de novo.', error);
    }
  });
}
