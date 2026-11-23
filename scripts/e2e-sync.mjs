/**
 * Teste de sincronização entre DOIS aparelhos (dois navegadores na mesma conta), contra servidor local e
 * PostgreSQL descartável. Nunca rode contra produção. Veja scripts/e2e-browser.mjs para como subir o ambiente.
 *
 * Cobre: (1) o que um aparelho grava aparece no outro sozinho; (2) quem está digitando não perde o que digitou
 * quando o outro aparelho grava; (3) gravar com a versão desatualizada não perde dados em silêncio;
 * (3b) servidor fora do ar com nova tentativa automática; (4) sessão encerrada em um aparelho derruba o outro de volta ao login.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch {
    return require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright'));
  }
}
const { chromium } = loadPlaywright();
const base = process.env.E2E_BASE_URL || 'http://localhost:3920';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Só roda contra servidor local (nunca produção).');

const email = `sync-${Date.now()}@qa.example`;
const password = 'senha-sync-123';
const TOKEN_KEY = 'minhas_economias_auth_token_v1';
const errors = [];

async function api(pathname, token, method = 'GET', body) {
  const response = await fetch(base + pathname, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const session = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name: 'Sync QA' }) })).json();
const token = session.token;
assert.ok(token, 'cadastro devolveu o token');

const browser = await chromium.launch();
async function openDevice(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch { /* sem armazenamento */ } }, [TOKEN_KEY, token]);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByText(/Bom dia|Boa tarde|Boa noite/).first().waitFor({ timeout: 20000 });
  return page;
}
async function createAccount(page, name, balanceDigits) {
  await page.getByRole('button', { name: 'Contas & Carteiras', exact: true }).first().click();
  const first = page.getByRole('button', { name: /Cadastrar Primeira Conta|Nova Conta/ }).first();
  await first.click();
  const national = page.getByRole('button', { name: 'Cadastrar Conta Nacional (R$)' });
  if (await national.count()) await national.click();
  await page.fill('#account-form-name-input', name);
  await page.fill('#account-form-institution-input', 'Banco');
  await page.fill('#account-form-initial-balance-input', balanceDigits);
  await page.getByRole('button', { name: 'Criar Conta', exact: true }).click();
  await page.locator(`text=${name} >> visible=true`).first().waitFor();
}
async function seeAccountOn(page, name, timeoutMs = 25000) {
  await page.getByRole('button', { name: 'Contas & Carteiras', exact: true }).first().click();
  await page.locator(`text=${name} >> visible=true`).first().waitFor({ timeout: timeoutMs });
}

try {
  const deviceA = await openDevice('A');
  const deviceB = await openDevice('B');
  console.log('PASS: dois aparelhos abertos na mesma conta');

  // (1) A grava, B enxerga sozinho (sem recarregar).
  await createAccount(deviceA, 'Conta do A', '50000');
  await seeAccountOn(deviceB, 'Conta do A');
  console.log('PASS: o que o aparelho A gravou apareceu no aparelho B sozinho (sem recarregar)');

  // (2) B começa a digitar um lançamento; A grava outra coisa; B não perde o que digitou.
  await deviceB.getByRole('button', { name: 'Novo lançamento' }).first().click();
  const dialog = deviceB.getByRole('dialog');
  await dialog.locator('#tx-description').fill('Digitando no B');
  await dialog.locator('#tx-amount').fill('2500');
  await createAccount(deviceA, 'Segunda conta do A', '10000');
  await deviceB.waitForTimeout(12000);
  assert.equal(await dialog.locator('#tx-description').inputValue(), 'Digitando no B', 'o texto digitado no B continua lá');
  console.log('PASS: quem está digitando não perdeu o que digitou quando o outro aparelho gravou');

  // (3) B salva com a versão desatualizada: nenhum dado some em silêncio.
  await dialog.getByRole('button', { name: 'Despesa', exact: true }).click();
  await dialog.locator('#tx-category-select').selectOption('cat-mercado');
  await dialog.getByRole('button', { name: 'Conta / débito' }).click();
  await dialog.getByRole('button', { name: 'Pago', exact: true }).click();
  await dialog.getByTestId('tx-submit-btn').click();
  await deviceB.waitForTimeout(12000);
  const finalWorkspace = await api('/api/workspace', token);
  const accounts = JSON.parse(finalWorkspace.body.payload.accountsJson).map((account) => account.name);
  const transactions = JSON.parse(finalWorkspace.body.payload.transactionsJson).map((tx) => tx.description);
  console.log('Estado final no servidor:', JSON.stringify({ accounts, transactions }));
  assert.ok(accounts.includes('Conta do A') && accounts.includes('Segunda conta do A'), 'as contas criadas pelo A continuam no servidor');
  assert.ok(transactions.includes('Digitando no B'), 'o lançamento do B chegou ao servidor');
  console.log('PASS: gravação do B depois do A não perdeu dados de nenhum dos dois');

  // (3b) Servidor fora do ar: a gravação falha, nada é perdido e uma nova tentativa grava sozinha quando volta.
  let serverDown = true;
  let blockedWrites = 0;
  await deviceA.route('**/api/workspace', async (route) => {
    if (serverDown && route.request().method() === 'PUT') { blockedWrites += 1; await route.abort('connectionrefused'); return; }
    await route.continue();
  });
  await createAccount(deviceA, 'Conta feita sem servidor', '7700');
  await deviceA.waitForTimeout(5000);
  const whileDown = JSON.parse((await api('/api/workspace', token)).body.payload.accountsJson).map((account) => account.name);
  assert.ok(blockedWrites >= 1, 'o aparelho tentou gravar enquanto o servidor estava fora');
  assert.ok(!whileDown.includes('Conta feita sem servidor'), 'com o servidor fora, nada chegou ao banco');
  assert.ok(await deviceA.locator('text=Conta feita sem servidor >> visible=true').first().isVisible(), 'a conta continua na tela do aparelho');
  serverDown = false;
  const retryDeadline = Date.now() + 45000;
  let saved = false;
  while (Date.now() < retryDeadline && !saved) {
    await deviceA.waitForTimeout(2000);
    saved = JSON.parse((await api('/api/workspace', token)).body.payload.accountsJson).some((account) => account.name === 'Conta feita sem servidor');
  }
  assert.ok(saved, 'quando o servidor voltou, a nova tentativa gravou sozinha');
  await deviceA.unroute('**/api/workspace');
  console.log(`PASS: servidor fora do ar (${blockedWrites} gravações recusadas): dado ficou na tela e foi gravado sozinho quando voltou`);

  // (4) Sessão encerrada: o aparelho que continua aberto volta ao login.
  const logout = await api('/api/auth/logout', token, 'POST');
  assert.equal(logout.status, 204);
  await deviceB.getByRole('button', { name: /Entrar na Conta/i }).first().waitFor({ timeout: 30000 });
  console.log('PASS: sessão encerrada em outro lugar derrubou este aparelho de volta ao login');

  assert.deepEqual(errors, [], 'erros de JavaScript nas páginas');
  console.log('Sincronização entre aparelhos concluída sem erros de JavaScript');
} finally {
  await browser.close();
}
