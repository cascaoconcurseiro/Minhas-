/** Cadastro, entrada, sessão, saída e Face ID (passkeys). Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import { type RequestHandler } from 'express';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, SessionTokenError, createAttemptLimiter, hashPassword, isAuthConfigured, isValidEmail, signSessionToken, verifyPassword } from '.././authSession.ts';
import { randomUUID } from 'node:crypto';
import { registerPasskeyRoutes } from '.././passkeys.ts';
import { verifyAuthToken } from '../authUser.ts';
import type { AuthUserIdentity } from '../authUser.ts';
import { getNeonPool } from '../database.ts';

export function registerSessionAuth(app: Express) {
  const verifyAuthUser: RequestHandler = async (req, res, next) => {
    const authorization = req.header('authorization') || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (!token) {
      res.status(401).json({ error: 'Autenticação obrigatória.' });
      return;
    }
    let identity: AuthUserIdentity;
    try {
      identity = verifyAuthToken(token);
    } catch (error) {
      const status = error instanceof SessionTokenError ? error.status : 503;
      res.status(status).json({
        error: status === 401 ? 'Sessão inválida ou expirada. Entre novamente.' : 'Autenticação indisponível no servidor.',
      });
      return;
    }
    // Server-side check: logout (token_version bump) revokes every older token,
    // and e-mail verification takes effect immediately without a new login.
    try {
      const result = await getNeonPool().query(
        `SELECT token_version, email_verified FROM public.app_users WHERE id = $1 LIMIT 1`,
        [identity.uid]
      );
      const row = result.rows[0] as { token_version: number; email_verified: boolean } | undefined;
      if (!row || Number(row.token_version) !== (identity.token_version ?? 0)) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Entre novamente.' });
        return;
      }
      res.locals.authUser = { ...identity, email_verified: row.email_verified === true };
      next();
    } catch (error) {
      console.error('Erro ao validar sessão no Neon:', error);
      res.status(503).json({ error: 'Não foi possível validar a sessão agora.' });
    }
  };

  const loginLimiter = createAttemptLimiter(8, 15 * 60 * 1000);
  const registerLimiter = createAttemptLimiter(10, 60 * 60 * 1000);

  const readCredentials = (body: unknown) => {
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    return {
      email: typeof data.email === 'string' ? data.email.trim().toLowerCase() : '',
      password: typeof data.password === 'string' ? data.password : '',
      name: typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '',
    };
  };

  const sendSession = (
    res: import('express').Response,
    status: number,
    user: { id: string; email: string; display_name: string; email_verified: boolean; token_version?: number }
  ) => {
    const token = signSessionToken({
      uid: user.id,
      email: user.email,
      email_verified: user.email_verified,
      name: user.display_name,
      token_version: Number(user.token_version ?? 0),
    });
    res.set('Cache-Control', 'no-store');
    res.status(status).json({
      token,
      user: {
        uid: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: user.email_verified,
      },
    });
  };

  app.post('/api/auth/register', async (req, res) => {
    if (!isAuthConfigured()) {
      res.status(503).json({ error: 'Autenticação não está configurada no servidor.' });
      return;
    }
    const { email, password, name } = readCredentials(req.body);
    const limitKey = req.ip || 'unknown';
    if (registerLimiter.isBlocked(limitKey)) {
      res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco e tente novamente.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      res.status(400).json({ error: `A senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.` });
      return;
    }
    registerLimiter.recordFailure(limitKey);
    try {
      const id = `usr_${randomUUID().replace(/-/g, '')}`;
      const displayName = name || email.split('@')[0];
      const passwordHash = await hashPassword(password);
      const result = await getNeonPool().query(
        `INSERT INTO public.app_users (id, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, display_name, email_verified, token_version`,
        [id, email, passwordHash, displayName]
      );
      if (!result.rowCount) {
        res.status(409).json({ error: 'Este e-mail já possui cadastro. Entre com a sua senha.' });
        return;
      }
      sendSession(res, 201, result.rows[0]);
    } catch (error) {
      console.error('Erro ao cadastrar usuário no Neon:', error);
      res.status(503).json({ error: 'Não foi possível criar a conta agora. Tente novamente.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!isAuthConfigured()) {
      res.status(503).json({ error: 'Autenticação não está configurada no servidor.' });
      return;
    }
    const { email, password } = readCredentials(req.body);
    const limitKey = `${req.ip || 'unknown'}|${email}`;
    if (loginLimiter.isBlocked(limitKey)) {
      res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
      return;
    }
    if (!isValidEmail(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
      res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
      return;
    }
    try {
      const result = await getNeonPool().query(
        `SELECT id, email, password_hash, display_name, email_verified, token_version
           FROM public.app_users WHERE email = $1 LIMIT 1`,
        [email]
      );
      const row = result.rows[0] as
        | { id: string; email: string; password_hash: string; display_name: string; email_verified: boolean; token_version: number }
        | undefined;
      const valid = await verifyPassword(password, row?.password_hash);
      if (!row || !valid) {
        loginLimiter.recordFailure(limitKey);
        res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        return;
      }
      loginLimiter.reset(limitKey);
      sendSession(res, 200, row);
    } catch (error) {
      console.error('Erro ao autenticar usuário no Neon:', error);
      res.status(503).json({ error: 'Não foi possível entrar agora. Tente novamente.' });
    }
  });

  app.get('/api/auth/me', verifyAuthUser, async (_req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    try {
      const result = await getNeonPool().query(
        `SELECT id, email, display_name, email_verified, token_version FROM public.app_users WHERE id = $1 LIMIT 1`,
        [user.uid]
      );
      if (!result.rowCount) {
        res.status(401).json({ error: 'Conta não encontrada. Entre novamente.' });
        return;
      }
      sendSession(res, 200, result.rows[0]);
    } catch (error) {
      console.error('Erro ao validar sessão no Neon:', error);
      res.status(503).json({ error: 'Não foi possível validar a sessão agora.' });
    }
  });

  app.post('/api/auth/logout', verifyAuthUser, async (_req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    try {
      await getNeonPool().query(
        `UPDATE public.app_users SET token_version = token_version + 1, updated_at = now() WHERE id = $1`,
        [user.uid]
      );
      res.set('Cache-Control', 'no-store');
      res.status(204).end();
    } catch (error) {
      console.error('Erro ao encerrar sessão no Neon:', error);
      res.status(503).json({ error: 'Não foi possível encerrar a sessão no servidor.' });
    }
  });

  registerPasskeyRoutes(app, {
    getPool: getNeonPool,
    verifyAuthUser,
    sendSession,
    limiter: createAttemptLimiter(20, 15 * 60 * 1000),
    isAuthConfigured,
  });

  return {
    verifyAuthUser,
  };
}

export type SessionAuthApi = ReturnType<typeof registerSessionAuth>;
