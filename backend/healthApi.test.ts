import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';

const originalConnect = Pool.prototype.connect;
const oldEnv = {
  VERCEL: process.env.VERCEL,
  DATABASE_URL: process.env.DATABASE_URL,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
};

let leastPrivilege = false;
let roleQuery = '';
let failNeonConnection = false;
let connectCalls = 0;
let baseUrl = '';
let closeServer: () => Promise<void> = async () => undefined;

before(async () => {
  process.env.VERCEL = '1';
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
  process.env.FIREBASE_PROJECT_ID = 'firebase-test-project';
  process.env.FIREBASE_API_KEY = 'firebase-test-api-key';
  process.env.CRON_SECRET = 'local-test-cron-secret';
  Pool.prototype.connect = async function () {
    connectCalls += 1;
    if (failNeonConnection) throw new Error('synthetic Neon connection failure');
    return {
      query: async (sql: string) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        if (normalized.includes('is_least_privilege_role')) {
          roleQuery = normalized;
          return { rows: [{ is_least_privilege_role: leastPrivilege }], rowCount: 1 };
        }
        if (normalized === 'SELECT 1 FROM public.finance_workspaces LIMIT 0') {
          return { rows: [], rowCount: 0 };
        }
        throw new Error(`SQL inesperado no teste de health: ${normalized}`);
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
  closeServer = () => new Promise<void>((resolve, reject) =>
    server.close((err) => err ? reject(err) : resolve()));
});

after(async () => {
  await closeServer();
  Pool.prototype.connect = originalConnect;
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const cronHeaders = { Authorization: 'Bearer local-test-cron-secret' };

test('public status reports configuration without connecting to Neon', async () => {
  const before = connectCalls;
  failNeonConnection = true;
  const response = await fetch(`${baseUrl}/api/status`);
  const body = await response.json() as {
    status: string;
    services: { neon: string; neonConfigured: boolean; firebaseAuthConfigured: boolean };
  };
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.services.neonConfigured, true);
  assert.equal(body.services.neon, 'not_checked');
  assert.equal(body.services.firebaseAuthConfigured, true);
  assert.equal(connectCalls, before, 'status público não deve abrir conexão com Neon');
  failNeonConnection = false;
});

test('readiness rejects absent or invalid cron secret before connecting to Neon', async () => {
  const before = connectCalls;
  const absent = await fetch(`${baseUrl}/api/readiness`);
  const invalid = await fetch(`${baseUrl}/api/readiness`, {
    headers: { Authorization: 'Bearer incorrect-secret' },
  });
  assert.equal(absent.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(connectCalls, before, 'requisições não autorizadas não devem consultar Neon');
});

test('readiness fails closed when CRON_SECRET is not configured', async () => {
  const configuredSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const before = connectCalls;
    const response = await fetch(`${baseUrl}/api/readiness`, { headers: cronHeaders });
    assert.equal(response.status, 401);
    assert.equal(connectCalls, before);
  } finally {
    if (configuredSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = configuredSecret;
  }
});

test('health marks an admin-capable runtime role degraded even while Neon responds', async () => {
  leastPrivilege = false;
  const response = await fetch(`${baseUrl}/api/readiness`, { headers: cronHeaders });
  const body = await response.json() as {
    status: string;
    services: { neon: string; neonLeastPrivilegeRole: boolean | null };
  };

  assert.equal(response.status, 503, 'a API não deve anunciar prontidão com uma role privilegiada');
  assert.equal(body.status, 'degraded');
  assert.equal(body.services.neon, 'ok');
  assert.equal(body.services.neonLeastPrivilegeRole, false);
  assert.equal((body.services as { firebaseAuthConfigured?: boolean }).firebaseAuthConfigured, true);
  assert.match(roleQuery, /rolsuper/);
  assert.match(roleQuery, /rolcreaterole/);
  assert.match(roleQuery, /rolcreatedb/);
  assert.match(roleQuery, /rolreplication/);
  assert.match(roleQuery, /rolbypassrls/);
  assert.match(roleQuery, /pg_has_role\(/);
  assert.match(roleQuery, /neon_superuser/);
});

test('health reports least privilege only after the database confirms the restricted role', async () => {
  leastPrivilege = true;
  const response = await fetch(`${baseUrl}/api/readiness`, { headers: cronHeaders });
  const body = await response.json() as {
    services: { neonLeastPrivilegeRole: boolean | null; firebaseAuthConfigured: boolean };
  };

  assert.equal(response.status, 200);
  assert.equal(body.services.neonLeastPrivilegeRole, true);
  assert.equal(body.services.firebaseAuthConfigured, true);
});

test('health returns degraded 503 when Neon connection fails', async () => {
  failNeonConnection = true;
  try {
    const response = await fetch(`${baseUrl}/api/readiness`, { headers: cronHeaders });
    const body = await response.json() as {
      status: string;
      services: { neon: string; neonConfigured: boolean; neonLeastPrivilegeRole: boolean | null; firebaseAuthConfigured: boolean };
    };

    assert.equal(response.status, 503);
    assert.equal(body.status, 'degraded');
    assert.equal(body.services.neon, 'error');
    assert.equal(body.services.neonConfigured, true);
    assert.equal(body.services.neonLeastPrivilegeRole, null);
    assert.equal(body.services.firebaseAuthConfigured, true);
    assert.doesNotMatch(JSON.stringify(body), /synthetic Neon connection failure/);
  } finally {
    failNeonConnection = false;
  }
});

test('health returns degraded 503 when Firebase Auth server configuration is missing', async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_API_KEY;
  try {
    const response = await fetch(`${baseUrl}/api/readiness`, { headers: cronHeaders });
    const body = await response.json() as {
      status: string;
      services: { neon: string; firebaseAuthConfigured: boolean };
    };
    assert.equal(response.status, 503);
    assert.equal(body.status, 'degraded');
    assert.equal(body.services.neon, 'ok');
    assert.equal(body.services.firebaseAuthConfigured, false);
  } finally {
    if (projectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = projectId;
    if (apiKey === undefined) delete process.env.FIREBASE_API_KEY;
    else process.env.FIREBASE_API_KEY = apiKey;
  }
});

test('readiness requires both Firebase project ID and API key for account-state verification', async () => {
  const apiKey = process.env.FIREBASE_API_KEY;
  process.env.FIREBASE_PROJECT_ID = 'firebase-test-project';
  delete process.env.FIREBASE_API_KEY;
  try {
    const response = await fetch(`${baseUrl}/api/readiness`, { headers: cronHeaders });
    const body = await response.json() as {
      status: string;
      services: { firebaseAuthConfigured: boolean };
    };
    assert.equal(response.status, 503);
    assert.equal(body.status, 'degraded');
    assert.equal(body.services.firebaseAuthConfigured, false);
  } finally {
    if (apiKey === undefined) delete process.env.FIREBASE_API_KEY;
    else process.env.FIREBASE_API_KEY = apiKey;
  }
});
