/**
 * Teste de ponta a ponta em navegador real (Chromium) contra um servidor LOCAL ligado a um PostgreSQL
 * descartável. Nunca rode contra produção: o roteiro cria contas e lançamentos de teste.
 *
 * Como rodar (ver docs/tecnico/testes-e-qualidade.md):
 *   1. PostgreSQL descartável com as migrações de db/migrations aplicadas.
 *   2. bun run build && NODE_ENV=production PORT=3920 DATABASE_URL=<local> AUTH_SESSION_SECRET=<32+ letras> bun backend/app.ts
 *   3. E2E_BASE_URL=http://localhost:3920 node scripts/e2e-browser.mjs
 *
 * Cobre: criar conta de login, cadastrar conta bancária, lançar despesa paga, recarregar (dado vem do
 * banco), ver no extrato, sair e entrar de novo, e largura de celular (390 px) sem rolagem lateral.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

// Playwright não é dependência do projeto: usa o do projeto se houver, senão o instalado globalmente.
const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}
const { chromium } = loadPlaywright();

const base = process.env.E2E_BASE_URL || 'http://localhost:3920';
const host = new URL(base).hostname;
assert.ok(['localhost', '127.0.0.1'].includes(host), 'Só roda contra servidor local (nunca produção).');

const email = `e2e-${Date.now()}@qa.example`;
const password = 'senha-e2e-123';
const browser = await chromium.launch();
const errors = [];

async function newPage(viewport) {
  const page = await (await browser.newContext({ viewport })).newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}

async function waitVisibleText(page, text) {
  try {
    await page.locator(`text=${text} >> visible=true`).first().waitFor({ timeout: 15000 });
  } catch (error) {
    console.log('Tela no momento da falha:', (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 600));
    throw error;
  }
}

async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${label}: a página passou da largura da tela em ${overflow}px`);
}

try {
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Criar Nova Conta/i }).click();
  await page.fill('input[name=name]', 'Teste E2E');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.getByRole('button', { name: /Criar Conta e Acessar/i }).click();
  await page.getByText('Boa', { exact: false }).first().waitFor({ timeout: 15000 });
  console.log('PASS: criou a conta de login e abriu a Visão Geral');

  await page.getByRole('button', { name: '+ Cadastrar Primeira Conta' }).click();
  await page.getByRole('button', { name: 'Cadastrar Conta Nacional (R$)' }).click();
  await page.fill('#account-form-name-input', 'Banco Teste');
  await page.fill('#account-form-institution-input', 'Banco');
  await page.fill('#account-form-initial-balance-input', '100000');
  await page.getByRole('button', { name: 'Criar Conta', exact: true }).click();
  await page.getByText('Banco Teste').first().waitFor();
  console.log('PASS: cadastrou conta bancária com saldo inicial de R$ 1.000,00');

  await page.getByRole('button', { name: 'Novo lançamento' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#tx-amount').waitFor();
  await dialog.getByRole('button', { name: 'Despesa', exact: true }).click();
  await dialog.locator('#tx-amount').fill('12345');
  await dialog.locator('#tx-description').fill('Mercado E2E');
  await dialog.locator('#tx-category-select').selectOption('cat-mercado');
  await dialog.getByRole('button', { name: 'Conta / débito' }).click();
  await dialog.getByRole('button', { name: 'Pago', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar Lançamento' }).click();
  await dialog.waitFor({ state: 'detached' });
  console.log('PASS: lançou despesa paga de R$ 123,45');

  // Espera a gravação silenciosa no banco e recarrega: o que aparece vem do servidor.
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'networkidle' });
  await waitVisibleText(page, '876,55');
  console.log('PASS: depois de recarregar, o saldo é R$ 876,55 (veio do banco)');

  await page.getByRole('button', { name: 'Lançamentos', exact: true }).first().click();
  // A aba abre no calendário; a lista fica em "Extrato (n)".
  await page.getByRole('button', { name: /^Extrato \(1\)/ }).first().click();
  await page.locator('text=Mercado E2E >> visible=true').first().waitFor();
  console.log('PASS: a despesa aparece no extrato');

  await page.getByRole('button', { name: 'Sair da conta' }).first().click();
  await page.getByRole('button', { name: /Entrar na Conta/i }).first().waitFor();
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.getByRole('button', { name: /^Entrar/i }).last().click();
  await page.getByRole('button', { name: 'Visão Geral', exact: true }).first().click({ timeout: 15000 });
  await waitVisibleText(page, '876,55');
  console.log('PASS: saiu e entrou de novo; os dados continuam');

  const phone = await newPage({ width: 390, height: 844 });
  await phone.goto(base, { waitUntil: 'networkidle' });
  await phone.fill('input[name=email]', email);
  await phone.fill('input[name=password]', password);
  await phone.getByRole('button', { name: /^Entrar/i }).last().click();
  await waitVisibleText(phone, '876,55');
  await noHorizontalScroll(phone, 'Visão Geral no celular');
  console.log('PASS: no celular (390 px) a Visão Geral não passa da largura da tela');

  assert.deepEqual(errors, [], 'erros de JavaScript na página');
  console.log('E2E concluído sem erros de JavaScript');
} finally {
  await browser.close();
}
