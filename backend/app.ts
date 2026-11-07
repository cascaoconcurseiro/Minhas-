import 'dotenv/config';
import express from 'express';
import type { RequestHandler } from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
import { normalizeDatabaseConnectionString } from './databaseConnection.ts';
import { getVaultIdForUid } from '../shared/workspaceIdentity.ts';
import { createHash } from 'crypto';
import { normalizeSharedAmount } from './sharedTransactionValidation.ts';
import { resolvePublicSmtpTarget } from './smtpSecurity.ts';
import { parseLiveExchangeRateFromText } from '../src/utils/travelRules.ts';
import { FirebaseTokenVerificationError, verifyFirebaseIdTokenLocally } from './firebaseToken.ts';
import {
  formatGoogleFinanceSymbol,
  normalizeTickerSymbol,
  ParsedGoogleFinanceQuote,
  parseGoogleFinanceHtmlQuote,
  parseGoogleFinanceQuotesFromText,
} from '../src/utils/investmentRules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.locals.reminderSmtpRouteDependencies = {
  resolveTarget: resolvePublicSmtpTarget,
  createTransport: nodemailer.createTransport,
};

let neonPool: Pool | undefined;

function getNeonPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no servidor.');
  }
  neonPool ??= new Pool({
    connectionString: normalizeDatabaseConnectionString(process.env.DATABASE_URL),
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return neonPool;
}

interface AuthUserIdentity {
  uid: string;
  email: string;
  email_verified?: boolean;
}

interface ReminderSmtpRouteDependencies {
  resolveTarget: typeof resolvePublicSmtpTarget;
  createTransport: typeof nodemailer.createTransport;
}

class FirebaseAuthError extends Error {
  constructor(message: string, readonly status: 401 | 503) {
    super(message);
  }
}

async function verifyFirebaseIdToken(idToken: string): Promise<AuthUserIdentity> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new FirebaseAuthError('Firebase Authentication não está configurado no servidor.', 503);
  }
  try {
    return await verifyFirebaseIdTokenLocally(idToken, projectId);
  } catch (error) {
    if (error instanceof FirebaseTokenVerificationError) {
      throw new FirebaseAuthError(error.message, error.status);
    }
    throw new FirebaseAuthError('Firebase Authentication está temporariamente indisponível.', 503);
  }
}

function getRequestWorkspacePayload(
  value: unknown,
  vaultId: string
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const requiredJsonFields = [
    'accountsJson',
    'cardsJson',
    'categoriesJson',
    'transactionsJson',
    'goalsJson',
    'investmentsJson',
  ];
  if (
    typeof payload.updatedAt !== 'string' ||
    requiredJsonFields.some((field) => typeof payload[field] !== 'string')
  ) {
    return null;
  }
  for (const field of requiredJsonFields) {
    try {
      const parsed = JSON.parse(payload[field] as string);
      if (
        !Array.isArray(parsed) ||
        !parsed.every((item) =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)) &&
          typeof item.id === 'string' &&
          item.id.trim().length > 0
        )
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }
  for (const field of [
    'familyMembersJson',
    'investmentTargetsJson',
    'tripsJson',
    'settingsJson',
  ]) {
    if (payload[field] === undefined) continue;
    try {
      const parsed = JSON.parse(String(payload[field]));
      if (field === 'familyMembersJson' || field === 'tripsJson') {
        if (
          !Array.isArray(parsed) ||
          !parsed.every((item) =>
            Boolean(item && typeof item === 'object' && !Array.isArray(item)) &&
            typeof item.id === 'string' &&
            item.id.trim().length > 0
          )
        ) return null;
      } else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  // Identity always comes from the verified Firebase token, never from a
  // client-provided or legacy backup UID.
  return { ...payload, uid: vaultId };
}

async function withWorkspaceRls<T>(
  user: AuthUserIdentity,
  operation: (client: import('pg').PoolClient, vaultId: string) => Promise<T>
): Promise<T> {
  const vaultId = getVaultIdForUid(user.uid);
  const client = await getNeonPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [user.uid]);
    await client.query("SELECT set_config('app.user_email', $1, true)", [
      user.email.toLowerCase(),
    ]);
    const result = await operation(client, vaultId);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const CURRENCY_NAMES_PT: Record<string, string> = {
  USD: 'Dólar Americano (USD)',
  EUR: 'Euro (EUR)',
  GBP: 'Libra Esterlina (GBP)',
  CAD: 'Dólar Canadense (CAD)',
  CHF: 'Franco Suíço (CHF)',
  ARS: 'Peso Argentino (ARS)',
  CLP: 'Peso Chileno (CLP)',
  JPY: 'Iene Japonês (JPY)',
  BRL: 'Real Brasileiro (BRL)',
};

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não encontrada no ambiente do servidor. Verifique o painel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function fetchDirectGoogleFinanceQuote(
  ticker: string
): Promise<ParsedGoogleFinanceQuote | null> {
  try {
    const symbol = formatGoogleFinanceSymbol(ticker);
    if (!symbol.endsWith(':BVMF')) {
      return null;
    }
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(
      symbol
    )}?hl=pt-BR`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    return parseGoogleFinanceHtmlQuote(html, ticker);
  } catch {
    return null;
  }
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  const verifyFirebaseAuthUser: RequestHandler = async (req, res, next) => {
    const authorization = req.header('authorization') || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (!token) {
      res.status(401).json({ error: 'Autenticação Firebase obrigatória.' });
      return;
    }
    try {
      res.locals.authUser = await verifyFirebaseIdToken(token);
      next();
    } catch (error) {
      const status = error instanceof FirebaseAuthError ? error.status : 503;
      res.status(status).json({
        error: status === 401 ? 'Token Firebase inválido ou expirado.' : 'Firebase Authentication temporariamente indisponível.',
      });
    }
  };

  const requireVerifiedFamilyEmail: RequestHandler = (_req, res, next) => {
    const user = res.locals.authUser as AuthUserIdentity;
    if (user.email_verified !== true) {
      res.status(403).json({ error: 'Verifique o e-mail da conta antes de usar o compartilhamento familiar.' });
      return;
    }
    next();
  };

  app.use('/api/workspace', verifyFirebaseAuthUser);
  app.use('/api/family', verifyFirebaseAuthUser, requireVerifiedFamilyEmail);
  app.use('/api/reminders/send-email', verifyFirebaseAuthUser);
  app.use('/api/fx/live-rate', verifyFirebaseAuthUser);
  app.use('/api/investments/sync-quotes', verifyFirebaseAuthUser);

  app.get('/api/workspace', async (_req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    const vaultId = getVaultIdForUid(user.uid);
    try {
      const workspace = await withWorkspaceRls(user, async (client, vaultId) => {
        const result = await client.query(
          `SELECT vault_id, payload, revision, updated_at
             FROM public.finance_workspaces
            WHERE owner_user_id = $1
            ORDER BY updated_at DESC
            LIMIT 2`,
          [user.uid]
        );
        if (result.rows.length > 1) {
          throw new Error('Mais de um workspace está associado a esta identidade Firebase.');
        }
        return result.rows[0] ?? null;
      });
      if (!workspace) {
        res.status(404).json({ error: 'Workspace ainda não inicializado no Neon.' });
        return;
      }
      res.json({
        payload: { ...workspace.payload, uid: vaultId },
        revision: Number(workspace.revision),
        updatedAt: workspace.updated_at,
      });
    } catch (error) {
      console.error('Erro ao carregar workspace Neon:', error);
      res.status(503).json({ error: 'Não foi possível carregar os dados em nuvem.' });
    }
  });

  app.post('/api/workspace', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    if (!user.email) {
      res.status(403).json({ error: 'A conta Firebase precisa ter um e-mail.' });
      return;
    }
    const vaultId = getVaultIdForUid(user.uid);
    const payload = getRequestWorkspacePayload(req.body?.payload, vaultId);
    if (!payload) {
      res.status(400).json({ error: 'Payload inicial do workspace inválido.' });
      return;
    }

    try {
      const created = await withWorkspaceRls(user, async (client) => {
        const existing = await client.query(
          `SELECT vault_id FROM public.finance_workspaces
            WHERE owner_user_id = $1 LIMIT 1 FOR UPDATE`,
          [user.uid]
        );
        if (existing.rowCount) return null;
        const result = await client.query(
          `INSERT INTO public.finance_workspaces
             (vault_id, owner_user_id, owner_email, display_name, payload,
              revision, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, 1, now(), now())
           ON CONFLICT DO NOTHING
           RETURNING revision, updated_at`,
          [
            vaultId,
            user.uid,
            user.email!.toLowerCase(),
            typeof payload.displayName === 'string' ? payload.displayName : null,
            JSON.stringify(payload),
          ]
        );
        return result.rows[0] ?? null;
      });
      if (!created) {
        res.status(409).json({ error: 'O workspace já foi criado no Neon.' });
        return;
      }
      res.status(201).json({
        revision: Number(created.revision),
        updatedAt: created.updated_at,
      });
    } catch (error) {
      console.error('Erro ao criar workspace Neon:', error);
      res.status(503).json({ error: 'Não foi possível criar o workspace no Neon.' });
    }
  });

  app.put('/api/workspace', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    if (!user.email) {
      res.status(403).json({ error: 'A conta Firebase precisa ter um e-mail.' });
      return;
    }
    const vaultId = getVaultIdForUid(user.uid);
    const payload = getRequestWorkspacePayload(req.body?.payload, vaultId);
    const expectedRevision = req.body?.expectedRevision;
    if (
      !payload ||
      typeof expectedRevision !== 'number' ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 1
    ) {
      res.status(400).json({ error: 'Payload ou revisão esperada inválida.' });
      return;
    }

    try {
      const updated = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `UPDATE public.finance_workspaces
              SET vault_id = $1,
                  payload = $2::jsonb,
                  owner_email = $3,
                  display_name = $4,
                  revision = revision + 1,
                  updated_at = now()
            WHERE owner_user_id = $5
              AND revision = $6
          RETURNING revision, updated_at`,
          [
            vaultId,
            JSON.stringify(payload),
            user.email!.toLowerCase(),
            typeof payload.displayName === 'string' ? payload.displayName : null,
            user.uid,
            expectedRevision,
          ]
        );
        return result.rows[0] ?? null;
      });
      if (!updated) {
        res.status(409).json({ error: 'Workspace ausente ou revisão desatualizada.' });
        return;
      }
      res.json({ revision: Number(updated.revision), updatedAt: updated.updated_at });
    } catch (error) {
      console.error('Erro ao salvar workspace Neon:', error);
      res.status(503).json({ error: 'Não foi possível salvar os dados em nuvem.' });
    }
  });

  app.get('/api/family/invitations', async (_req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    try {
      const invitations = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `SELECT invitation_id, owner_user_id, owner_email, invited_email,
                  invited_user_id, owner_member_id, owner_name, owner_pix_key,
                  relationship, color, status, created_at, updated_at, responded_at
             FROM public.finance_family_invitations
            WHERE owner_user_id = $1
               OR (lower(invited_email) = lower($2)
                   AND (invited_user_id IS NULL OR invited_user_id = $1))
            ORDER BY updated_at DESC`,
          [user.uid, user.email]
        );
        return result.rows;
      });
      res.json({ invitations });
    } catch (error) {
      console.error('Erro ao carregar convites familiares:', error);
      res.status(503).json({ error: 'Não foi possível carregar os convites familiares.' });
    }
  });

  app.post('/api/family/invitations', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    const invitedEmail = String(req.body?.invitedEmail || '').trim().toLowerCase();
    const ownerMemberId = String(req.body?.ownerMemberId || '').trim();
    const ownerName = String(req.body?.ownerName || '').trim().slice(0, 120);
    const relationship = String(req.body?.relationship || 'outro').trim().slice(0, 40);
    const color = String(req.body?.color || '#6366f1').trim().slice(0, 24);
    const ownerPixKey = String(req.body?.ownerPixKey || '').trim().slice(0, 180);
    if (
      !user.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail) ||
      invitedEmail === user.email.toLowerCase() ||
      ownerMemberId.length < 1 || ownerMemberId.length > 128
    ) {
      res.status(400).json({ error: 'Convite familiar inválido.' });
      return;
    }
    const invitationId = createHash('sha256')
      .update(`${user.uid}:${invitedEmail}`)
      .digest('hex');
    try {
      const invitation = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `INSERT INTO public.finance_family_invitations
             (invitation_id, owner_user_id, owner_email, invited_email,
              owner_member_id, owner_name, owner_pix_key, relationship, color)
           VALUES ($1, $2, $3, $4, $5, $6, nullif($7, ''), $8, $9)
           ON CONFLICT (owner_user_id, invited_email) DO UPDATE
             SET owner_member_id = EXCLUDED.owner_member_id,
                 owner_name = EXCLUDED.owner_name,
                 owner_pix_key = EXCLUDED.owner_pix_key,
                 relationship = EXCLUDED.relationship,
                 color = EXCLUDED.color,
                 status = CASE
                   WHEN finance_family_invitations.status = 'accepted' THEN 'accepted'
                   ELSE 'invited'
                 END,
                 invited_user_id = CASE
                   WHEN finance_family_invitations.status = 'accepted'
                     THEN finance_family_invitations.invited_user_id
                   ELSE NULL
                 END,
                 updated_at = now(),
                 responded_at = CASE
                   WHEN finance_family_invitations.status = 'accepted'
                     THEN finance_family_invitations.responded_at
                   ELSE NULL
                 END
           RETURNING invitation_id, owner_user_id, owner_email, invited_email,
                     invited_user_id, owner_member_id, owner_name, owner_pix_key,
                     relationship, color, status, created_at, updated_at, responded_at`,
          [
            invitationId,
            user.uid,
            user.email.toLowerCase(),
            invitedEmail,
            ownerMemberId,
            ownerName || user.email.split('@')[0],
            ownerPixKey,
            relationship,
            color,
          ]
        );
        return result.rows[0];
      });
      res.status(201).json({ invitation });
    } catch (error) {
      console.error('Erro ao criar convite familiar:', error);
      res.status(503).json({ error: 'Não foi possível salvar o convite familiar.' });
    }
  });

  app.post('/api/family/invitations/:invitationId/respond', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    const action = req.body?.action;
    if (!user.email || !['accepted', 'declined'].includes(action)) {
      res.status(400).json({ error: 'Resposta de convite inválida.' });
      return;
    }
    try {
      const response = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `UPDATE public.finance_family_invitations
              SET status = $1,
                  invited_user_id = $2,
                  updated_at = now(),
                  responded_at = now()
            WHERE invitation_id = $3
              AND lower(invited_email) = lower($4)
              AND status = 'invited'
          RETURNING invitation_id, owner_user_id, owner_email, invited_email,
                    invited_user_id, owner_member_id, owner_name, owner_pix_key,
                    relationship, color, status, created_at, updated_at, responded_at`,
          [action, user.uid, req.params.invitationId, user.email]
        );
        if (result.rows[0]) return { invitation: result.rows[0] };

        // A repeated identical response is safe and idempotent. A different
        // action after the invitation is terminal must not silently replace it.
        const existingResult = await client.query(
          `SELECT invitation_id, owner_user_id, owner_email, invited_email,
                  invited_user_id, owner_member_id, owner_name, owner_pix_key,
                  relationship, color, status, created_at, updated_at, responded_at
             FROM public.finance_family_invitations
            WHERE invitation_id = $1
              AND lower(invited_email) = lower($2)
            LIMIT 1
            FOR UPDATE`,
          [req.params.invitationId, user.email]
        );
        const existing = existingResult.rows[0];
        if (!existing || existing.invited_user_id !== user.uid) return { notFound: true as const };
        if (existing.status === action) return { invitation: existing };
        return { conflict: true as const };
      });
      if ('notFound' in response) {
        res.status(404).json({ error: 'Convite não encontrado para esta conta.' });
        return;
      }
      if ('conflict' in response) {
        res.status(409).json({ error: 'Este convite já recebeu uma resposta diferente.' });
        return;
      }
      res.json({ invitation: response.invitation });
    } catch (error) {
      console.error('Erro ao responder convite familiar:', error);
      res.status(503).json({ error: 'Não foi possível responder ao convite.' });
    }
  });

  app.post('/api/family/invitations/:invitationId/revoke', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    try {
      const revoked = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `UPDATE public.finance_family_invitations
              SET status = 'revoked', updated_at = now(), responded_at = now()
            WHERE invitation_id = $1
              AND (owner_user_id = $2 OR invited_user_id = $2)
          RETURNING owner_user_id, invited_user_id`,
          [req.params.invitationId, user.uid]
        );
        const link = result.rows[0];
        if (!link) return false;
        if (link.invited_user_id) {
          await client.query(
            `DELETE FROM public.finance_shared_transactions
              WHERE (sender_user_id = $1 AND recipient_user_id = $2)
                 OR (sender_user_id = $2 AND recipient_user_id = $1)`,
            [link.owner_user_id, link.invited_user_id]
          );
        }
        return true;
      });
      if (!revoked) {
        res.status(404).json({ error: 'Convite não encontrado para esta conta.' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Erro ao revogar vínculo familiar:', error);
      res.status(503).json({ error: 'Não foi possível revogar o vínculo familiar.' });
    }
  });

  app.get('/api/family/shared', async (_req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    try {
      const transactions = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `SELECT sender_user_id, recipient_user_id, shared_sync_id,
                  payload, updated_at
             FROM public.finance_shared_transactions
            WHERE recipient_user_id = $1 AND recipient_hidden = false
            ORDER BY updated_at DESC`,
          [user.uid]
        );
        return result.rows;
      });
      res.json({ transactions });
    } catch (error) {
      console.error('Erro ao carregar lançamentos compartilhados:', error);
      res.status(503).json({ error: 'Não foi possível carregar os lançamentos compartilhados.' });
    }
  });

  app.put('/api/family/shared', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    const partnerEmail = String(req.body?.partnerEmail || '').trim().toLowerCase();
    const transactions = req.body?.transactions;
    const deletedSharedIds = Array.isArray(req.body?.deletedSharedIds)
      ? req.body.deletedSharedIds.map((id: unknown) => String(id).replace(/^tx-mirror-/, ''))
      : [];
    if (
      !user.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail) ||
      !Array.isArray(transactions) ||
      transactions.length > 5000 ||
      deletedSharedIds.length > 5000
    ) {
      res.status(400).json({ error: 'Snapshot de compartilhamento inválido.' });
      return;
    }

    const invalidSharedAmount = (transactions as unknown[]).some((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const tx = entry as Record<string, unknown>;
      if (String(tx.id || '').startsWith('tx-mirror-') || tx.isShared !== true || tx.tripId) {
        return false;
      }
      return normalizeSharedAmount(tx.amount, tx.sharedAmount) === null;
    });
    if (invalidSharedAmount) {
      res.status(400).json({
        error: 'A cota compartilhada deve estar entre zero e o valor do lançamento.',
      });
      return;
    }

    try {
      const result = await withWorkspaceRls(user, async (client) => {
        // Serialize with revocation, which locks this invitation before deleting shared rows.
        const linkResult = await client.query(
          `SELECT owner_user_id, owner_email, invited_email,
                  invited_user_id, owner_member_id, status
             FROM public.finance_family_invitations
            WHERE status = 'accepted'
              AND ((owner_user_id = $1 AND lower(invited_email) = lower($2))
                OR (invited_user_id = $1 AND lower(owner_email) = lower($2)))
            LIMIT 1
            FOR UPDATE`,
          [user.uid, partnerEmail]
        );
        const link = linkResult.rows[0];
        if (!link || !link.invited_user_id) return { forbidden: true };

        const ownerIsSender = link.owner_user_id === user.uid;
        const partnerUid = ownerIsSender
          ? String(link.invited_user_id)
          : String(link.owner_user_id);
        const senderEmail = user.email!.toLowerCase();
        const recipientEmail = partnerEmail;
        const recipientMemberId = ownerIsSender
          ? `fam-inv-${senderEmail.replace(/[^a-z0-9]/g, '_')}`
          : String(link.owner_member_id);
        let upserted = 0;
        let settled = 0;

        for (const tx of transactions as Array<Record<string, unknown>>) {
          if (!tx || typeof tx !== 'object') continue;
          if (String(tx.id || '').startsWith('tx-mirror-')) {
            const sharedSyncId = String(tx.sharedSyncId || tx.id).replace(/^tx-mirror-/, '');
            if (!sharedSyncId) continue;
            const sharedStatus = tx.sharedStatus === 'received' ? 'received' : 'pending';
            const settledDate = typeof tx.sharedSettledDate === 'string'
              ? tx.sharedSettledDate.slice(0, 32)
              : null;
            await client.query(
              `UPDATE public.finance_shared_transactions
                  SET payload = jsonb_set(
                    CASE WHEN $5::text IS NULL
                      THEN payload - 'sharedSettledDate'
                      ELSE jsonb_set(payload, '{sharedSettledDate}', to_jsonb($5::text), true)
                    END,
                    '{sharedStatus}', to_jsonb($4::text), true
                  ),
                  updated_at = now()
                WHERE sender_user_id = $1
                  AND recipient_user_id = $2
                  AND shared_sync_id = $3`,
              [partnerUid, user.uid, sharedSyncId, sharedStatus, settledDate]
            );
            settled += 1;
            continue;
          }

          if (tx.isShared !== true || tx.tripId || typeof tx.id !== 'string') continue;
          const sharedSyncId = String(tx.sharedSyncId || tx.id).replace(/^tx-mirror-/, '');
          const amount = Number(tx.amount);
          if (
            !sharedSyncId || sharedSyncId.length > 160 ||
            !Number.isFinite(amount) || amount < 0 ||
            typeof tx.description !== 'string' || tx.description.length > 500 ||
            typeof tx.date !== 'string' || tx.date.length > 32
          ) continue;

          const senderPaidByMember = tx.sharedPaidBy === 'member';
          const sharedAmount = normalizeSharedAmount(tx.amount, tx.sharedAmount);
          const mirror = {
            id: `tx-mirror-${sharedSyncId}`,
            sharedSyncId,
            sharedOriginEmail: senderEmail,
            sharedTargetEmail: recipientEmail,
            description: tx.description,
            amount,
            date: tx.date,
            competenceMonth: typeof tx.competenceMonth === 'string' ? tx.competenceMonth : tx.date.slice(0, 7),
            type: 'expense',
            status: tx.status === 'pending' ? 'pending' : 'paid',
            categoryId: typeof tx.categoryId === 'string' ? tx.categoryId : 'cat-outros',
            ...(typeof tx.subcategoryId === 'string' ? { subcategoryId: tx.subcategoryId } : {}),
            paymentMethod: typeof tx.paymentMethod === 'string' ? tx.paymentMethod : 'pix',
            recurrence: typeof tx.recurrence === 'string' ? tx.recurrence : 'single',
            ...(typeof tx.installmentGroupId === 'string' ? { installmentGroupId: `mirror-${tx.installmentGroupId}` } : {}),
            ...(typeof tx.installmentNumber === 'number' ? { installmentNumber: tx.installmentNumber } : {}),
            ...(typeof tx.installmentTotal === 'number' ? { installmentTotal: tx.installmentTotal } : {}),
            ...(typeof tx.notes === 'string' ? { notes: tx.notes.slice(0, 2000) } : {}),
            isShared: true,
            sharedMemberId: recipientMemberId,
            sharedAmount: sharedAmount ?? amount,
            sharedSplitMode: ['full', 'half', 'custom'].includes(String(tx.sharedSplitMode)) ? tx.sharedSplitMode : 'half',
            sharedPaidBy: senderPaidByMember ? 'me' : 'member',
            sharedStatus: tx.sharedStatus === 'received' ? 'received' : 'pending',
            ...(typeof tx.sharedSettledDate === 'string' ? { sharedSettledDate: tx.sharedSettledDate } : {}),
            isCompanionOnlyExpense: true,
          };
          await client.query(
            `INSERT INTO public.finance_shared_transactions
               (sender_user_id, recipient_user_id, shared_sync_id, payload, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, now())
             ON CONFLICT (sender_user_id, recipient_user_id, shared_sync_id)
             DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
            [user.uid, partnerUid, sharedSyncId, JSON.stringify(mirror)]
          );
          upserted += 1;
        }

        let deleted = 0;
        if (deletedSharedIds.length > 0) {
          const deletion = await client.query(
            `DELETE FROM public.finance_shared_transactions
              WHERE sender_user_id = $1
                AND recipient_user_id = $2
                AND shared_sync_id = ANY($3::text[])`,
            [user.uid, partnerUid, deletedSharedIds]
          );
          const hidden = await client.query(
            `UPDATE public.finance_shared_transactions
                SET recipient_hidden = true, updated_at = now()
              WHERE sender_user_id = $1
                AND recipient_user_id = $2
                AND shared_sync_id = ANY($3::text[])
                AND recipient_hidden = false`,
            [partnerUid, user.uid, deletedSharedIds]
          );
          deleted = (deletion.rowCount ?? 0) + (hidden.rowCount ?? 0);
        }
        return { forbidden: false, upserted, settled, deleted };
      });
      if (result.forbidden) {
        res.status(403).json({ error: 'O compartilhamento exige convite familiar aceito.' });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error('Erro ao sincronizar lançamentos familiares no Neon:', error);
      res.status(503).json({ error: 'Não foi possível sincronizar os lançamentos compartilhados.' });
    }
  });

  // Public status is deliberately lightweight: it reports configuration only.
  // Database availability is reported by authenticated sync operations and the
  // protected daily readiness check below.
  app.get('/api/status', (_req, res) => {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const firebaseAuthConfigured = Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY);
    const neonConfigured = Boolean(process.env.DATABASE_URL);
    const configured = firebaseAuthConfigured && neonConfigured;
    res.set('Cache-Control', 'no-store');
    res.status(configured ? 200 : 503).json({
      status: configured ? 'ok' : 'degraded',
      environment: process.env.NODE_ENV || 'development',
      geminiConfigured: hasGeminiKey,
      services: {
        liveFxSearch: hasGeminiKey,
        googleFinanceSync: true,
        firebaseAuthConfigured,
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
    if (!cronSecret || req.get('authorization') !== `Bearer ${cronSecret}`) {
      res.set('Cache-Control', 'no-store');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const firebaseAuthConfigured = Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY);
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

    const ready = neonStatus === 'ok' && neonLeastPrivilegeRole === true && firebaseAuthConfigured;
    res.set('Cache-Control', 'no-store');
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      environment: process.env.NODE_ENV || 'development',
      geminiConfigured: hasGeminiKey,
      services: {
        liveFxSearch: hasGeminiKey,
        googleFinanceSync: true,
        firebaseAuthConfigured,
        neonConfigured: Boolean(process.env.DATABASE_URL),
        neon: neonStatus,
        neonLeastPrivilegeRole,
      },
      checkedAt: new Date().toISOString(),
    });
  });

  app.post('/api/fx/live-rate', async (req, res) => {
    try {
      const requestedCurrency = req.body?.currency ?? 'EUR';
      if (typeof requestedCurrency !== 'string') {
        res.status(400).json({ error: 'Informe um código de moeda válido.' });
        return;
      }
      const rawCurrency = requestedCurrency.trim().toUpperCase();
      if (!Object.hasOwn(CURRENCY_NAMES_PT, rawCurrency)) {
        res.status(400).json({ error: 'Moeda não suportada para cotação em tempo real.' });
        return;
      }

      if (rawCurrency === 'BRL') {
        res.json({
          currency: 'BRL',
          targetCurrency: 'BRL',
          commercialRateBrl: 1,
          summaryText: 'Moeda local já é o Real Brasileiro (1 BRL = R$ 1,00).',
          fetchedAt: new Date().toISOString(),
          sources: [],
        });
        return;
      }

      const currencyLabel = CURRENCY_NAMES_PT[rawCurrency] || rawCurrency;
      const ai = createGeminiClient();

      const prompt = [
        `Consulte no Google Search a cotação comercial atual em tempo real de 1 ${currencyLabel} para Real Brasileiro (BRL) hoje.`,
        `Responda OBRIGATORIAMENTE começando a primeira linha exatamente no formato:`,
        `TAXA_COMERCIAL_BRL: <valor numérico decimal usando ponto, exemplo: 6.1845>`,
        `Na segunda linha, escreva um resumo curto e direto (1 a 2 frases em português) informando a cotação comercial atual de 1 ${rawCurrency} em R$ (BRL) encontrada agora.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = (response.text ?? '').trim();
      const parsedRate = parseLiveExchangeRateFromText(responseText);

      if (!parsedRate || parsedRate <= 0) {
        res.status(502).json({
          error:
            'Não foi possível extrair um valor numérico de cotação da busca em tempo real. Tente consultar novamente em instantes.',
          rawResponse: responseText,
        });
        return;
      }

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seenUris = new Set<string>();
      const sources: { uri: string; title: string }[] = [];

      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          sources.push({
            uri,
            title: chunk?.web?.title || uri,
          });
        }
      }

      const cleanSummary = responseText
        .replace(/^TAXA_COMERCIAL_BRL\s*:\s*[^\n]+\n?/i, '')
        .trim();

      res.json({
        currency: rawCurrency,
        targetCurrency: 'BRL',
        commercialRateBrl: parsedRate,
        summaryText:
          cleanSummary ||
          `Cotação comercial atual: 1 ${rawCurrency} = R$ ${parsedRate
            .toFixed(parsedRate < 0.1 ? 4 : 4)
            .replace('.', ',')}.`,
        fetchedAt: new Date().toISOString(),
        sources,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao consultar cotação em tempo real via Google Search.';
      console.error('Erro em /api/fx/live-rate:', message);
      res.status(500).json({ error: message });
    }
  });

  // Google Finance Real-Time Stock, FII & ETF Quote Synchronization
  app.post('/api/investments/sync-quotes', async (req, res) => {
    try {
      const requestedTickers = req.body?.tickers;
      if (
        !Array.isArray(requestedTickers) ||
        requestedTickers.length > 20 ||
        requestedTickers.some((ticker: unknown) => typeof ticker !== 'string')
      ) {
        res.status(400).json({ error: 'Informe de um a 20 tickers válidos para buscar cotações.' });
        return;
      }

      const rawTickers = Array.from(
        new Set<string>(requestedTickers.map((ticker: string) => normalizeTickerSymbol(ticker)).filter(Boolean))
      );

      if (rawTickers.length === 0) {
        res.status(400).json({
          error:
            'Informe ao menos um ticker para atualizar as cotações no Google Finance.',
        });
        return;
      }
      if (rawTickers.some((ticker) => !/^[A-Z0-9.-]{1,20}$/.test(ticker))) {
        res.status(400).json({ error: 'Um ou mais tickers contêm caracteres inválidos.' });
        return;
      }

      const quoteMap = new Map<string, ParsedGoogleFinanceQuote>();
      const sources: { uri: string; title: string }[] = [];
      const seenUris = new Set<string>();

      // 1) Consulta direta rápida no Google Finance BVMF para Ações B3, FIIs e ETFs locais
      const directResults = await Promise.all(
        rawTickers.map((ticker) => fetchDirectGoogleFinanceQuote(ticker))
      );

      for (const directQuote of directResults) {
        if (directQuote && directQuote.priceBrl > 0) {
          quoteMap.set(directQuote.ticker, directQuote);
          if (directQuote.sourceUri && !seenUris.has(directQuote.sourceUri)) {
            seenUris.add(directQuote.sourceUri);
            sources.push({
              uri: directQuote.sourceUri,
              title: `Google Finance — ${directQuote.ticker}`,
            });
          }
        }
      }

      const missingTickers = rawTickers.filter((t) => !quoteMap.has(t));
      const missingTickerSet = new Set(missingTickers);

      // 2) Fallback / Complemento via Gemini Google Search Grounding para ativos no exterior ou não resolvidos diretamente
      if (missingTickers.length > 0 && process.env.GEMINI_API_KEY) {
        try {
          const ai = createGeminiClient();
          const prompt = [
            `Consulte agora no Google Finance / B3 via Google Search a cotação atual de mercado (em Reais BRL) e a variação percentual do dia para os seguintes ativos: ${missingTickers.join(', ')}.`,
            `Se algum ativo for negociado em Dólar (USD) no exterior (ex: AAPL, NVDA, VT, VOO), converta o preço unitário atual para Reais (BRL) pela cotação comercial de hoje.`,
            `Para CADA ativo encontrado, retorne OBRIGATORIAMENTE uma linha no formato exato (usando ponto como separador decimal):`,
            `QUOTE_LINE: TICKER | PRECO_BRL | VARIACAO_PCT | NOME_OFICIAL`,
            `Exemplo:`,
            `QUOTE_LINE: PETR4 | 38.45 | +1.25 | Petróleo Brasileiro S.A. - Petrobras`,
            `QUOTE_LINE: HGLG11 | 158.90 | -0.18 | CSHG Logística FII`,
          ].join('\n');

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });

          const responseText = (response.text ?? '').trim();
          const aiQuotes = parseGoogleFinanceQuotesFromText(responseText);

          for (const q of aiQuotes) {
            if (missingTickerSet.has(q.ticker) && !quoteMap.has(q.ticker)) {
              quoteMap.set(q.ticker, q);
            }
          }

          const rawChunks =
            response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          for (const chunk of rawChunks) {
            const uri = chunk?.web?.uri;
            if (uri && !seenUris.has(uri)) {
              seenUris.add(uri);
              sources.push({
                uri,
                title: chunk?.web?.title || uri,
              });
            }
          }
        } catch (aiErr) {
          console.warn(
            'Aviso: falha no complemento via Gemini Search para cotações:',
            aiErr instanceof Error ? aiErr.message : aiErr
          );
        }
      }

      const quotes = Array.from(quoteMap.values());

      if (quotes.length === 0) {
        res.status(502).json({
          error:
            'Não foi possível obter a cotação no Google Finance para o(s) ticker(s) informado(s). Verifique o código do ativo (ex: PETR4, VALE3, HGLG11, IVVB11).',
        });
        return;
      }

      res.json({
        quotes,
        fetchedAt: new Date().toISOString(),
        sources,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao sincronizar cotações com o Google Finance.';
      console.error('Erro em /api/investments/sync-quotes:', message);
      res.status(500).json({ error: message });
    }
  });

  // Email Reminder Dispatch Endpoint (Custom User SMTP Credentials)
  app.post('/api/reminders/send-email', async (req, res) => {
    try {
      const rawTo = String(req.body?.to || '').trim().toLowerCase();
      const subject = String(
        req.body?.subject || '[Minhas Economias BR] Lembrete Financeiro'
      ).trim();
      const textBody = String(req.body?.textBody || '').trim();
      const htmlBody = String(req.body?.htmlBody || '').trim();
      const recurrence = String(req.body?.recurrence || 'daily');
      const preferredTime = String(req.body?.preferredTime || '08:00');

      const smtpObj = req.body?.smtp || {};
      const smtpHost = String(smtpObj.host || req.body?.smtpHost || '').trim();
      const smtpPort = Number(smtpObj.port ?? req.body?.smtpPort ?? 587);
      const smtpUser = String(smtpObj.user || req.body?.smtpUser || '').trim();
      const smtpPass = String(smtpObj.pass || req.body?.smtpPass || '').trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawTo || !emailRegex.test(rawTo)) {
        res.status(400).json({
          error: 'Informe um endereço de e-mail válido para o envio dos lembretes.',
        });
        return;
      }

      if (
        !smtpHost ||
        !Number.isFinite(smtpPort) ||
        !smtpUser ||
        !smtpPass
      ) {
        res.status(400).json({
          error:
            'Configure suas credenciais SMTP (Host, Porta, Usuário e Senha) nas configurações de e-mail dos lembretes.',
        });
        return;
      }

      const smtpDependencies = app.locals
        .reminderSmtpRouteDependencies as ReminderSmtpRouteDependencies;
      const smtpTarget = await smtpDependencies.resolveTarget(smtpHost, smtpPort);
      if (!smtpTarget) {
        res.status(400).json({
          error: 'Use um servidor SMTP público em uma porta compatível (25, 465, 587 ou 2525).',
        });
        return;
      }

      const sentAt = new Date().toISOString();
      const deliveryMode = 'custom_smtp' as const;

      const transporter = smtpDependencies.createTransport({
        host: smtpTarget.address,
        port: smtpPort,
        secure: smtpPort === 465,
        requireTLS: smtpPort !== 465,
        tls: { servername: smtpTarget.servername },
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
      });

      const fromAddress = smtpUser.includes('@')
        ? `"Minhas Economias BR" <${smtpUser}>`
        : `"Minhas Economias BR" <${rawTo}>`;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: rawTo,
          subject,
          text: textBody,
          html: htmlBody || undefined,
        });
      } catch (smtpErr) {
        console.warn('Falha ao entregar lembrete via SMTP:', smtpErr instanceof Error ? smtpErr.message : 'erro desconhecido');
        res.status(502).json({
          error: 'O servidor SMTP não aceitou o envio. Confira host, porta e credenciais.',
        });
        return;
      }

      const recurrenceLabelMap: Record<string, string> = {
        daily: 'Diário (Todos os dias)',
        weekly: 'Semanal (Segundas-feiras)',
        monthly: 'Mensal (Dia 1º do mês)',
        weekdays: 'Dias Úteis (Seg a Sex)',
        urgent_only: 'Apenas Urgentes',
      };
      const recurrenceLabel =
        recurrenceLabelMap[recurrence] || 'Diário (Todos os dias)';

      res.json({
        ok: true,
        sentTo: rawTo,
        subject,
        sentAt,
        deliveryMode,
        smtpHost,
        smtpPort,
        smtpUser,
        message: `Resumo financeiro enviado via SMTP (${smtpHost}:${smtpPort}) para ${rawTo} (Horário: ${preferredTime} • Recorrência: ${recurrenceLabel}).`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao processar envio de lembrete por e-mail via SMTP.';
      res.status(500).json({ error: message });
    }
  });

  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          watch: null,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, '..', 'dist');
      app.use(express.static(distPath));
      app.get('*all', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

void startServer();

export default app;
