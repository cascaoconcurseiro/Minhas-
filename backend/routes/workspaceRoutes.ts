/** Workspace do usuário: ler, revisão, criar e salvar (revisão otimista). Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import { getVaultIdForUid } from '../../shared/workspaceIdentity.ts';
import type { AuthUserIdentity } from '../authUser.ts';
import { withWorkspaceRls } from '../database.ts';
import { getRequestWorkspacePayload, getWorkspaceReceivableIssues } from '../workspaceRequest.ts';
import { projectAcceptedFamilyLinks } from '../familyHelpers.ts';

export function registerWorkspaceRoutes(app: Express) {
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
          throw new Error('Mais de um workspace está associado a esta identidade.');
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

  // Consulta leve (só a revisão) para os aparelhos perceberem em segundos que outro aparelho gravou.
  app.get('/api/workspace/revision', async (_req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    try {
      const revision = await withWorkspaceRls(user, async (client) => {
        const result = await client.query(
          `SELECT revision FROM public.finance_workspaces WHERE owner_user_id = $1 LIMIT 1`,
          [user.uid]
        );
        return result.rows[0] ? Number(result.rows[0].revision) : null;
      });
      res.set('Cache-Control', 'no-store');
      res.json({ revision });
    } catch (error) {
      console.error('Erro ao consultar revisão do workspace Neon:', error);
      res.status(503).json({ error: 'Não foi possível consultar a revisão.' });
    }
  });

  app.post('/api/workspace', async (req, res) => {
    const user = res.locals.authUser as AuthUserIdentity;
    if (!user.email) {
      res.status(403).json({ error: 'A conta precisa ter um e-mail.' });
      return;
    }
    const vaultId = getVaultIdForUid(user.uid);
    const payload = getRequestWorkspacePayload(req.body?.payload, vaultId);
    if (!payload || getWorkspaceReceivableIssues(payload).size > 0) {
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
      if (payload.sharedWorkspaceProjection === true) {
        await projectAcceptedFamilyLinks(user, Number(created.revision));
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
      res.status(403).json({ error: 'A conta precisa ter um e-mail.' });
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
      const receivableIssues = getWorkspaceReceivableIssues(payload);
      const updated = await withWorkspaceRls(user, async (client) => {
        if (receivableIssues.size > 0) {
          const previous = await client.query<{ payload: Record<string, unknown> }>(
            `SELECT payload FROM public.finance_workspaces
              WHERE owner_user_id = $1 AND revision = $2 LIMIT 1 FOR UPDATE`,
            [user.uid, expectedRevision]
          );
          if (!previous.rows[0]) return null;
          const previousIssues = getWorkspaceReceivableIssues(previous.rows[0].payload);
          if ([...receivableIssues].some(([id, issue]) => previousIssues.get(id) !== issue)) return 'invalid_receivable';
        }
        const result = await client.query(
          `UPDATE public.finance_workspaces
              SET vault_id = $1,
                  payload = $2::jsonb || CASE
                    WHEN payload -> 'sharedWorkspaceProjection' = 'true'::jsonb
                      THEN '{"sharedWorkspaceProjection":true}'::jsonb
                    ELSE '{}'::jsonb
                  END,
                  owner_email = $3,
                  display_name = $4,
                  revision = revision + 1,
                  updated_at = now()
            WHERE owner_user_id = $5
              AND revision = $6
          RETURNING revision, updated_at, payload -> 'sharedWorkspaceProjection' AS shared_workspace_projection`,
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
      if (updated === 'invalid_receivable') {
        res.status(400).json({ error: 'Há movimentos inconsistentes com os registros em A Receber.' });
        return;
      }
      if (!updated) {
        res.status(409).json({ error: 'Workspace ausente ou revisão desatualizada.' });
        return;
      }
      if (updated.shared_workspace_projection === true) {
        await projectAcceptedFamilyLinks(user, Number(updated.revision));
      }
      res.json({ revision: Number(updated.revision), updatedAt: updated.updated_at });
    } catch (error) {
      console.error('Erro ao salvar workspace Neon:', error);
      res.status(503).json({ error: 'Não foi possível salvar os dados em nuvem.' });
    }
  });
}
