/** Status público e verificação diária protegida (/api/readiness). Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import { isAuthConfigured } from '.././authSession.ts';
import { timingSafeEqual } from 'node:crypto';
import { getNeonPool } from '../database.ts';

export function registerHealthRoutes(app: Express) {
  // Public status is deliberately lightweight: it reports configuration only.
  // Database availability is reported by authenticated sync operations and the
  // protected daily readiness check below.
  app.get('/api/status', (_req, res) => {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const authConfigured = isAuthConfigured();
    const neonConfigured = Boolean(process.env.DATABASE_URL);
    const configured = authConfigured && neonConfigured;
    res.set('Cache-Control', 'no-store');
    res.status(configured ? 200 : 503).json({
      status: configured ? 'ok' : 'degraded',
      environment: process.env.NODE_ENV || 'development',
      geminiConfigured: hasGeminiKey,
      services: {
        liveFxSearch: hasGeminiKey,
        googleFinanceSync: true,
        authConfigured,
        neonConfigured,
        neon: 'not_checked',
      },
      checkedAt: new Date().toISOString(),
    });
  });

  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. Fail closed before
  // opening a Neon connection when the secret is absent or does not match.
  app.get('/api/readiness', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const expectedAuthorization = Buffer.from(`Bearer ${cronSecret ?? ''}`);
    const receivedAuthorization = Buffer.from(req.get('authorization') ?? '');
    const authorized =
      Boolean(cronSecret) &&
      expectedAuthorization.length === receivedAuthorization.length &&
      timingSafeEqual(expectedAuthorization, receivedAuthorization);
    if (!authorized) {
      res.set('Cache-Control', 'no-store');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const authConfigured = isAuthConfigured();
    let neonStatus: 'ok' | 'error' = 'error';
    let neonLeastPrivilegeRole: boolean | null = null;
    try {
      const client = await getNeonPool().connect();
      try {
        const roleCheck = await client.query(
          `SELECT current_user = 'minhas_app_runtime'
              AND NOT role.rolsuper
              AND NOT role.rolcreaterole
              AND NOT role.rolcreatedb
              AND NOT role.rolreplication
              AND NOT role.rolbypassrls
              AND NOT pg_catalog.pg_has_role(
                current_user,
                'neon_superuser',
                'MEMBER'
              ) AS is_least_privilege_role
             FROM pg_catalog.pg_roles AS role
            WHERE role.rolname = current_user`
        );
        neonLeastPrivilegeRole = roleCheck.rows[0]?.is_least_privilege_role === true;
        await client.query('SELECT 1 FROM public.finance_workspaces LIMIT 0');
        neonStatus = 'ok';
      } finally {
        client.release();
      }
    } catch {
      // Do not expose connection strings or database errors from a public health route.
    }

    const ready = neonStatus === 'ok' && neonLeastPrivilegeRole === true && authConfigured;
    res.set('Cache-Control', 'no-store');
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      environment: process.env.NODE_ENV || 'development',
      geminiConfigured: hasGeminiKey,
      services: {
        liveFxSearch: hasGeminiKey,
        googleFinanceSync: true,
        authConfigured,
        neonConfigured: Boolean(process.env.DATABASE_URL),
        neon: neonStatus,
        neonLeastPrivilegeRole,
      },
      checkedAt: new Date().toISOString(),
    });
  });
}
