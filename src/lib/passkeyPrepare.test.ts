import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrepared, PREPARED_TTL_MS } from './passkeyPrepare';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('takeReady nunca espera a rede: sem preparo devolve null', () => {
  const prepared = createPrepared(async () => 'x');
  assert.equal(prepared.takeReady(), null);
});

test('depois de preparado, devolve o valor uma única vez', async () => {
  let loads = 0;
  const prepared = createPrepared(async () => ({ n: ++loads }));
  prepared.prepare();
  assert.equal(prepared.takeReady(), null, 'ainda a caminho');
  await tick();
  assert.deepEqual(prepared.takeReady(), { n: 1 });
  assert.equal(prepared.takeReady(), null, 'já foi consumido');
});

test('prepare não busca de novo enquanto o valor ainda vale', async () => {
  let loads = 0;
  const prepared = createPrepared(async () => ++loads);
  prepared.prepare();
  prepared.prepare();
  await tick();
  prepared.prepare();
  assert.equal(loads, 1);
});

test('valor vencido não é usado e é refeito', async () => {
  let clock = 0;
  let loads = 0;
  const prepared = createPrepared(async () => ++loads, { now: () => clock });
  prepared.prepare();
  await tick();
  clock = PREPARED_TTL_MS + 1;
  assert.equal(prepared.takeReady(), null, 'venceu');
  prepared.prepare();
  await tick();
  assert.equal(prepared.takeReady(), 2);
});

test('falha na busca é refeita no próximo prepare', async () => {
  let loads = 0;
  const prepared = createPrepared(async () => {
    loads += 1;
    if (loads === 1) throw new Error('rede');
    return 'ok';
  });
  assert.equal(await prepared.whenReady(), false);
  assert.equal(prepared.takeReady(), null);
  assert.equal(await prepared.whenReady(), true);
  assert.equal(prepared.takeReady(), 'ok');
});
