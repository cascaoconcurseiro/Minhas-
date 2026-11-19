/** Apoio à família: projeção de compartilhados, contas existentes e dados do convite. */
import { applySharedFamilySnapshot, type FamilyProjectionLink } from './sharedWorkspaceProjection.ts';
import { deriveFamilyInviteCode } from './authSession.ts';
import type { AuthUserIdentity } from './authUser.ts';
import { getNeonPool, withWorkspaceRls } from './database.ts';

export async function projectAcceptedFamilyLinks(user: AuthUserIdentity, revision: number) {
  try {
    await withWorkspaceRls(user, async (client) => {
      const links = await client.query<FamilyProjectionLink>(
        `SELECT owner_user_id, owner_email, invited_email, invited_user_id, owner_member_id
           FROM public.finance_family_invitations
          WHERE status = 'accepted' AND invited_user_id IS NOT NULL
            AND (owner_user_id = $1 OR invited_user_id = $1)
          ORDER BY invitation_id FOR UPDATE`,
        [user.uid]
      );
      if (!links.rows.length) return;
      const result = await client.query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM public.finance_workspaces
          WHERE owner_user_id = $1 AND revision = $2 LIMIT 1 FOR UPDATE`,
        [user.uid, revision]
      );
      const payload = result.rows[0]?.payload;
      if (!payload || payload.sharedWorkspaceProjection !== true) return;
      for (const link of links.rows) {
        const partnerEmail = (link.owner_user_id === user.uid ? link.invited_email : link.owner_email).trim().toLowerCase();
        await applySharedFamilySnapshot(client, user, link, partnerEmail, [], [], payload);
      }
    });
  } catch (error) {
    // O workspace já foi confirmado. O próximo salvamento ou a leitura da família tenta novamente.
    console.error('Não foi possível projetar os compartilhados do workspace confirmado.', error);
  }
}

/**
 * Quais e-mails já têm conta. Só serve para avisar quem convidou que a pessoa ainda precisa criar a conta
 * (o app não envia e-mail). Devolve null se a consulta falhar: o aviso some, o convite continua funcionando.
 */
export async function findRegisteredEmails(emails: string[]): Promise<Set<string> | null> {
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return new Set();
  try {
    const result = await getNeonPool().query(
      'SELECT lower(email) AS email FROM public.app_users WHERE lower(email) = ANY($1::text[])',
      [unique]
    );
    return new Set(result.rows.map((row: { email: unknown }) => String(row.email)));
  } catch (error) {
    console.warn('Não foi possível conferir se o convidado já tem conta:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Nos convites pendentes enviados por este usuário: `invite_code` (o código que a pessoa convidada precisa
 * digitar para aceitar) e `invited_has_account` (se a consulta de contas funcionou). Quem foi convidado nunca
 * recebe esses campos.
 */
export async function withOwnerInviteInfo<
  T extends { owner_user_id: string; invitation_id: string; invited_email: string; status: string; created_at?: unknown }
>(
  invitations: T[],
  userUid: string
): Promise<Array<T & { invite_code?: string; invited_has_account?: boolean }>> {
  const isOwnPending = (row: T) => row.owner_user_id === userUid && row.status === 'invited';
  const pending = invitations.filter(isOwnPending);
  if (pending.length === 0) return invitations;
  const registered = await findRegisteredEmails(pending.map((row) => row.invited_email));
  return invitations.map((row) =>
    isOwnPending(row)
      ? {
          ...row,
          invite_code: deriveFamilyInviteCode(row.invitation_id, row.created_at),
          ...(registered ? { invited_has_account: registered.has(String(row.invited_email).trim().toLowerCase()) } : {}),
        }
      : row
  );
}
