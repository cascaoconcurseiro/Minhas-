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
  globalThis.fetch = (async (input: string | URL | Request) => {
    if (String(input).includes('identitytoolkit.googleapis.com')) {
      return new Response(JSON.stringify({ users: [{
        localId: 'owner-uid', email: 'owner@example.com', emailVerified: true,
      }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(input);
  }) as typeof fetch;

  Pool.prototype.connect = async function () {
    return {
      query: async (sql: string, params: unknown[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        sqlLog.push(normalized);
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
