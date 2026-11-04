import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

const originalConnect = Pool.prototype.connect;
const originalFetch = globalThis.fetch;
const oldEnv = {
  VERCEL: process.env.VERCEL,
  DATABASE_URL: process.env.DATABASE_URL,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
};

let invitation = {
  owner_firebase_uid: 'owner-uid',
  owner_email: 'owner@example.com',
  invited_email: 'member@example.com',
  invited_firebase_uid: 'member-uid',
  owner_member_id: 'member-1',
  status: 'accepted',
};
const shared = new Map<string, unknown>();
const sqlLog: string[] = [];
const workspaceQueries: Array<{ sql: string; params: unknown[] }> = [];
let workspaceRevision = 2;
let workspacePayload: Record<string, unknown> = { accountsJson: '[]' };
let workspaceExists = true;
let workspaceMigrationCount = 0;
let workspaceMigrationRecord: unknown[] = [];
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
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_API_KEY = 'test-api-key';
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes('identitytoolkit.googleapis.com')) {
      const authRequest = JSON.parse(String(init?.body || '{}')) as { idToken?: string };
      const otherUser = authRequest.idToken === 'other-user-test-token';
      return new Response(JSON.stringify({ users: [{
        localId: otherUser ? 'other-uid' : 'owner-uid',
        email: otherUser ? 'other@example.com' : 'owner@example.com',
        emailVerified: authRequest.idToken !== 'unverified-test-token',
      }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(input);
  }) as typeof fetch;

  Pool.prototype.connect = async function () {
    return {
      query: async (sql: string, params: unknown[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        sqlLog.push(normalized);
        if (normalized.startsWith('SELECT payload, revision, updated_at')) {
          workspaceQueries.push({ sql: normalized, params });
          return params[1] === 'owner-uid' && workspaceExists
            ? { rows: [{ payload: workspacePayload, revision: workspaceRevision, updated_at: '2026-11-03T00:00:00.000Z' }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        if (normalized.startsWith('INSERT INTO public.finance_workspaces')) {
          if (workspaceExists) return { rows: [], rowCount: 0 };
          workspaceExists = true;
          workspaceRevision = 1;
          workspacePayload = JSON.parse(String(params[4])) as Record<string, unknown>;
          return { rows: [{ revision: 1, updated_at: '2026-11-03T00:00:00.000Z' }], rowCount: 1 };
        }
        if (normalized.startsWith('INSERT INTO public.finance_workspace_migrations')) {
          workspaceMigrationCount += 1;
          workspaceMigrationRecord = params;
          return { rows: [], rowCount: 1 };
        }
        if (normalized.startsWith('UPDATE public.finance_workspaces')) {
          workspaceUpdateParameters.push(params);
          if (failWorkspaceUpdates) throw new Error('simulated database unavailable');
          if (params[5] !== workspaceRevision) return { rows: [], rowCount: 0 };
          workspacePayload = JSON.parse(String(params[0])) as Record<string, unknown>;
          workspaceRevision += 1;
          return { rows: [{ revision: workspaceRevision, updated_at: '2026-11-03T00:01:00.000Z' }], rowCount: 1 };
        }
        if (normalized.startsWith('SELECT owner_firebase_uid, owner_email, invited_email')) {
          return { rows: invitation.status === 'accepted' ? [{ ...invitation }] : [], rowCount: 1 };
        }
        if (normalized.startsWith('INSERT INTO public.finance_shared_transactions')) {
          shared.set(String(params[2]), JSON.parse(String(params[3])));
          return { rows: [], rowCount: 1 };
        }
        if (normalized.startsWith('UPDATE public.finance_family_invitations')) {
          invitation = { ...invitation, status: 'revoked' };
          return { rows: [{ owner_firebase_uid: 'owner-uid', invited_firebase_uid: 'member-uid' }], rowCount: 1 };
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
  restoreEnv('FIREBASE_PROJECT_ID');
  restoreEnv('FIREBASE_API_KEY');
});

test('API familiar exige Firebase e sincroniza pelo Neon antes de revogar', async () => {
  const unauthenticated = await originalFetch(`${baseUrl}/api/family/shared`);
  assert.equal(unauthenticated.status, 401);

  const sqlBeforeUnverified = sqlLog.length;
  const unverified = await originalFetch(`${baseUrl}/api/family/shared`, {
    headers: { Authorization: 'Bearer unverified-test-token' },
  });
  assert.equal(unverified.status, 403);
  assert.equal(sqlLog.length, sqlBeforeUnverified, 'conta sem email verificado não deve consultar tabelas familiares');

  const headers = { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' };
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
  assert.match(sqlLog.find((sql) => sql.startsWith('SELECT owner_firebase_uid, owner_email, invited_email')) || '', /FOR UPDATE$/);

  const revoked = await originalFetch(`${baseUrl}/api/family/invitations/test-invitation/revoke`, { method: 'POST', headers });
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), { ok: true });
  assert.equal(shared.size, 0);
  assert.equal(invitation.status, 'revoked');
});

test('API de workspace mantém leituras isoladas pelo UID autenticado', async () => {
  const ownerResponse = await originalFetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: 'Bearer local-test-token' },
  });
  assert.equal(ownerResponse.status, 200);
  const ownerWorkspace = await ownerResponse.json() as { revision: number; payload: { accountsJson: string } };
  assert.equal(ownerWorkspace.revision, 2);
  assert.equal(ownerWorkspace.payload.accountsJson, '[]');

  const otherResponse = await originalFetch(`${baseUrl}/api/workspace`, {
    headers: { Authorization: 'Bearer other-user-test-token' },
  });
  assert.equal(otherResponse.status, 404);

  const otherQuery = workspaceQueries.at(-1);
  assert.ok(otherQuery);
  assert.match(otherQuery.sql, /WHERE vault_id = \$1 AND owner_firebase_uid = \$2/);
  assert.equal(otherQuery.params[1], 'other-uid');
});

test('API de workspace serializa duas gravações simultâneas pela mesma revisão', async () => {
  const headers = { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' };
  const firstPayload = {
    uid: 'vault_usr_owner_example_com',
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
  assert.equal(workspaceUpdateParameters.length, 2);
  assert.match(String(workspaceUpdateParameters[0]?.[0]), /accountsJson/);
});

test('API persiste e relê o payload completo de uma restauração de backup', async () => {
  const headers = { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' };
  const restoredPayload = {
    uid: 'vault_usr_owner_example_com',
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
    headers: { Authorization: 'Bearer local-test-token' },
  });
  assert.equal(read.status, 200);
  const response = await read.json() as { revision: number; payload: Record<string, unknown> };
  assert.equal(response.revision, 4);
  assert.deepEqual(response.payload, restoredPayload);
});

test('API de workspace responde 503 quando o banco fica indisponível', async () => {
  const originalConsoleError = console.error;
  const revisionBeforeFailure = workspaceRevision;
  failWorkspaceUpdates = true;
  console.error = () => undefined;
  try {
    const response = await originalFetch(`${baseUrl}/api/workspace`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          uid: 'vault_usr_owner_example_com',
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
  const headers = { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' };
  const payload = {
    uid: 'vault_usr_owner_example_com',
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
  assert.deepEqual(workspacePayload, payload);
});

test('migração Firestore→Neon ocorre uma vez e nunca substitui workspace existente', async () => {
  workspaceExists = false;
  workspaceRevision = 0;
  workspacePayload = {};
  workspaceMigrationCount = 0;
  workspaceMigrationRecord = [];
  const headers = { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' };
  const payload = {
    uid: 'vault_usr_owner_example_com',
    updatedAt: '2026-11-04T00:00:00.000Z',
    accountsJson: JSON.stringify([{ id: 'legacy-account' }]),
    cardsJson: '[]', categoriesJson: '[]', transactionsJson: '[]',
    goalsJson: '[]', investmentsJson: '[]',
  };

  const first = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers,
    body: JSON.stringify({ payload, sourceUpdatedAt: payload.updatedAt }),
  });
  assert.equal(first.status, 201, await first.clone().text());
  assert.deepEqual(await first.json(), { ok: true, vaultId: payload.uid });
  assert.equal(workspaceMigrationCount, 1);
  assert.equal(workspaceMigrationRecord[2], payload.updatedAt);
  assert.match(String(workspaceMigrationRecord[3]), /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(String(workspaceMigrationRecord[4])), {
    accounts: 1, cards: 0, categories: 0, transactions: 0, goals: 0,
    familyMembers: 0, investments: 0, trips: 0,
  });

  const duplicate = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers,
    body: JSON.stringify({ payload: { ...payload, accountsJson: '[]' }, sourceUpdatedAt: payload.updatedAt }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(workspaceMigrationCount, 1, 'importação duplicada não deve criar log ou substituir dados');
  assert.deepEqual(workspacePayload, payload);
});

test('API rejeita migração sem autenticação, payload inválido e data malformada antes de consultar Neon', async () => {
  const queriesBefore = sqlLog.length;
  const unauthenticated = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  assert.equal(unauthenticated.status, 401);

  const headers = { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' };
  const invalidPayload = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers, body: JSON.stringify({ payload: [] }),
  });
  assert.equal(invalidPayload.status, 400);

  const invalidDate = await originalFetch(`${baseUrl}/api/workspace/migrate`, {
    method: 'POST', headers,
    body: JSON.stringify({
      payload: {
        uid: 'vault_usr_owner_example_com',
        updatedAt: '2026-11-04T00:00:00.000Z',
        accountsJson: '[]', cardsJson: '[]', categoriesJson: '[]',
        transactionsJson: '[]', goalsJson: '[]', investmentsJson: '[]',
      },
      sourceUpdatedAt: 'not-a-date',
    }),
  });
  assert.equal(invalidDate.status, 400);
  assert.equal(sqlLog.length, queriesBefore, 'requisições inválidas não devem consultar Neon');
});
