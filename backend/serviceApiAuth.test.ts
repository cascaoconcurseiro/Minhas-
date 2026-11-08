import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const originalFetch = globalThis.fetch;
const oldEnv = {
  VERCEL: process.env.VERCEL,
  DATABASE_URL: process.env.DATABASE_URL,
};

let externalFetchCount = 0;
let baseUrl = '';
let closeServer: () => Promise<void> = async () => undefined;

before(async () => {
  process.env.VERCEL = '1';
  process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    externalFetchCount += 1;
    return originalFetch(input, init);
  }) as typeof fetch;

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
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('FX, cotações e lembretes exigem login antes de validar ou chamar serviços externos', async () => {
  const cases = [
    {
      path: '/api/fx/live-rate',
      body: { currency: 'BRL' },
    },
    {
      path: '/api/investments/sync-quotes',
      body: { tickers: [] },
    },
    {
      path: '/api/reminders/send-email',
      body: { to: 'invalid-email' },
    },
  ];

  for (const route of cases) {
    const unauthenticated = await originalFetch(`${baseUrl}${route.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route.body),
    });
    assert.equal(unauthenticated.status, 401, `${route.path} deve rejeitar ausência de bearer token`);
  }

  assert.equal(externalFetchCount, 0, 'nenhuma API de cotação, DNS ou SMTP deve ser chamada nestes caminhos');
});
