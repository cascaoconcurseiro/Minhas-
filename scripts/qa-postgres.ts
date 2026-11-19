import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { collectSharedSettlementReceipts, restoreSharedSettlementReceipts, settleSharedExpenses, reopenSharedSettlement } from '../src/domain/family/sharedFinanceRules';
import { createReceivable, registerReceivablePayment } from '../src/domain/receivables/receivables';
import type { BankAccount, Transaction } from '../src/types/finance';

const connection = process.env.QA_POSTGRES_URL;
assert.ok(connection, 'QA_POSTGRES_URL is required; no production fallback is allowed');
const url = new URL(connection);
assert.ok(process.env.CI === 'true' && ['localhost','127.0.0.1'].includes(url.hostname) && url.pathname === '/neondb', 'Only the disposable localhost CI database is allowed');
const admin = new Pool({ connectionString: connection });
assert.equal((await admin.query('SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = $1', ['public'])).rows[0].count, 0, 'QA database must be empty');
await admin.query('CREATE ROLE minhas_app NOLOGIN');
const migrations = (await readdir(new URL('../db/migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort();
for (const migration of migrations) await admin.query(await readFile(new URL(`../db/migrations/${migration}`, import.meta.url), 'utf8'));
console.log(`PASS: ${migrations.length} repository migrations applied to empty PostgreSQL`);
await admin.query("ALTER ROLE minhas_app_runtime LOGIN PASSWORD 'qa-only-runtime-password'");
url.username = 'minhas_app_runtime';
url.password = 'qa-only-runtime-password';
process.env.DATABASE_URL = url.toString();
process.env.AUTH_SESSION_SECRET = 'qa-only-session-secret-minimum-thirty-two-characters';
process.env.VERCEL = '1';
const { default: app } = await import('../backend/app.ts');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, token = '', method = 'GET', body?: unknown, expected = 200) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const owner = await request('/api/auth/register', '', 'POST', { email:'owner@qa.example',password:'qa-only-password',name:'QA Owner' },201);
const recipient = await request('/api/auth/register', '', 'POST', { email:'recipient@qa.example',password:'qa-only-password',name:'QA Recipient' },201);
const outsider = await request('/api/auth/register', '', 'POST', { email:'outsider@qa.example',password:'qa-only-password',name:'QA Outsider' },201);
console.log('PASS: three separate authenticated identities registered with real runtime role');
const invite = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'recipient@qa.example',ownerMemberId:'qa-member',ownerName:'QA Owner'},201);
await request(`/api/family/invitations/${invite.invitation.invitation_id}/respond`,recipient.token,'POST',{action:'accepted',code:invite.invitation.invite_code});
const purchase = { id:'qa-purchase',description:'QA purchase',amount:100,date:'2026-11-11',competenceMonth:'2026-11',type:'expense',status:'pending',categoryId:'food',paymentMethod:'pix',recurrence:'single',isShared:true,sharedAmount:50,sharedMemberId:'qa-member',sharedPaidBy:'me',sharedStatus:'pending' };
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'recipient@qa.example',transactions:[purchase]});
const incoming = await request('/api/family/shared',recipient.token);
assert.equal(incoming.transactions.length,1);
const mirror = incoming.transactions[0].payload as Transaction;
assert.equal(mirror.sharedPaidBy,'member');
assert.equal((await request('/api/family/shared',outsider.token)).transactions.length,0);
assert.equal((await request('/api/family/shared',outsider.token)).outgoingSettlements.length,0);
console.log('PASS: shared purchase readback and outsider isolation through real RLS');
const bank: BankAccount = {id:'qa-bank',name:'QA bank',institution:'QA',type:'checking',initialBalance:100,includeInTotal:true,color:'#000000'};
const settled = settleSharedExpenses([mirror],[bank],{txId:mirror.id,memberName:'Owner',accountId:bank.id,date:'2026-11-12',settlementId:'qa-local-receipt'});
assert.equal(settled.netAmount,-50);
await request('/api/family/shared',recipient.token,'PUT',{partnerEmail:'owner@qa.example',transactions:settled.transactions.filter(tx=>tx.id.startsWith('tx-mirror-'))});
const reports = await request('/api/family/shared',owner.token);
assert.equal(reports.outgoingSettlements[0].status,'received');
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'recipient@qa.example',transactions:[{...purchase,description:'QA updated'}]});
assert.equal((await request('/api/family/shared',recipient.token)).transactions[0].payload.sharedStatus,'received');
console.log('PASS: recipient settlement returns to owner and survives actual PostgreSQL ON CONFLICT');
const payload = {uid:'ignored',updatedAt:new Date().toISOString(),accountsJson:JSON.stringify([bank]),cardsJson:'[]',categoriesJson:'[]',transactionsJson:JSON.stringify(settled.transactions.filter(tx=>!tx.id.startsWith('tx-mirror-'))),goalsJson:'[]',investmentsJson:'[]',sharedSettlementReceiptsJson:JSON.stringify(collectSharedSettlementReceipts(settled.transactions))};
await request('/api/workspace',recipient.token,'POST',{payload},201);
const saved = await request('/api/workspace',recipient.token);
const freshIncoming = await request('/api/family/shared',recipient.token);
const local = JSON.parse(saved.payload.transactionsJson) as Transaction[];
const restored = restoreSharedSettlementReceipts(freshIncoming.transactions.map((row: {payload:Transaction})=>row.payload),saved.payload.sharedSettlementReceiptsJson,local);
assert.equal(restored[0].sharedSettlementId,'qa-local-receipt');
assert.equal(settleSharedExpenses([...local,...restored],[bank],{txId:mirror.id,memberName:'Owner',accountId:bank.id,date:'2026-11-12',settlementId:'duplicate'}).affectedCount,0);
const reopened = reopenSharedSettlement([...local,...restored],mirror.id);
assert.equal(reopened.transactions.length,1);
await request('/api/family/shared',recipient.token,'PUT',{partnerEmail:'owner@qa.example',transactions:reopened.transactions});
assert.equal((await request('/api/family/shared',owner.token)).outgoingSettlements[0].status,'pending');
console.log('PASS: persisted receipt independent readback, reload, repeated settlement and reversal');
const updates = await Promise.all([1,2].map(n=>request('/api/workspace',recipient.token,'PUT',{payload:{...saved.payload,updatedAt:new Date().toISOString(),qaMarker:n},expectedRevision:saved.revision},200).then(()=>200).catch(error=>{assert.match(String(error),/409/);return 409;})));
assert.deepEqual(updates.sort(),[200,409]);
console.log('PASS: concurrent workspace writes reject stale revision');
await request(`/api/family/invitations/${invite.invitation.invitation_id}/revoke`,owner.token,'POST',{});
assert.equal((await request('/api/family/shared',recipient.token)).transactions.length,0);
assert.equal((await request('/api/family/shared',owner.token)).outgoingSettlements.length,0);
console.log('PASS: revocation removes incoming mirrors and outgoing settlement reports');

// --- Situações de convite: pessoa sem conta, conta criada depois, os dois sentidos, recusa, revogação e intrusos ---
const sharedItem = (id: string, extra: Record<string, unknown> = {}) => ({ id, description:`QA ${id}`, amount:80, date:'2026-12-01', competenceMonth:'2026-12', type:'expense', status:'pending', categoryId:'food', paymentMethod:'pix', recurrence:'single', isShared:true, sharedAmount:40, sharedPaidBy:'me', sharedStatus:'pending', sharedSplitMode:'half', ...extra });
const lateInvite = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'Late@QA.example',ownerMemberId:'qa-late-member',ownerName:'QA Owner',relationship:'cônjuge'},201);
assert.equal(lateInvite.invitation.status,'invited');
assert.equal(lateInvite.invitation.invited_email,'late@qa.example');
assert.equal(lateInvite.invitation.invited_user_id,null);
assert.equal(lateInvite.invitation.invited_has_account,false);
assert.equal((await request('/api/family/invitations',owner.token)).invitations.find((row: {invited_email:string})=>row.invited_email==='late@qa.example').invited_has_account,false);
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'late@qa.example',transactions:[sharedItem('late-backlog-1',{sharedMemberId:'qa-late-member'}),sharedItem('late-backlog-2',{sharedMemberId:'qa-late-member'})]},403);
console.log('PASS: invite to an e-mail with no account is stored, and nothing can be sent before acceptance (403)');
const lateAccount = await request('/api/auth/register','','POST',{email:'LATE@qa.example',password:'qa-only-password',name:'QA Late'},201);
assert.equal((await request('/api/family/invitations',owner.token)).invitations.find((row: {invited_email:string})=>row.invited_email==='late@qa.example').invited_has_account,true,'after the account exists the owner is told');
const lateInvites = (await request('/api/family/invitations',lateAccount.token)).invitations;
assert.equal('invited_has_account' in lateInvites[0],false,'the invited side never receives the account flag');
assert.equal('invite_code' in lateInvites[0],false,'the invited side never receives the invite code');
assert.match(lateInvite.invitation.invite_code,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
assert.equal(lateInvites.length,1);
assert.equal(lateInvites[0].status,'invited');
assert.equal(lateInvites[0].owner_email,'owner@qa.example');
assert.equal((await request('/api/family/invitations',outsider.token)).invitations.length,0);
await request('/api/family/shared',lateAccount.token,'PUT',{partnerEmail:'owner@qa.example',transactions:[sharedItem('late-before-accept')]},403);
await request(`/api/family/invitations/${lateInvite.invitation.invitation_id}/respond`,outsider.token,'POST',{action:'accepted'},404);
console.log('PASS: account created later finds the pending invite by e-mail; strangers cannot see or accept it; nothing flows before acceptance');
const accepted = await request(`/api/family/invitations/${lateInvite.invitation.invitation_id}/respond`,lateAccount.token,'POST',{action:'accepted',code:lateInvite.invitation.invite_code});
assert.equal(accepted.invitation.status,'accepted');
assert.equal('invited_has_account' in (await request('/api/family/invitations',owner.token)).invitations.find((row: {invited_email:string})=>row.invited_email==='late@qa.example'),false,'accepted invites no longer carry the flag');
assert.ok(accepted.invitation.invited_user_id);
assert.equal((await request('/api/family/invitations',owner.token)).invitations.find((row: {invited_email:string})=>row.invited_email==='late@qa.example').status,'accepted');
assert.deepEqual((await request('/api/family/shared',owner.token)).outgoingSharedIds,[]);
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'late@qa.example',transactions:[sharedItem('late-backlog-1',{sharedMemberId:'qa-late-member',paymentMethod:'credit_card',sharedDueDate:'2026-12-28'}),sharedItem('late-backlog-2',{sharedMemberId:'qa-late-member',paymentMethod:'credit_card',sharedDueDate:'2026-02-31'})]});
const lateIncoming = (await request('/api/family/shared',lateAccount.token)).transactions.map((row: {payload:Transaction})=>row.payload);
assert.deepEqual(lateIncoming.map((tx: Transaction)=>tx.id).sort(),['tx-mirror-late-backlog-1','tx-mirror-late-backlog-2']);
assert.ok(lateIncoming.every((tx: Transaction)=>tx.sharedPaidBy==='member' && tx.sharedMemberId==='fam-inv-owner_qa_example'));
assert.equal(lateIncoming.find((tx: Transaction)=>tx.id==='tx-mirror-late-backlog-1').sharedDueDate,'2026-12-28','invoice due date travels with the mirror');
assert.equal('sharedDueDate' in lateIncoming.find((tx: Transaction)=>tx.id==='tx-mirror-late-backlog-2'),false,'an impossible due date is dropped by the server');
assert.deepEqual((await request('/api/family/shared',owner.token)).outgoingSharedStaleIds,['late-backlog-2'],'a card mirror without a valid due date is reported as stale so the new app completes it');
assert.deepEqual((await request('/api/family/shared',owner.token)).outgoingSharedIds.sort(),['late-backlog-1','late-backlog-2']);
console.log('PASS: after acceptance the backlog launched before the account existed reaches the new account (owner -> invited)');
await request('/api/family/shared',lateAccount.token,'PUT',{partnerEmail:'owner@qa.example',transactions:[sharedItem('late-own-1',{sharedMemberId:'fam-inv-owner_qa_example'})]});
const ownerIncoming = (await request('/api/family/shared',owner.token)).transactions.map((row: {payload:Transaction})=>row.payload);
assert.equal(ownerIncoming.length,1);
assert.equal(ownerIncoming[0].id,'tx-mirror-late-own-1');
assert.equal(ownerIncoming[0].sharedMemberId,'qa-late-member');
assert.equal(ownerIncoming[0].sharedPaidBy,'member');
assert.equal(ownerIncoming[0].sharedAmount,40);
console.log('PASS: the invited account can also launch shared expenses and the owner receives them (invited -> owner), payer flipped');
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'late@qa.example',transactions:[sharedItem('late-backlog-1',{sharedMemberId:'qa-late-member',description:'QA edited',amount:100,sharedAmount:50})]});
const edited = (await request('/api/family/shared',lateAccount.token)).transactions.map((row: {payload:Transaction})=>row.payload).find((tx: Transaction)=>tx.id==='tx-mirror-late-backlog-1');
assert.equal(edited.description,'QA edited');
assert.equal(edited.sharedAmount,50);
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'late@qa.example',transactions:[],deletedSharedIds:['late-backlog-2']});
assert.deepEqual((await request('/api/family/shared',lateAccount.token)).transactions.map((row: {payload:Transaction})=>row.payload.id),['tx-mirror-late-backlog-1']);
await request('/api/family/shared',lateAccount.token,'PUT',{partnerEmail:'owner@qa.example',transactions:[],deletedSharedIds:['late-backlog-1']});
assert.equal((await request('/api/family/shared',lateAccount.token)).transactions.length,0);
assert.ok((await request('/api/family/shared',owner.token)).outgoingSharedIds.includes('late-backlog-1'),'a copy the recipient removed is not resent by the owner');
console.log('PASS: edits propagate, owner deletion removes the copy, recipient deletion hides it without being resent');
await request('/api/family/invitations','','POST',{invitedEmail:'x@qa.example',ownerMemberId:'m'},401);
await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'owner@qa.example',ownerMemberId:'m'},400);
await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'not-an-email',ownerMemberId:'m'},400);
console.log('PASS: invites to yourself, invalid e-mails and anonymous requests are rejected');
const declinerAccount = await request('/api/auth/register','','POST',{email:'decliner@qa.example',password:'qa-only-password',name:'QA Decliner'},201);
const declInvite = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'decliner@qa.example',ownerMemberId:'qa-decl-member',ownerName:'QA Owner'},201);
await request(`/api/family/invitations/${declInvite.invitation.invitation_id}/respond`,declinerAccount.token,'POST',{action:'declined'});
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'decliner@qa.example',transactions:[sharedItem('decl-1',{sharedMemberId:'qa-decl-member'})]},403);
const reInvite = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'decliner@qa.example',ownerMemberId:'qa-decl-member',ownerName:'QA Owner'},201);
assert.equal(reInvite.invitation.status,'invited');
await request(`/api/family/invitations/${declInvite.invitation.invitation_id}/respond`,declinerAccount.token,'POST',{action:'accepted',code:reInvite.invitation.invite_code});
assert.equal(reInvite.invitation.invite_code,declInvite.invitation.invite_code,'re-inviting keeps the same code, so a message already sent stays valid');
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'decliner@qa.example',transactions:[sharedItem('decl-1',{sharedMemberId:'qa-decl-member'})]});
assert.equal((await request('/api/family/shared',declinerAccount.token)).transactions.length,1);
console.log('PASS: a declined invite blocks sharing; re-inviting reopens it and the second acceptance works');
await request(`/api/family/invitations/${declInvite.invitation.invitation_id}/revoke`,declinerAccount.token,'POST',{});
assert.equal((await request('/api/family/shared',declinerAccount.token)).transactions.length,0);
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'decliner@qa.example',transactions:[sharedItem('decl-1',{sharedMemberId:'qa-decl-member'})]},403);
const afterRevoke = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'decliner@qa.example',ownerMemberId:'qa-decl-member',ownerName:'QA Owner'},201);
assert.equal(afterRevoke.invitation.status,'invited');
assert.equal(afterRevoke.invitation.invited_user_id,null);
await request(`/api/family/invitations/${declInvite.invitation.invitation_id}/respond`,declinerAccount.token,'POST',{action:'accepted',code:afterRevoke.invitation.invite_code});
assert.deepEqual((await request('/api/family/shared',owner.token)).outgoingSharedIds.includes('decl-1'),false,'revocation wiped the old copies, so the owner must resend them');
console.log('PASS: revoking by the invited side clears both directions; re-invite + acceptance starts clean and the owner can resend');

// --- Código do convite: criar conta com o e-mail convidado não basta para aceitar ---
const typoInvite = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'typo@qa.example',ownerMemberId:'qa-typo-member',ownerName:'QA Owner'},201);
const strangerAccount = await request('/api/auth/register','','POST',{email:'typo@qa.example',password:'qa-only-password',name:'QA Stranger'},201);
const strangerSees = (await request('/api/family/invitations',strangerAccount.token)).invitations[0];
assert.equal(strangerSees.status,'invited');
assert.equal('invite_code' in strangerSees,false,'the person with only the e-mail cannot read the code');
const typoRespond = `/api/family/invitations/${typoInvite.invitation.invitation_id}/respond`;
await request(typoRespond,strangerAccount.token,'POST',{action:'accepted'},403);
await request(typoRespond,strangerAccount.token,'POST',{action:'accepted',code:'AAAA-AAAA'},403);
assert.equal((await request('/api/family/invitations',owner.token)).invitations.find((row: {invited_email:string})=>row.invited_email==='typo@qa.example').status,'invited','wrong or missing codes leave the invite untouched');
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'typo@qa.example',transactions:[sharedItem('typo-1',{sharedMemberId:'qa-typo-member'})]},403);
assert.equal((await request('/api/family/shared',strangerAccount.token)).transactions.length,0,'the stranger receives nothing');
for (let attempt = 0; attempt < 6; attempt += 1) await request(typoRespond,strangerAccount.token,'POST',{action:'accepted',code:`ZZZ${attempt}-ZZZZ`},403);
await request(typoRespond,strangerAccount.token,'POST',{action:'accepted',code:typoInvite.invitation.invite_code},429);
console.log('PASS: a stranger who registers the invited e-mail cannot accept without the code; guessing is blocked after 8 mistakes');
const legitAccount = await request('/api/auth/register','','POST',{email:'legit@qa.example',password:'qa-only-password',name:'QA Legit'},201);
const legitInvite = await request('/api/family/invitations',owner.token,'POST',{invitedEmail:'legit@qa.example',ownerMemberId:'qa-legit-member',ownerName:'QA Owner'},201);
const legitRespond = `/api/family/invitations/${legitInvite.invitation.invitation_id}/respond`;
await request(legitRespond,legitAccount.token,'POST',{action:'accepted',code:legitInvite.invitation.invite_code.replace('-','').toLowerCase()});
await request(legitRespond,legitAccount.token,'POST',{action:'accepted'});
await request('/api/family/shared',owner.token,'PUT',{partnerEmail:'legit@qa.example',transactions:[sharedItem('legit-1',{sharedMemberId:'qa-legit-member'})]});
assert.equal((await request('/api/family/shared',legitAccount.token)).transactions.length,1);
console.log('PASS: the invited person with the right code (any case, with or without the dash) accepts, repeating is harmless, and sharing starts');

const canonicalItem = sharedItem('legit-1', { sharedMemberId: 'qa-legit-member', amount: 120, sharedAmount: 60 });
const canonicalPayload = {
  ...payload,
  transactionsJson: JSON.stringify([canonicalItem]),
  sharedSettlementReceiptsJson: '[]',
};
const canonical = await request('/api/workspace', owner.token, 'POST', { payload: canonicalPayload }, 201);
const projectFamily = (workspaceRevision: number, expected = 200) =>
  request('/api/family/shared', owner.token, 'PUT', { partnerEmail: 'legit@qa.example', workspaceRevision }, expected);
await projectFamily(canonical.revision);
assert.equal((await request('/api/family/shared', legitAccount.token)).transactions[0].payload.amount, 120);
const currentFamilyPayload = {
  ...canonicalPayload,
  transactionsJson: JSON.stringify([{ ...canonicalItem, amount: 200, sharedAmount: 100 }]),
};
const newerCanonical = await request('/api/workspace', owner.token, 'PUT', {
  payload: currentFamilyPayload,
  expectedRevision: canonical.revision,
});
assert.equal((await request('/api/family/shared', legitAccount.token)).transactions[0].payload.amount, 200,
  'a saved workspace from an older browser updates mirrors after opt-in');
await projectFamily(newerCanonical.revision);
await projectFamily(canonical.revision, 409);
await request('/api/family/shared', owner.token, 'PUT', {
  partnerEmail: 'legit@qa.example',
  transactions: [canonicalItem],
}, 409);
assert.equal((await request('/api/family/shared', legitAccount.token)).transactions[0].payload.amount, 200);

const recipientCanonical = await request('/api/workspace', legitAccount.token, 'POST', {
  payload: {
    ...canonicalPayload,
    transactionsJson: '[]',
    sharedSettlementReceiptsJson: JSON.stringify([
      { id: 'tx-mirror-legit-1', status: 'received', date: '2026-12-03' },
    ]),
  },
}, 201);
const projectRecipient = (deletedSharedIds: string[] = []) => request('/api/family/shared', legitAccount.token, 'PUT', {
  partnerEmail: 'owner@qa.example',
  workspaceRevision: recipientCanonical.revision,
  deletedSharedIds,
});
await projectRecipient();
await projectFamily(newerCanonical.revision);
assert.deepEqual((await request('/api/family/shared', owner.token)).outgoingSettlements.find(
  (row: { shared_sync_id: string }) => row.shared_sync_id === 'legit-1'
), { shared_sync_id: 'legit-1', status: 'received', date: '2026-12-03' });
await projectRecipient(['legit-1']);
await projectFamily(newerCanonical.revision);
assert.equal((await request('/api/family/shared', legitAccount.token)).transactions.length, 0);
assert.ok((await request('/api/family/shared', owner.token)).outgoingSharedIds.includes('legit-1'));

const restoreWithoutShare = await request('/api/workspace', owner.token, 'PUT', {
  payload: { ...currentFamilyPayload, transactionsJson: '[]' },
  expectedRevision: newerCanonical.revision,
});
assert.equal((await request('/api/family/shared', owner.token)).outgoingSharedIds.includes('legit-1'), false,
  'restoring and saving removes the missing mirror immediately');
await projectFamily(restoreWithoutShare.revision);
await projectFamily(newerCanonical.revision, 409);
assert.equal((await request('/api/family/shared', owner.token)).outgoingSharedIds.includes('legit-1'), false);
console.log('PASS: family projection checks revisions, preserves incoming receipts and hides, rejects legacy writes and removes shares absent after restore');

const loan = createReceivable({ id: 'qa-loan', kind: 'loan', personName: 'QA', amount: 100, date: '2026-11-15' });
assert.equal(loan.error, undefined);
const receipt = registerReceivablePayment(loan.receivable, { id: 'qa-loan-payment', date: '2026-11-15', amount: 25, accountId: bank.id });
assert.equal(receipt.error, undefined);
const loanPayload = {
  ...payload,
  receivablesJson: JSON.stringify([receipt.receivable]),
  transactionsJson: JSON.stringify([receipt.transaction]),
  sharedSettlementReceiptsJson: '[]',
};
const orphanPayload = { ...loanPayload, transactionsJson: '[]' };
await request('/api/workspace', outsider.token, 'POST', { payload: orphanPayload }, 400);
await request('/api/workspace', outsider.token, 'POST', { payload: loanPayload }, 201);
const readLoan = await request('/api/workspace', outsider.token);
await request('/api/workspace', outsider.token, 'PUT', { payload: orphanPayload, expectedRevision: readLoan.revision }, 400);
await request('/api/workspace', outsider.token, 'PUT', {
  payload: { ...loanPayload, transactionsJson: JSON.stringify([receipt.transaction, { ...receipt.transaction, id: 'duplicate' }]) },
  expectedRevision: readLoan.revision,
}, 400);

await admin.query(
  'UPDATE public.finance_workspaces SET payload = $1::jsonb WHERE owner_email = $2',
  [JSON.stringify({ ...readLoan.payload, transactionsJson: '[]' }), 'outsider@qa.example']
);
const readLegacyLoan = await request('/api/workspace', outsider.token);
const updatedLegacy = await request('/api/workspace', outsider.token, 'PUT', {
  payload: { ...readLegacyLoan.payload, displayName: 'QA Saved With Old Issue' },
  expectedRevision: readLegacyLoan.revision,
});
await request('/api/workspace', outsider.token, 'PUT', {
  payload: {
    ...orphanPayload,
    receivablesJson: JSON.stringify([{ ...receipt.receivable, payments: [{ ...receipt.receivable.payments[0], amount: 30 }] }]),
  },
  expectedRevision: updatedLegacy.revision,
}, 400);
await request('/api/workspace', outsider.token, 'PUT', { payload: loanPayload, expectedRevision: updatedLegacy.revision });
console.log('PASS: receivables require linked cash movements, reject new damage, and support saving unrelated edits in a legacy workspace');
const orphanAttempts = [
  [`INSERT INTO public.finance_workspaces (vault_id, owner_user_id, owner_email, payload) VALUES ('vault_qa_orphan', 'usr_does_not_exist', 'ghost@qa.example', jsonb_build_object('uid', 'vault_qa_orphan', 'updatedAt', '2026-11-19', 'accountsJson', '[]', 'cardsJson', '[]', 'categoriesJson', '[]', 'transactionsJson', '[]', 'goalsJson', '[]', 'investmentsJson', '[]'))`, 'finance_workspaces_owner_user_fk'],
  [`INSERT INTO public.finance_shared_transactions (sender_user_id, recipient_user_id, shared_sync_id, payload) VALUES ('usr_does_not_exist', '${owner.user.uid}', 'qa-orphan', '{}'::jsonb)`, 'finance_shared_transactions_sender_user_fk'],
] as const;
for (const [sql, constraint] of orphanAttempts) {
  await assert.rejects(admin.query(sql), (error: { constraint?: string; code?: string }) =>
    error.code === '23503' && error.constraint === constraint);
}
const fkCount = (await admin.query(`SELECT count(*)::int AS count FROM pg_constraint WHERE contype = 'f' AND conname LIKE '%_user_fk'`)).rows[0].count;
assert.equal(fkCount, 5, 'migration 011 must create the five app_users foreign keys');
console.log('PASS: workspaces, invitations and shared rows cannot point to an account that does not exist (migration 011)');
await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
await admin.end();
console.log('QA PostgreSQL completed successfully; disposable service only');
process.exit(0);
