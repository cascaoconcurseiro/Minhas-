import type { PoolClient } from 'pg';
import { normalizeSharedAmount, normalizeSharedDueDate } from './sharedTransactionValidation.ts';
import { getClampedMonthDate } from '../src/domain/finance/formatting.ts';
import { parseSharedSettlementReceipts } from '../src/domain/family/sharedSettlementReceipts.ts';
import { parseWorkspaceArray } from '../src/services/workspace/workspacePayload.ts';

export interface FamilyProjectionLink {
  owner_user_id: string;
  invited_user_id: string;
  owner_member_id: string;
  owner_email: string;
  invited_email: string;
}

export async function applySharedFamilySnapshot(
  client: PoolClient,
  user: { uid: string; email: string },
  link: FamilyProjectionLink,
  partnerEmail: string,
  transactions: Array<Record<string, unknown>>,
  deletedSharedIds: string[],
  workspacePayload?: Record<string, unknown>,
  hideOnly = false,
) {
  const projectsWorkspace = workspacePayload !== undefined;
  const ownerIsSender = link.owner_user_id === user.uid;
  const partnerUid = ownerIsSender ? link.invited_user_id : link.owner_user_id;
  const senderEmail = user.email.toLowerCase();
  const recipientEmail = partnerEmail;
  const recipientMemberId = ownerIsSender
    ? `fam-inv-${senderEmail.replace(/[^a-z0-9]/g, '_')}`
    : String(link.owner_member_id);
  let upserted = 0;
  let settled = 0;
  const projectedMirrors = new Map<string, Record<string, unknown>>();
  let sharingEntries = transactions as Array<Record<string, unknown>>;
  if (projectsWorkspace) {
    const members = parseWorkspaceArray<Record<string, unknown>>(workspacePayload.familyMembersJson, [], 'familyMembersJson');
    const memberIds = new Set(
      members.filter((member) =>
        String(member.email || member.invitedByEmail || '').trim().toLowerCase() === partnerEmail
      ).map((member) => String(member.id))
    );
    memberIds.add(ownerIsSender ? String(link.owner_member_id) : `fam-inv-${partnerEmail.replace(/[^a-z0-9]/g, '_')}`);
    const cards = parseWorkspaceArray<Record<string, unknown>>(workspacePayload.cardsJson, [], 'cardsJson');
    const dueDays = new Map(cards.map((card) => [card.id, Number(card.dueDay)]));
    sharingEntries = parseWorkspaceArray<Record<string, unknown>>(workspacePayload.transactionsJson, [], 'transactionsJson')
      .filter((tx) => tx.type === 'expense' && tx.isShared === true && !tx.tripId && !tx.receivableId &&
        !String(tx.id).startsWith('tx-mirror-') && memberIds.has(String(tx.sharedMemberId)))
      .map((tx) => {
        const dueDay = dueDays.get(tx.creditCardId);
        return dueDay && typeof tx.competenceMonth === 'string'
          ? { ...tx, sharedDueDate: getClampedMonthDate(tx.competenceMonth, dueDay) }
          : tx;
      });
  }

  for (const tx of sharingEntries) {
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
                THEN payload - 'recipientSettledDate'
                ELSE jsonb_set(payload, '{recipientSettledDate}', to_jsonb($5::text), true)
              END,
              '{recipientSharedStatus}', to_jsonb($4::text), true
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
    const sharedDueDate = normalizeSharedDueDate(tx.sharedDueDate);
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
      ...(typeof tx.installmentPurchaseTotal === 'number' && Number.isFinite(tx.installmentPurchaseTotal) &&
        tx.installmentPurchaseTotal >= 0 && Number.isSafeInteger(Math.round(tx.installmentPurchaseTotal * 100))
        ? { installmentPurchaseTotal: tx.installmentPurchaseTotal } : {}),
      ...(typeof tx.notes === 'string' ? { notes: tx.notes.slice(0, 2000) } : {}),
      isShared: true,
      sharedMemberId: recipientMemberId,
      sharedAmount: sharedAmount ?? amount,
      sharedSplitMode: ['full', 'half', 'custom'].includes(String(tx.sharedSplitMode)) ? tx.sharedSplitMode : 'half',
      sharedPaidBy: senderPaidByMember ? 'me' : 'member',
      sharedStatus: tx.sharedStatus === 'received' ? 'received' : 'pending',
      ...(typeof tx.sharedSettledDate === 'string' ? { sharedSettledDate: tx.sharedSettledDate } : {}),
      ...(sharedDueDate ? { sharedDueDate } : {}),
      isCompanionOnlyExpense: true,
    };
    if (projectsWorkspace) {
      projectedMirrors.set(sharedSyncId, mirror);
      continue;
    }
    await client.query(
      `INSERT INTO public.finance_shared_transactions
         (sender_user_id, recipient_user_id, shared_sync_id, payload, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now())
       ON CONFLICT (sender_user_id, recipient_user_id, shared_sync_id)
       DO UPDATE SET payload = EXCLUDED.payload || jsonb_strip_nulls(jsonb_build_object(
         'recipientSharedStatus', public.finance_shared_transactions.payload -> 'recipientSharedStatus',
         'recipientSettledDate', public.finance_shared_transactions.payload -> 'recipientSettledDate'
       )), updated_at = now()`,
      [user.uid, partnerUid, sharedSyncId, JSON.stringify(mirror)]
    );
    upserted += 1;
  }

  let deleted = 0;
  if (projectsWorkspace) {
    const written = await client.query(
      `INSERT INTO public.finance_shared_transactions
         (sender_user_id, recipient_user_id, shared_sync_id, payload, updated_at)
       SELECT $1, $2, projected.sync_id, projected.mirror, now()
         FROM jsonb_to_recordset($3::jsonb) AS projected(sync_id text, mirror jsonb)
       ON CONFLICT (sender_user_id, recipient_user_id, shared_sync_id)
       DO UPDATE SET payload = EXCLUDED.payload || jsonb_strip_nulls(jsonb_build_object(
         'recipientSharedStatus', finance_shared_transactions.payload -> 'recipientSharedStatus',
         'recipientSettledDate', finance_shared_transactions.payload -> 'recipientSettledDate'
       )), updated_at = now()
       WHERE finance_shared_transactions.payload - 'recipientSharedStatus' - 'recipientSettledDate'
             IS DISTINCT FROM EXCLUDED.payload`,
      [user.uid, partnerUid, JSON.stringify([...projectedMirrors].map(([sync_id, mirror]) => ({ sync_id, mirror })))]
    );
    upserted = written.rowCount ?? 0;
    const receipts = parseSharedSettlementReceipts(workspacePayload.sharedSettlementReceiptsJson);
    const reported = await client.query(
      `UPDATE public.finance_shared_transactions AS shared
          SET payload = (shared.payload - 'recipientSettledDate') ||
              jsonb_strip_nulls(jsonb_build_object(
                'recipientSharedStatus', receipt.status, 'recipientSettledDate', receipt.date
              )), updated_at = now()
         FROM jsonb_to_recordset($3::jsonb) AS receipt(sync_id text, status text, date text)
        WHERE shared.sender_user_id = $1 AND shared.recipient_user_id = $2
          AND shared.shared_sync_id = receipt.sync_id
          AND (shared.payload ->> 'recipientSharedStatus', shared.payload ->> 'recipientSettledDate')
              IS DISTINCT FROM (receipt.status, receipt.date)`,
      [partnerUid, user.uid, JSON.stringify(receipts.map(({ id, status, date }) => ({
        sync_id: id.slice('tx-mirror-'.length), status, date: date ?? null,
      })))]
    );
    settled = reported.rowCount ?? 0;
    const removed = await client.query(
      `DELETE FROM public.finance_shared_transactions
        WHERE sender_user_id = $1 AND recipient_user_id = $2
          AND NOT (shared_sync_id = ANY($3::text[]))`,
      [user.uid, partnerUid, [...projectedMirrors.keys()]]
    );
    deleted = removed.rowCount ?? 0;
  }
  if (deletedSharedIds.length > 0) {
    const deletion = projectsWorkspace || hideOnly ? null : await client.query(
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
    deleted += (deletion?.rowCount ?? 0) + (hidden.rowCount ?? 0);
  }
  return { upserted, settled, deleted };
}
