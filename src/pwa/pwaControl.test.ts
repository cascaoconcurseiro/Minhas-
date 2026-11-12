import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
  checkAndApplyUpdate,
  getAppBuild,
  markUpdatePending,
  registerPwaControl,
  resetPwaControlForTests,
} from './pwaControl';

afterEach(() => resetPwaControlForTests());

const fakeRegistration = (opts: { waiting?: boolean; updateFails?: boolean; onUpdate?: () => void } = {}) =>
  ({
    waiting: opts.waiting ? {} : null,
    installing: null,
    update: async () => {
      if (opts.updateFails) throw new Error('rede');
      opts.onUpdate?.();
    },
  }) as unknown as ServiceWorkerRegistration;

test('sem registro do service worker devolve "unsupported"', async () => {
  assert.equal(await checkAndApplyUpdate(50), 'unsupported');
});

test('sem versão nova devolve "latest" e não recarrega', async () => {
  let applied = 0;
  registerPwaControl({ registration: fakeRegistration(), applyUpdate: async () => { applied += 1; } });
  assert.equal(await checkAndApplyUpdate(50), 'latest');
  assert.equal(applied, 0);
});

test('com versão nova pronta aplica na hora e devolve "updating"', async () => {
  let applied = 0;
  registerPwaControl({
    registration: fakeRegistration({ waiting: true }),
    applyUpdate: async () => { applied += 1; },
  });
  markUpdatePending();
  assert.equal(await checkAndApplyUpdate(50), 'updating');
  assert.equal(applied, 1);
});

test('espera o download terminar quando a versão nova ainda está instalando', async () => {
  let applied = 0;
  const registration = { waiting: null, installing: {}, update: async () => {} } as unknown as ServiceWorkerRegistration;
  registerPwaControl({ registration, applyUpdate: async () => { applied += 1; } });
  const pending = checkAndApplyUpdate(500);
  setTimeout(markUpdatePending, 20);
  assert.equal(await pending, 'updating');
  assert.equal(applied, 1);
});

test('falha de rede ao procurar devolve "offline"', async () => {
  registerPwaControl({ registration: fakeRegistration({ updateFails: true }), applyUpdate: async () => {} });
  assert.equal(await checkAndApplyUpdate(50), 'offline');
});

test('getAppBuild devolve versão e data (ou "local" fora do build)', () => {
  const build = getAppBuild();
  assert.equal(typeof build.sha, 'string');
  assert.ok(build.sha.length > 0);
});
