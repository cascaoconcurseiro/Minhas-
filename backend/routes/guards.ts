/** Proteção das rotas autenticadas e limites de uso (e-mail, câmbio, cotações, convites). Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import { createAttemptLimiter } from '.././authSession.ts';
import { type RequestHandler } from 'express';
import type { AuthUserIdentity } from '../authUser.ts';
import type { SessionAuthApi } from './authRoutes.ts';

export function registerGuards(app: Express, ctx: SessionAuthApi) {
  const {
    verifyAuthUser,
  } = ctx;
  app.use('/api/workspace', verifyAuthUser);
  app.use('/api/family', verifyAuthUser);
  app.use('/api/reminders/send-email', verifyAuthUser);
  // Cada envio usa o SMTP do próprio usuário, mas sem limite a rota viraria um disparador de e-mails.
  const reminderEmailLimit = createAttemptLimiter(20, 60 * 60 * 1000);
  // Rotas que chamam IA/Google gastam cota: limite por usuário (cada chamada conta), por instância do servidor.
  const createUsageLimit = (
    maxCalls: number,
    windowMs: number,
    message = 'Muitas consultas em pouco tempo. Aguarde um pouco e tente de novo.'
  ): RequestHandler => {
    const limiter = createAttemptLimiter(maxCalls, windowMs);
    return (req, res, next) => {
      const key = String((res.locals.authUser as AuthUserIdentity | undefined)?.uid ?? req.ip ?? 'anon');
      if (limiter.isBlocked(key)) {
        res.status(429).json({ error: message });
        return;
      }
      limiter.recordFailure(key);
      next();
    };
  };
  app.use('/api/fx/live-rate', verifyAuthUser, createUsageLimit(20, 60 * 60 * 1000));
  app.use('/api/investments/sync-quotes', verifyAuthUser, createUsageLimit(60, 60 * 60 * 1000));

  return {
    createUsageLimit,
    reminderEmailLimit,
  };
}

export type GuardsApi = ReturnType<typeof registerGuards>;
