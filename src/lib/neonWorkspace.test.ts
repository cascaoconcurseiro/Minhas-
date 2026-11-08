import assert from 'node:assert/strict';
import test from 'node:test';
import {auth} from './authClient';
import {
  createNeonWorkspace,
  loadNeonWorkspace,
  NeonWorkspaceError,
  parseNeonWorkspaceSnapshot,
  saveNeonWorkspace,
} from './neonWorkspace';

const validSnapshot = {
  payload: {
    uid: 'vault_uid_test-12345',
    updatedAt: '2026-11-07T15:00:00.000Z',
    accountsJson: '[]',
    cardsJson: '[]',
    categoriesJson: '[]',
    transactionsJson: '[]',
    goalsJson: '[]',
    investmentsJson: '[]',
  },
  revision: 1,
  updatedAt: '2026-11-07T15:00:00.000Z',
};

test('accepts an empty workspace only when Neon returns its core collections and revision', () => {
  assert.deepEqual(parseNeonWorkspaceSnapshot(validSnapshot), validSnapshot);
});

test('rejects a 200-style response with an absent or empty payload before it can unlock hydration', () => {
  for (const incomplete of [
    {revision: 1, updatedAt: validSnapshot.updatedAt},
    {payload: {}, revision: 1, updatedAt: validSnapshot.updatedAt},
    {
      payload: {...validSnapshot.payload, goalsJson: undefined},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
    {
      payload: {...validSnapshot.payload, investmentsJson: null},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
    {
      payload: {...validSnapshot.payload, uid: ''},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
    {
      payload: {...validSnapshot.payload, updatedAt: undefined},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
  ]) {
    assert.throws(
      () => parseNeonWorkspaceSnapshot(incomplete),
      (error: unknown) => error instanceof NeonWorkspaceError && error.status === 502
    );
  }
});

test('rejects missing revision metadata instead of treating an unversioned response as saved', () => {
  assert.throws(
    () => parseNeonWorkspaceSnapshot({...validSnapshot, revision: 0}),
    (error: unknown) => error instanceof NeonWorkspaceError && error.status === 502
  );
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

test('workspace HTTP operations authenticate, retry an expired token once, and preserve revision conflicts', async () => {
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalUser = Object.getOwnPropertyDescriptor(auth, 'currentUser');
  const calls: Array<{input: RequestInfo | URL; init?: RequestInit}> = [];
  const setUser = (user: unknown) => {
    Object.defineProperty(auth, 'currentUser', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: user,
    });
  };
  const setFetch = (implementation: typeof fetch) => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: implementation,
    });
  };
  const mockUser = (getIdToken: (forceRefresh?: boolean) => Promise<string>, isAnonymous = false) => ({
    isAnonymous,
    getIdToken,
  });

  try {
    const forbiddenFetch = (async () => {
      calls.push({input: 'unexpected'});
      return jsonResponse(500, {});
    }) as typeof fetch;
    setFetch(forbiddenFetch);
    setUser(null);
    await assert.rejects(
      loadNeonWorkspace(),
      (error: unknown) => error instanceof NeonWorkspaceError && error.status === 401
    );
    setUser(mockUser(async () => 'anonymous-token', true));
    await assert.rejects(
      createNeonWorkspace(validSnapshot.payload),
      (error: unknown) => error instanceof NeonWorkspaceError && error.status === 401
    );
    assert.equal(calls.length, 0, 'missing and anonymous users must not call the API');

    const refreshes: boolean[] = [];
    setUser(mockUser(async (forceRefresh = false) => {
      refreshes.push(forceRefresh);
      return forceRefresh ? 'fresh-id-token' : 'expired-id-token';
    }));
    setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({input, init});
      return calls.length === 1
        ? jsonResponse(401, {error: 'expired'})
        : jsonResponse(200, validSnapshot);
    }) as typeof fetch);

    const loaded = await loadNeonWorkspace();
    assert.deepEqual(loaded, validSnapshot);
    assert.deepEqual(refreshes, [false, true]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input, '/api/workspace');
    assert.equal(calls[0].init?.method, undefined);
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer expired-id-token');
    assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, 'Bearer fresh-id-token');

    calls.length = 0;
    setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({input, init});
      return jsonResponse(201, {revision: 1, updatedAt: validSnapshot.updatedAt});
    }) as typeof fetch);
    const created = await createNeonWorkspace(validSnapshot.payload);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, '/api/workspace');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {payload: validSnapshot.payload});
    assert.deepEqual(created, {revision: 1, updatedAt: validSnapshot.updatedAt});

    calls.length = 0;
    setFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({input, init});
      return jsonResponse(409, {error: 'Revision conflict'});
    }) as typeof fetch);
    await assert.rejects(
      saveNeonWorkspace(validSnapshot.payload, 7),
      (error: unknown) =>
        error instanceof NeonWorkspaceError &&
        error.status === 409 &&
        error.message === 'Revision conflict'
    );
    assert.equal(calls.length, 1, 'a revision conflict must not be retried as a generic error');
    assert.equal(calls[0].init?.method, 'PUT');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      payload: validSnapshot.payload,
      expectedRevision: 7,
    });
  } finally {
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
    else Reflect.deleteProperty(globalThis, 'fetch');
    if (originalUser) Object.defineProperty(auth, 'currentUser', originalUser);
    else Reflect.deleteProperty(auth, 'currentUser');
  }
});
