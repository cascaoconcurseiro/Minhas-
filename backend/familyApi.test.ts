import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const originalConnect = Pool.prototype.connect;
const originalFetch = globalThis.fetch;
const oldEnv = {
  VERCEL: process.env.VERCEL,
  DATABASE_URL: process.env.DATABASE_URL,
  NEON_AUTH_JWKS_URL: process.env.NEON_AUTH_JWKS_URL,
};

let authTokens: Record<string, string> = {};

let invitation: {
  invitation_id?: string;
  owner_user_id: string;
  owner_email: string;
  invited_email: string;
  invited_user_id: string | null;
  owner_member_id: string;
  owner_name?: string;
  owner_pix_key?: string | null;
  relationship?: string;
  color?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  responded_at?: string | null;
} = {
  invitation_id: 'test-invitation',
  owner_user_id: 'owner-uid',
  owner_email: 'owner@example.com',
  invited_email: 'member@example.com',
  invited_user_id: 'member-uid',
  owner_member_id: 'member-1',
  status: 'accepted',
};
const shared = new Map<string, unknown>();
const sqlLog: string[] = [];
const invitationInsertParameters: unknown[][] = [];
const workspaceQueries: Array<{ sql: string; params: unknown[] }> = [];
let workspaceRevision = 2;
let workspacePayload: Record<string, unknown> = { accountsJson: '[]' };
let workspaceVaultId = 'vault_usr_owner_example_com';
let workspaceOwnerUid = 'owner-uid';
let workspaceExists = true;
let failWorkspaceUpdates = false;
const workspaceUpdateParameters: unknown[][] = [];

function restoreEnv(name: keyof typeof oldEnv) {
  const value = oldEnv[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

before(async () => {
  process.env.VERCEL = '1';
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  process.env.NEON_AUTH_JWKS_URL = 'https://neon-auth.test/jwks';
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === process.env.NEON_AUTH_JWKS_URL) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  const issueToken = (sub: string, email: string, verified = true) =>
    new SignJWT({ email, email_verified: verified })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  authTokens = {
    owner: await issueToken('owner-uid', 'owner@example.com'),
    unverified: await issueToken('owner-uid', 'owner@example.com', false),
    invited: await issueToken('member-uid', 'member@example.com'),
    other: await issueToken('other-uid', 'other@example.com'),
    changedEmail: await issueToken('owner-uid', 'renamed@example.net'),
  };

  Pool.prototype.connect = async function () {
    return {
      query: async (sql: string, params: unknown[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        sqlLog.push(normalized);
        if (normalized.startsWith("SELECT current_user = 'minhas_app_runtime'")) {
          return { rows: [{ is_least_privilege_role: true }], rowCount: 1 };
        }
        if (normalized === 'SELECT 1 FROM public.finance_workspaces LIMIT 0') {
          return { rows: [], rowCount: 0 };
        }
        if (normalized.startsWith('SELECT vault_id, payload, revision, updated_at FROM public.finance_workspaces')) {
          workspaceQueries.push({ sql: normalized, params });
          return params[0] === workspaceOwnerUid && workspaceExists
            ? { rows: [{ vault_id: workspaceVaultId, payload: workspacePayload, revision: workspaceRevision, updated_at: '2026-11-03T00:00:00.000Z' }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        if (normalized.startsWith('SELECT vault_id FROM public.finance_workspaces')) {
          return workspaceExists && workspaceOwnerUid === params[0]
            ? { rows: [{ vault_id: workspaceVaultId }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        if (normalized.startsWith('INSERT INTO public.finance_workspaces')) {
          if (workspaceExists) return { rows: [], rowCount: 0 };
          workspaceExists = true;
          workspaceVaultId = String(params[0]);
          workspaceOwnerUid = String(params[1]);
          workspaceRevision = 1;
          workspacePayload = JSON.parse(String(params[4])) as Record<string, unknown>;
          return { rows: [{ revision: 1, updated_at: '2026-11-03T00:00:00.000Z' }], rowCount: 1 };
        }
        if (normalized.startsWith('UPDATE public.finance_workspaces')) {
          workspaceUpdateParameters.push(params);
          if (failWorkspaceUpdates) throw new Error('simulated database unavailable');
          if (params[4] !== workspaceOwnerUid || params[5] !== workspaceRevision) return { rows: [], rowCount: 0 };
          workspaceVaultId = String(params[0]);
          workspacePayload = JSON.parse(String(params[1])) as Record<string, unknown>;
          workspaceRevision += 1;
          return { rows: [{ revision: workspaceRevision, updated_at: '2026-11-03T00:01:00.000Z' }], rowCount: 1 };
        }
        if (normalized.startsWith('SELECT owner_user_id, owner_email, invited_email')) {
          const rows = invitation.status === 'accepted' ? [{ ...invitation }] : [];
          return { rows, rowCount: rows.length };
        }
        if (normalized.startsWith('SELECT invitation_id, owner_user_id, owner_email, invited_email')) {
          const userUid = String(params[0]);
          const userEmail = String(params[1]).toLowerCase();
          const visible = invitation.owner_user_id === userUid || invitation.invited_email.toLowerCase() === userEmail;
          return { rows: visible ? [{ ...invitation }] : [], rowCount: visible ? 1 : 0 };
        }
        if (normalized.startsWith('INSERT INTO public.finance_family_invitations')) {
          invitationInsertParameters.push(params);
          invitation = {
            invitation_id: String(params[0]),
            owner_user_id: String(params[1]),
            owner_email: String(params[2]),
            invited_email: String(params[3]),
            invited_user_id: null,
            owner_member_id: String(params[4]),
            owner_name: String(params[5]),
            owner_pix_key: params[6] ? String(params[6]) : null,
            relationship: String(params[7]),
            color: String(params[8]),
            status: 'invited',
            created_at: '2026-11-04T00:00:00.000Z',
            updated_at: '2026-11-04T00:00:00.000Z',
            responded_at: null,
          };
          return { rows: [{ ...invitation }], rowCount: 1 };
        }
        if (normalized.startsWith('INSERT INTO public.finance_shared_transactions')) {
          shared.set(String(params[2]), JSON.parse(String(params[3])));
          return { rows: [], rowCount: 1 };
        }
        if (normalized.startsWith('UPDATE public.finance_family_invitations') && normalized.includes('SET status = $1')) {
          const [status, invitedUid, invitationId, invitedEmail] = params.map(String);
          if (
            invitation.invitation_id !== invitationId ||
            invitation.invited_email.toLowerCase() !== invitedEmail.toLowerCase() ||
            !['invited', 'accepted', 'declined'].includes(invitation.status)
          ) return { rows: [], rowCount: 0 };
          invitation = {
            ...invitation,
            status,
            invited_user_id: invitedUid,
            updated_at: '2026-11-04T00:01:00.000Z',
            responded_at: '2026-11-04T00:01:00.000Z',
          };
          return { rows: [{ ...invitation }], rowCount: 1 };
        }
        if (normalized.startsWith('UPDATE public.finance_family_invitations')) {
          invitation = { ...invitation, status: 'revoked' };
          return { rows: [{ owner_user_id: 'owner-uid', invited_user_id: 'member-uid' }], rowCount: 1 };
        }
        if (normalized.startsWith('DELETE FROM public.finance_shared_transactions')) {
          shared.clear();
          return { rows: [], rowCount: 1 };
        }
        if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK' || normalized.startsWith('SELECT set_config(')) {
          return { rows: [], rowCount: 0 };
        }
        throw new Error(`SQL inesperado no teste: ${normalized}`);
      },
      release: () => undefined,
    } as never;
  };

  const { default: app } = await import('./app.ts');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

let baseUrl = '';
let closeServer: () => Promise<void> = async () => undefined;

after(async () => {
  await closeServer();
  Pool.prototype.connect = originalConnect;
  globalThis.fetch = originalFetch;
  restoreEnv('VERCEL');
  restoreEnv('DATABASE_URL');
  restoreEnv('NEON_AUTH_JWKS_URL');
});

test('API familiar exige Neon Auth e sincroniza pelo Neon antes de revogar', async () => {
  const unauthenticated = await originalFetch(`${baseUrl}/api/family/shared`);
  assert.equal(unauthenticated.status, 401);

  const unauthenticatedInvite = await originalFetch(`${baseUrl}/api/family/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitedEmail: 'member@example.com', ownerMemberId: 'member-1' }),
  });
  assert.equal(unauthenticatedInvite.status, 401);

  const sqlBeforeUnverified = sqlLog.length;
  const unverified = await originalFetch(`${baseUrl}/api/family/shared`, {
    headers: { Authorization: `Bearer ${authTokens.unverified}` },
  });
  assert.equal(unverified.status, 403);
  assert.equal(sqlLog.length, sqlBeforeUnverified, 'conta sem email verificado não deve consultar tabelas familiares');

  const headers = { Authorization: `Bearer ${authTokens.owner}`, 'Content-Type': 'application/json' };
  const unverifiedInvite = await originalFetch(`${baseUrl}/api/family/invitations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authTokens.unverified}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitedEmail: 'member@example.com', ownerMemberId: 'member-1' }),
  });
  assert.equal(unverifiedInvite.status, 403);
  assert.equal(sqlLog.length, sqlBeforeUnverified, 'convite sem email verificado não deve consultar Neon');

  const sqlBeforeInvalidInvite = sqlLog.length;
  const selfInvite = await originalFetch(`${baseUrl}/api/family/invitations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ invitedEmail: ' OWNER@example.com ', ownerMemberId: 'member-1' }),
  });
  assert.equal(selfInvite.status, 400);
  assert.equal(sqlLog.length, sqlBeforeInvalidInvite, 'convite para o próprio email deve ser recusado antes do SQL');

  const createInvite = await originalFetch(`${baseUrl}/api/family/invitations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      invitedEmail: ' Member@Example.com ',
      ownerMemberId: 'member-1',
      ownerName: 'Owner Test',
      relationship: 'parceiro',
    }),
  });
  assert.equal(createInvite.status, 201, await createInvite.clone().text());
  const createdBody = await createInvite.json() as { invitation: typeof invitation };
  assert.match(String(createdBody.invitation.invitation_id), /^[a-f0-9]{64}$/);
  assert.equal(createdBody.invitation.invited_email, 'member@example.com');
  assert.equal(createdBody.invitation.owner_user_id, 'owner-uid');
  assert.equal(createdBody.invitation.status, 'invited');
  assert.equal(invitationInsertParameters.at(-1)?.[3], 'member@example.com');

  const wrongInvitee = await originalFetch(`${baseUrl}/api/family/invitations/${createdBody.invitation.invitation_id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authTokens.other}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accepted' }),
  });
  assert.equal(wrongInvitee.status, 404);
  assert.equal(invitation.status, 'invited', 'outra identidade não pode aceitar o convite');

  const sqlBeforeInvalidResponse = sqlLog.length;
  const invalidResponse = await originalFetch(`${baseUrl}/api/family/invitations/${createdBody.invitation.invitation_id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authTokens.invited}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'admin' }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(sqlLog.length, sqlBeforeInvalidResponse, 'ação de convite inválida deve ser recusada antes do SQL');

  const accepted = await originalFetch(`${baseUrl}/api/family/invitations/${createdBody.invitation.invitation_id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authTokens.invited}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accepted' }),
  });
  assert.equal(accepted.status, 200);
  assert.equal(invitation.status, 'accepted');
  assert.equal(invitation.invited_user_id, 'member-uid');

  const invitedList = await originalFetch(`${baseUrl}/api/family/invitations`, {
    headers: { Authorization: `Bearer ${authTokens.invited}` },
  });
  assert.equal(invitedList.status, 200);
  assert.equal((await invitedList.json() as { invitations: unknown[] }).invitations.length, 1);

  const sync = await originalFetch(`${baseUrl}/api/family/shared`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      partnerEmail: 'member@example.com',
      deletedSharedIds: [],
      transactions: [{ id: 'tx-local-1', isShared: true, description: 'Fixture', amount: 12, sharedAmount: 6, date: '2026-11-03' }],
    }),
  });
  assert.equal(sync.status, 200, await sync.clone().text());
  assert.deepEqual(await sync.json(), { ok: true, forbidden: false, upserted: 1, settled: 0, deleted: 0 });
  assert.equal(shared.size, 1);
  assert.match(sqlLog.find((sql) => sql.startsWith('SELECT owner_user_id, owner_email, invited_email')) || '', /FOR UPDATE$/);

  const revoked = await originalFetch(`${baseUrl}/api/family/invitations/test-invitation/revoke`, { method: 'POST', headers });
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), { ok: true });
  assert.equal(shared.size, 0);
  assert.equal(invitation.status, 'revoked');
});

test('API de workspace mantém leituras isoladas pelo UID autenticado', async () => {
  const ownerResponse = await originalFetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: `Bearer ${authTokens.owner}` },
  });
  assert.equal(ownerResponse.status, 200);
  const ownerWorkspace = await ownerResponse.json() as { revision: number; payload: { accountsJson: string } };
  assert.equal(ownerWorkspace.revision, 2);
  assert.equal(ownerWorkspace.payload.accountsJson, '[]');

  const renamedEmailResponse = await originalFetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: `Bearer ${authTokens.changedEmail}` },
  });
  assert.equal(renamedEmailResponse.status, 200, 'a mesma identidade UID deve localizar o workspace após troca de e-mail');
  const renamedWorkspace = await renamedEmailResponse.json() as { payload: { uid: string } };
  assert.equal(renamedWorkspace.payload.uid, 'vault_uid_owner-uid');

  const otherResponse = await originalFetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: `Bearer ${authTokens.other}` },
  });
  assert.equal(otherResponse.status, 404);

  const otherQuery = workspaceQueries.at(-1);
  assert.ok(otherQuery);
  assert.match(otherQuery.sql, /WHERE owner_user_id = \$1/);
  assert.equal(otherQuery.params[0], 'other-uid');
});

test('API de workspace serializa duas gravações simultâneas pela mesma revisão', async () => {
  const headers = { Authorization: `Bearer ${authTokens.owner}`, 'Content-Type': 'application/json' };
  const firstPayload = {
    uid: 'old-email-derived-id-from-client',
    updatedAt: '2026-11-03T00:01:00.000Z',
    accountsJson: '[{"id":"writer-a"}]', cardsJson: '[]', categoriesJson: '[]',
    transactionsJson: '[]', goalsJson: '[]', investmentsJson: '[]',
  };
  const secondPayload = { ...firstPayload, accountsJson: '[{"id":"writer-b"}]' };
  const responses = await Promise.all([firstPayload, secondPayload].map((payload) =>
    originalFetch(`${baseUrl}/api/workspace`, {
      method: 'PUT', headers, body: JSON.stringify({ payload, expectedRevision: 2 }),
    })
  ));
  const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);
  const success = responses.find((response) => response.status === 200);
  const conflict = responses.find((response) => response.status === 409);
  assert.ok(success);
  assert.ok(conflict);
  assert.deepEqual(await success.json(), {
    revision: 3, updatedAt: '2026-11-03T00:01:00.000Z',
  });
  assert.match((await conflict.json() as { error: string }).error, /revisão desatualizada/);
  assert.ok(['[{"id":"writer-a"}]', '[{"id":"writer-b"}]'].includes(String(workspacePayload.accountsJson)));

  assert.equal(workspaceRevision, 3, 'gravação obsoleta não deve sobrescrever a versão mais nova');
  assert.equal(workspaceVaultId, 'vault_uid_owner-uid', 'a chave de banco deve ser normalizada para o UID autenticado');
  assert.equal(workspacePayload.uid, 'vault_uid_owner-uid', 'UID enviado pelo cliente não pode definir o titular');
  assert.equal(workspaceUpdateParameters.length, 2);
  assert.match(String(workspaceUpdateParameters[0]?.[1]), /accountsJson/);
});

test('API persiste e relê o payload completo de uma restauração de backup', async () => {
  const headers = { Authorization: `Bearer ${authTokens.owner}`, 'Content-Type': 'application/json' };
  const restoredPayload = {
    uid: 'legacy-backup-vault-id',
    updatedAt: '2026-11-04T00:00:00.000Z',
    accountsJson: JSON.stringify([{ id: 'qa-account' }]),
    cardsJson: JSON.stringify([{ id: 'qa-card' }]),
    categoriesJson: JSON.stringify([{ id: 'qa-category' }]),
    transactionsJson: JSON.stringify([{ id: 'qa-transaction' }]),
    goalsJson: JSON.stringify([{ id: 'qa-goal' }]),
    familyMembersJson: JSON.stringify([{ id: 'qa-member' }]),
    investmentsJson: JSON.stringify([{ id: 'qa-investment' }]),
    investmentTargetsJson: JSON.stringify({ reserve: 123 }),
    tripsJson: JSON.stringify([{ id: 'qa-trip' }]),
    settingsJson: JSON.stringify({ userName: 'QA restore' }),
  };

  const write = await originalFetch(`${baseUrl}/api/workspace`, {
    method: 'PUT', headers, body: JSON.stringify({ payload: restoredPayload, expectedRevision: 3 }),
  });
  assert.equal(write.status, 200, await write.clone().text());
  assert.equal((await write.json() as { revision: number }).revision, 4);

  const read = await originalFetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: `Bearer ${authTokens.owner}` },
  });
  assert.equal(read.status, 200);
  const response = await read.json() as { revision: number; payload: Record<string, unknown> };
  assert.equal(response.revision, 4);
  assert.deepEqual(response.payload, { ...restoredPayload, uid: 'vault_uid_owner-uid' });
});

test('API de workspace responde 503 quando o banco fica indisponível', async () => {
  const originalConsoleError = console.error;
  const revisionBeforeFailure = workspaceRevision;
  failWorkspaceUpdates = true;
  console.error = () => undefined;
  try {
    const response = await originalFetch(`${baseUrl}/api/workspace`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authTokens.owner}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          uid: 'legacy-email-derived-id',
          updatedAt: '2026-11-03T00:02:00.000Z',
          accountsJson: '[]', cardsJson: '[]', categoriesJson: '[]',
          transactionsJson: '[]', goalsJson: '[]', investmentsJson: '[]',
        },
        expectedRevision: revisionBeforeFailure,
      }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json() as { error: string }).error, /Não foi possível salvar/);
  } finally {
    failWorkspaceUpdates = false;
    console.error = originalConsoleError;
  }
  assert.equal(workspaceRevision, revisionBeforeFailure, 'falha de banco não pode avançar a revisão');
});

test('API cria o workspace inicial uma única vez sem sobrescrever o existente', async () => {
  workspaceExists = false;
  workspaceRevision = 0;
  workspacePayload = {};
  const headers = { Authorization: `Bearer ${authTokens.owner}`, 'Content-Type': 'application/json' };
  const payload = {
    uid: 'untrusted-legacy-id',
    updatedAt: '2026-11-04T00:00:00.000Z',
    accountsJson: '[]', cardsJson: '[]', categoriesJson: '[]',
    transactionsJson: '[]', goalsJson: '[]', investmentsJson: '[]',
  };

  const first = await originalFetch(`${baseUrl}/api/workspace`, {
    method: 'POST', headers, body: JSON.stringify({ payload }),
  });
  assert.equal(first.status, 201, await first.clone().text());
  assert.equal((await first.json() as { revision: number }).revision, 1);

  const duplicate = await originalFetch(`${baseUrl}/api/workspace`, {
    method: 'POST', headers, body: JSON.stringify({ payload: { ...payload, accountsJson: '[{"id":"overwrite"}]' } }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(workspaceVaultId, 'vault_uid_owner-uid');
  assert.deepEqual(workspacePayload, { ...payload, uid: 'vault_uid_owner-uid' });
});

test('rota de migração legada está desativada; a autenticação permanece obrigatória', async () => {
  const queriesBefore = sqlLog.length;
  const unauthenticated = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(unauthenticated.status, 401);

  const headers = { Authorization: `Bearer ${authTokens.owner}`, 'Content-Type': 'application/json' };
  const retiredRoute = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  assert.equal(retiredRoute.status, 404);
  assert.equal(sqlLog.length, queriesBefore, 'requisições inválidas não devem consultar Neon');
});

test('health reporta apenas se a conexão usa a role de runtime restrita', async () => {
  const response = await originalFetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json() as {
    services: { neon: string; neonLeastPrivilegeRole: boolean | null };
  };
  assert.equal(health.services.neon, 'ok');
  assert.equal(health.services.neonLeastPrivilegeRole, true);
});
