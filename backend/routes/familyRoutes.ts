/** Família: convites, código de aceite, revogação e despesas compartilhadas. Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import { createHash } from 'crypto';
import { createAttemptLimiter, isFamilyInviteCodeValid } from '.././authSession.ts';
import { normalizeSharedAmount } from '.././sharedTransactionValidation.ts';
import { applySharedFamilySnapshot } from '.././sharedWorkspaceProjection.ts';
import type { AuthUserIdentity } from '../authUser.ts';
import { withWorkspaceRls } from '../database.ts';
import { withOwnerInviteInfo } from '../familyHelpers.ts';
import type { GuardsApi } from './guards.ts';

export function registerFamilyRoutes(app: Express, ctx: GuardsApi) {
  const {
    createUsageLimit,
  } = ctx;
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
      res.json({ invitations: await withOwnerInviteInfo(invitations, user.uid) });
    } catch (error) {
      console.error('Erro ao carregar convites familiares:', error);
      res.status(503).json({ error: 'Não foi possível carregar os convites familiares.' });
    }
  });

  // Convidar também revela se o e-mail tem conta: limite por usuário para ninguém testar e-mails em massa.
  app.post('/api/family/invitations', createUsageLimit(20, 60 * 60 * 1000, 'Muitos convites em pouco tempo. Aguarde uma hora e tente de novo.'), async (req, res) => {
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
                 -- Convite recusado ou revogado que volta a ser enviado ganha código novo (o código nasce de created_at);
                 -- convite ainda pendente mantém o código que já foi passado à pessoa.
                 created_at = CASE
                   WHEN finance_family_invitations.status IN ('declined', 'revoked') THEN now()
                   ELSE finance_family_invitations.created_at
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
      res.status(201).json({ invitation: (await withOwnerInviteInfo([invitation], user.uid))[0] });
    } catch (error) {
      console.error('Erro ao criar convite familiar:', error);
      res.status(503).json({ error: 'Não foi possível salvar o convite familiar.' });
    }
  });

  // Aceitar exige o código do convite (criar conta com o e-mail convidado não basta). Errar o código muitas
  // vezes bloqueia o usuário por uma hora, para ninguém adivinhar.
  const inviteCodeLimiter = createAttemptLimiter(8, 60 * 60 * 1000);
  app.post('/api/family/invitations/:invitationId/respond', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    const action = req.body?.action;
    if (!user.email || !['accepted', 'declined'].includes(action)) {
      res.status(400).json({ error: 'Resposta de convite inválida.' });
      return;
    }
    if (action === 'accepted' && inviteCodeLimiter.isBlocked(user.uid)) {
      res.status(429).json({ error: 'Muitas tentativas com código errado. Aguarde uma hora e tente de novo.' });
      return;
    }
    try {
      const response = await withWorkspaceRls(user, async (client) => {
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
        if (!existing) return { notFound: true as const };

        if (existing.status === 'invited') {
          if (
            action === 'accepted' &&
            !isFamilyInviteCodeValid(req.body?.code, existing.invitation_id, existing.created_at)
          ) {
            return { badCode: true as const };
          }
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
          return result.rows[0] ? { invitation: result.rows[0] } : { notFound: true as const };
        }

        // A repeated identical response is safe and idempotent (sem pedir o código de novo). A different
        // action after the invitation is terminal must not silently replace it.
        if (existing.invited_user_id !== user.uid) return { notFound: true as const };
        if (existing.status === action) return { invitation: existing };
        return { conflict: true as const };
      });
      if ('notFound' in response) {
        res.status(404).json({ error: 'Convite não encontrado para esta conta.' });
        return;
      }
      if ('badCode' in response) {
        inviteCodeLimiter.recordFailure(user.uid);
        res.status(403).json({ error: 'Código do convite incorreto. Peça o código a quem convidou.' });
        return;
      }
      if ('conflict' in response) {
        res.status(409).json({ error: 'Este convite já recebeu uma resposta diferente.' });
        return;
      }
      if (action === 'accepted') inviteCodeLimiter.reset(user.uid);
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
      const outgoingRows = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `SELECT shared_sync_id, payload ->> 'recipientSharedStatus' AS status,
                  payload ->> 'recipientSettledDate' AS date,
                  (payload ->> 'paymentMethod' = 'credit_card' AND NOT (payload ? 'sharedDueDate')) AS missing_due_date
             FROM public.finance_shared_transactions
            WHERE sender_user_id = $1`, [user.uid]);
        return result.rows;
      });
      const outgoing = outgoingRows
        .filter((row) => row.status === 'received' || row.status === 'pending')
        .map((row) => ({ shared_sync_id: row.shared_sync_id, status: row.status, date: row.date }));
      res.json({ workspaceProjectionSupported: true, transactions: transactions.map((row) => ({ ...row, payload: {
        ...row.payload,
        ...(row.payload.recipientSharedStatus ? { sharedStatus: row.payload.recipientSharedStatus,
          sharedSettledDate: row.payload.recipientSettledDate || undefined } : {}),
      } })), outgoingSettlements: outgoing,
      // Ids já enviados por esta conta: o app reenvia os compartilhados que faltam (ex.: lançados antes do aceite).
      outgoingSharedIds: outgoingRows.map((row) => String(row.shared_sync_id)),
      // Espelhos de cartão que o servidor tem sem o vencimento da fatura (enviados por app antigo): o app novo completa.
      outgoingSharedStaleIds: outgoingRows.filter((row) => row.missing_due_date === true).map((row) => String(row.shared_sync_id)) });
    } catch (error) {
      console.error('Erro ao carregar lançamentos compartilhados:', error);
      res.status(503).json({ error: 'Não foi possível carregar os lançamentos compartilhados.' });
    }
  });

  app.put('/api/family/shared', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    const partnerEmail = String(req.body?.partnerEmail || '').trim().toLowerCase();
    const workspaceRevision = req.body?.workspaceRevision;
    const projectsWorkspace = workspaceRevision !== undefined;
    const transactions = projectsWorkspace ? [] : req.body?.transactions;
    const deletedSharedIds = Array.isArray(req.body?.deletedSharedIds)
      ? req.body.deletedSharedIds.map((id: unknown) => String(id).replace(/^tx-mirror-/, ''))
      : [];
    if (
      !user.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail) ||
      !Array.isArray(transactions) ||
      transactions.length > 5000 ||
      deletedSharedIds.length > 5000 ||
      (projectsWorkspace && (!Number.isSafeInteger(workspaceRevision) || workspaceRevision < 1))
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

        // Hold the authoritative revision until all mirror writes and deletions commit.
        const workspace = await client.query(
          `SELECT vault_id, payload, revision, updated_at FROM public.finance_workspaces
            WHERE owner_user_id = $1 LIMIT 1 FOR UPDATE`,
          [user.uid]
        );
        const current = workspace.rows[0];
        if (projectsWorkspace && Number(current?.revision) !== workspaceRevision) {
          return { stale: true };
        }
        const legacyForProjectedWorkspace = !projectsWorkspace && current?.payload?.sharedWorkspaceProjection === true;
        if (legacyForProjectedWorkspace && deletedSharedIds.length === 0) {
          return { stale: true };
        }
        if (projectsWorkspace && current.payload.sharedWorkspaceProjection !== true) {
          await client.query(
            `UPDATE public.finance_workspaces
                SET payload = payload || '{"sharedWorkspaceProjection":true}'::jsonb
              WHERE owner_user_id = $1`,
            [user.uid]
          );
        }

        return {
          forbidden: false,
          ...await applySharedFamilySnapshot(client, user, link, partnerEmail,
            legacyForProjectedWorkspace ? [] : transactions, deletedSharedIds,
            projectsWorkspace ? current.payload : undefined, legacyForProjectedWorkspace),
        };
      });
      if (result.forbidden) {
        res.status(403).json({ error: 'O compartilhamento exige convite familiar aceito.' });
        return;
      }
      if ('stale' in result) {
        res.status(409).json({ error: 'A versão do workspace mudou. Atualize antes de sincronizar os compartilhados.' });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error('Erro ao sincronizar lançamentos familiares no Neon:', error);
      res.status(503).json({ error: 'Não foi possível sincronizar os lançamentos compartilhados.' });
    }
  });
}
