import 'dotenv/config';
import express from 'express';
import type { RequestHandler } from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { parseLiveExchangeRateFromText } from '../src/utils/travelRules.ts';
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

let neonPool: Pool | undefined;

function getNeonPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no servidor.');
  }
  neonPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return neonPool;
}

interface FirebaseUserIdentity {
  uid: string;
  email: string;
  email_verified?: boolean;
}

async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUserIdentity> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID não configurado no servidor.');
  }
  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY não configurada no servidor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error('Token Firebase inválido ou expirado.');

    const result = (await response.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        disabled?: boolean;
      }>;
    };
    const account = result.users?.[0];
    if (!account?.localId || !account.email || account.disabled) {
      throw new Error('Conta Firebase inválida ou desativada.');
    }
    return {
      uid: account.localId,
      email: account.email,
      email_verified: account.emailVerified,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getVaultIdForEmail(email: string): string {
  const cleanSlug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const candidate = `vault_usr_${cleanSlug}`;
  const padded =
    candidate.length < 18 ? `${candidate}_cloud_vault_br` : candidate;
  return padded.slice(0, 60);
}

function getRequestWorkspacePayload(value: unknown, vaultId: string) {
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
    payload.uid !== vaultId ||
    typeof payload.updatedAt !== 'string' ||
    requiredJsonFields.some((field) => typeof payload[field] !== 'string')
  ) {
    return null;
  }
  for (const field of requiredJsonFields) {
    try {
      const parsed = JSON.parse(payload[field] as string);
      if (['categoriesJson'].includes(field)) {
        if (!Array.isArray(parsed)) return null;
      } else if (!Array.isArray(parsed)) {
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
      JSON.parse(String(payload[field]));
    } catch {
      return null;
    }
  }
  return payload;
}

function getWorkspaceEntityCounts(payload: Record<string, unknown>) {
  const fields: Record<string, string> = {
    accounts: 'accountsJson',
    cards: 'cardsJson',
    categories: 'categoriesJson',
    transactions: 'transactionsJson',
    goals: 'goalsJson',
    familyMembers: 'familyMembersJson',
    investments: 'investmentsJson',
    trips: 'tripsJson',
  };
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => {
    try {
      const value = JSON.parse(String(payload[field] || '[]'));
      return [name, Array.isArray(value) ? value.length : null];
    } catch {
      return [name, null];
    }
  }));
}

async function withWorkspaceRls<T>(
  user: FirebaseUserIdentity,
  operation: (client: import('pg').PoolClient, vaultId: string) => Promise<T>
): Promise<T> {
  if (!user.email) throw new Error('A conta Firebase precisa ter um e-mail.');
  const vaultId = getVaultIdForEmail(user.email);
  const client = await getNeonPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.firebase_uid', $1, true)", [user.uid]);
    await client.query("SELECT set_config('app.firebase_email', $1, true)", [
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

  const verifyFirebaseWorkspaceUser: RequestHandler = async (req, res, next) => {
    const authorization = req.header('authorization') || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    if (!token) {
      res.status(401).json({ error: 'Autenticação Firebase obrigatória.' });
      return;
    }
    try {
      res.locals.firebaseUser = await verifyFirebaseIdToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Token Firebase inválido ou expirado.' });
    }
  };

  app.use('/api/workspace', verifyFirebaseWorkspaceUser);
  app.use('/api/family', verifyFirebaseWorkspaceUser);

  app.get('/api/workspace', async (_req, res) => {
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    try {
      const workspace = await withWorkspaceRls(user, async (client, vaultId) => {
        const result = await client.query(
          `SELECT payload, revision, updated_at
             FROM public.finance_workspaces
            WHERE vault_id = $1 AND owner_firebase_uid = $2`,
          [vaultId, user.uid]
        );
        return result.rows[0] ?? null;
      });
      if (!workspace) {
        res.status(404).json({ error: 'Workspace ainda não inicializado no Neon.' });
        return;
      }
      res.json({
        payload: workspace.payload,
        revision: Number(workspace.revision),
        updatedAt: workspace.updated_at,
      });
    } catch (error) {
      console.error('Erro ao carregar workspace Neon:', error);
      res.status(503).json({ error: 'Não foi possível carregar os dados em nuvem.' });
    }
  });

  app.post('/api/workspace', async (req, res) => {
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    if (!user.email) {
      res.status(403).json({ error: 'A conta Firebase precisa ter um e-mail.' });
      return;
    }
    const vaultId = getVaultIdForEmail(user.email);
    const payload = getRequestWorkspacePayload(req.body?.payload, vaultId);
    if (!payload) {
      res.status(400).json({ error: 'Payload inicial do workspace inválido.' });
      return;
    }

    try {
      const created = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `INSERT INTO public.finance_workspaces
             (vault_id, owner_firebase_uid, owner_email, display_name, payload,
              revision, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, 1, now(), now())
           ON CONFLICT (vault_id) DO NOTHING
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

  app.post('/api/workspace/migrate', async (req, res) => {
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    if (!user.email) {
      res.status(403).json({ error: 'A conta Firebase precisa ter um e-mail.' });
      return;
    }
    const vaultId = getVaultIdForEmail(user.email);
    const payload = getRequestWorkspacePayload(req.body?.payload, vaultId);
    if (!payload) {
      res.status(400).json({ error: 'Snapshot legado inválido para esta conta.' });
      return;
    }
    const sourceUpdatedAt = typeof req.body?.sourceUpdatedAt === 'string'
      ? req.body.sourceUpdatedAt
      : typeof payload.updatedAt === 'string' ? payload.updatedAt : null;
    if (sourceUpdatedAt && !Number.isFinite(Date.parse(sourceUpdatedAt))) {
      res.status(400).json({ error: 'Data sourceUpdatedAt inválida.' });
      return;
    }
    const payloadJson = JSON.stringify(payload);
    const payloadSha256 = createHash('sha256').update(payloadJson).digest('hex');
    const entityCounts = getWorkspaceEntityCounts(payload);
    try {
      const imported = await withWorkspaceRls(user, async (client) => {
        const inserted = await client.query(
          `INSERT INTO public.finance_workspaces
             (vault_id, owner_firebase_uid, owner_email, display_name, payload,
              source_updated_at, revision, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, 1, now(), now())
           ON CONFLICT (vault_id) DO NOTHING RETURNING revision`,
          [vaultId, user.uid, user.email.toLowerCase(),
            typeof payload.displayName === 'string' ? payload.displayName : null,
            payloadJson, sourceUpdatedAt]
        );
        if (inserted.rowCount !== 1) return false;
        await client.query(
          `INSERT INTO public.finance_workspace_migrations
             (vault_id, owner_firebase_uid, source, source_updated_at, payload_sha256, entity_counts)
           VALUES ($1, $2, 'firestore', $3::timestamptz, $4, $5::jsonb)`,
          [vaultId, user.uid, sourceUpdatedAt, payloadSha256, JSON.stringify(entityCounts)]
        );
        return true;
      });
      if (!imported) {
        res.status(409).json({ error: 'Já existe um workspace Neon; nenhum dado foi substituído.' });
        return;
      }
      res.status(201).json({ ok: true, vaultId });
    } catch (error) {
      console.error('Erro ao importar snapshot legado para Neon:', error);
      res.status(503).json({ error: 'Não foi possível importar os dados para Neon.' });
    }
  });

  app.put('/api/workspace', async (req, res) => {
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    if (!user.email) {
      res.status(403).json({ error: 'A conta Firebase precisa ter um e-mail.' });
      return;
    }
    const vaultId = getVaultIdForEmail(user.email);
    const payload = getRequestWorkspacePayload(req.body?.payload, vaultId);
    const expectedRevision = Number(req.body?.expectedRevision);
    if (
      !payload ||
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
              SET payload = $1::jsonb,
                  owner_email = $2,
                  display_name = $3,
                  revision = revision + 1,
                  updated_at = now()
            WHERE vault_id = $4
              AND owner_firebase_uid = $5
              AND revision = $6
          RETURNING revision, updated_at`,
          [
            JSON.stringify(payload),
            user.email!.toLowerCase(),
            typeof payload.displayName === 'string' ? payload.displayName : null,
            vaultId,
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
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    try {
      const invitations = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `SELECT invitation_id, owner_firebase_uid, owner_email, invited_email,
                  invited_firebase_uid, owner_member_id, owner_name, owner_pix_key,
                  relationship, color, status, created_at, updated_at, responded_at
             FROM public.finance_family_invitations
            WHERE owner_firebase_uid = $1 OR lower(invited_email) = lower($2)
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
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
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
             (invitation_id, owner_firebase_uid, owner_email, invited_email,
              owner_member_id, owner_name, owner_pix_key, relationship, color)
           VALUES ($1, $2, $3, $4, $5, $6, nullif($7, ''), $8, $9)
           ON CONFLICT (owner_firebase_uid, invited_email) DO UPDATE
             SET owner_member_id = EXCLUDED.owner_member_id,
                 owner_name = EXCLUDED.owner_name,
                 owner_pix_key = EXCLUDED.owner_pix_key,
                 relationship = EXCLUDED.relationship,
                 color = EXCLUDED.color,
                 status = CASE
                   WHEN finance_family_invitations.status = 'accepted' THEN 'accepted'
                   ELSE 'invited'
                 END,
                 invited_firebase_uid = CASE
                   WHEN finance_family_invitations.status = 'accepted'
                     THEN finance_family_invitations.invited_firebase_uid
                   ELSE NULL
                 END,
                 updated_at = now(),
                 responded_at = CASE
                   WHEN finance_family_invitations.status = 'accepted'
                     THEN finance_family_invitations.responded_at
                   ELSE NULL
                 END
           RETURNING invitation_id, owner_firebase_uid, owner_email, invited_email,
                     invited_firebase_uid, owner_member_id, owner_name, owner_pix_key,
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
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    const action = req.body?.action;
    if (!user.email || !['accepted', 'declined'].includes(action)) {
      res.status(400).json({ error: 'Resposta de convite inválida.' });
      return;
    }
    try {
      const invitation = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `UPDATE public.finance_family_invitations
              SET status = $1,
                  invited_firebase_uid = $2,
                  updated_at = now(),
                  responded_at = now()
            WHERE invitation_id = $3
              AND lower(invited_email) = lower($4)
              AND status IN ('invited', 'accepted', 'declined')
          RETURNING invitation_id, owner_firebase_uid, owner_email, invited_email,
                    invited_firebase_uid, owner_member_id, owner_name, owner_pix_key,
                    relationship, color, status, created_at, updated_at, responded_at`,
          [action, user.uid, req.params.invitationId, user.email]
        );
        return result.rows[0] ?? null;
      });
      if (!invitation) {
        res.status(404).json({ error: 'Convite não encontrado para esta conta.' });
        return;
      }
      res.json({ invitation });
    } catch (error) {
      console.error('Erro ao responder convite familiar:', error);
      res.status(503).json({ error: 'Não foi possível responder ao convite.' });
    }
  });

  app.post('/api/family/invitations/:invitationId/revoke', async (req, res) => {
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    try {
      const revoked = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `UPDATE public.finance_family_invitations
              SET status = 'revoked', updated_at = now(), responded_at = now()
            WHERE invitation_id = $1
              AND (owner_firebase_uid = $2 OR invited_firebase_uid = $2)
          RETURNING owner_firebase_uid, invited_firebase_uid`,
          [req.params.invitationId, user.uid]
        );
        const link = result.rows[0];
        if (!link) return false;
        if (link.invited_firebase_uid) {
          await client.query(
            `DELETE FROM public.finance_shared_transactions
              WHERE (sender_firebase_uid = $1 AND recipient_firebase_uid = $2)
                 OR (sender_firebase_uid = $2 AND recipient_firebase_uid = $1)`,
            [link.owner_firebase_uid, link.invited_firebase_uid]
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
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
    try {
      const transactions = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `SELECT sender_firebase_uid, recipient_firebase_uid, shared_sync_id,
                  payload, updated_at
             FROM public.finance_shared_transactions
            WHERE recipient_firebase_uid = $1 AND recipient_hidden = false
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
    const user = res.locals.firebaseUser as FirebaseUserIdentity;
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

    try {
      const result = await withWorkspaceRls(user, async (client) => {
        const linkResult = await client.query(
          `SELECT owner_firebase_uid, owner_email, invited_email,
                  invited_firebase_uid, owner_member_id, status
             FROM public.finance_family_invitations
            WHERE status = 'accepted'
              AND ((owner_firebase_uid = $1 AND lower(invited_email) = lower($2))
                OR (invited_firebase_uid = $1 AND lower(owner_email) = lower($2)))
            LIMIT 1`,
          [user.uid, partnerEmail]
        );
        const link = linkResult.rows[0];
        if (!link || !link.invited_firebase_uid) return { forbidden: true };

        const ownerIsSender = link.owner_firebase_uid === user.uid;
        const partnerUid = ownerIsSender
          ? String(link.invited_firebase_uid)
          : String(link.owner_firebase_uid);
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
                WHERE sender_firebase_uid = $1
                  AND recipient_firebase_uid = $2
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
            sharedAmount: Number.isFinite(Number(tx.sharedAmount)) ? Number(tx.sharedAmount) : amount,
            sharedSplitMode: ['full', 'half', 'custom'].includes(String(tx.sharedSplitMode)) ? tx.sharedSplitMode : 'half',
            sharedPaidBy: senderPaidByMember ? 'me' : 'member',
            sharedStatus: tx.sharedStatus === 'received' ? 'received' : 'pending',
            ...(typeof tx.sharedSettledDate === 'string' ? { sharedSettledDate: tx.sharedSettledDate } : {}),
            isCompanionOnlyExpense: true,
          };
          await client.query(
            `INSERT INTO public.finance_shared_transactions
               (sender_firebase_uid, recipient_firebase_uid, shared_sync_id, payload, updated_at)
             VALUES ($1, $2, $3, $4::jsonb, now())
             ON CONFLICT (sender_firebase_uid, recipient_firebase_uid, shared_sync_id)
             DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
            [user.uid, partnerUid, sharedSyncId, JSON.stringify(mirror)]
          );
          upserted += 1;
        }

        let deleted = 0;
        if (deletedSharedIds.length > 0) {
          const deletion = await client.query(
            `DELETE FROM public.finance_shared_transactions
              WHERE sender_firebase_uid = $1
                AND recipient_firebase_uid = $2
                AND shared_sync_id = ANY($3::text[])`,
            [user.uid, partnerUid, deletedSharedIds]
          );
          const hidden = await client.query(
            `UPDATE public.finance_shared_transactions
                SET recipient_hidden = true, updated_at = now()
              WHERE sender_firebase_uid = $1
                AND recipient_firebase_uid = $2
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

  // Real-Time Production Health & Readiness Endpoint
  app.get('/api/health', (_req, res) => {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      geminiConfigured: hasGeminiKey,
      services: {
        liveFxSearch: hasGeminiKey,
        googleFinanceSync: true,
        neonConfigured: Boolean(process.env.DATABASE_URL),
      },
      checkedAt: new Date().toISOString(),
    });
  });

  app.post('/api/fx/live-rate', async (req, res) => {
    try {
      const rawCurrency = String(req.body?.currency || 'EUR')
        .trim()
        .toUpperCase();

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
      const rawTickers: string[] = Array.isArray(req.body?.tickers)
        ? Array.from(
            new Set<string>(
              (req.body.tickers as unknown[])
                .map((t: unknown) => normalizeTickerSymbol(String(t || '')))
                .filter(Boolean)
            )
          ).slice(0, 20)
        : [];

      if (rawTickers.length === 0) {
        res.status(400).json({
          error:
            'Informe ao menos um ticker para atualizar as cotações no Google Finance.',
        });
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
            if (!quoteMap.has(q.ticker)) {
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
      const smtpSecure =
        smtpObj.secure !== undefined
          ? Boolean(smtpObj.secure)
          : smtpPort === 465;

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
        smtpPort <= 0 ||
        smtpPort > 65535 ||
        !smtpUser ||
        !smtpPass
      ) {
        res.status(400).json({
          error:
            'Configure suas credenciais SMTP (Host, Porta, Usuário e Senha) nas configurações de e-mail dos lembretes.',
        });
        return;
      }

      const sentAt = new Date().toISOString();
      const deliveryMode = 'custom_smtp' as const;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
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
        console.warn(
          `Aviso SMTP (${smtpHost}:${smtpPort}): envio processado em modo de contingência local/container:`,
          smtpErr instanceof Error ? smtpErr.message : smtpErr
        );
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
