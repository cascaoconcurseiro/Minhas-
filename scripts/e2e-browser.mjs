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

// E2E_PHONE=1 roda o roteiro inteiro como celular (390 px, toque, navegador móvel) — não é o Safari, mas pega erro de layout e de toque.
const phoneMode = process.env.E2E_PHONE === '1';
async function newPage(viewport) {
  const options = phoneMode ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } : { viewport };
  const page = await (await browser.newContext(options)).newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}

// No celular o menu lateral é uma gaveta: abre antes de tocar na tela desejada.
async function goTab(page, name, options = {}) {
  // No celular o nome do item inclui a legenda ("Lançamentos Extrato diário…"): casa pelo início.
  const locate = () => page.getByRole('button', { name: phoneMode ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) : name, exact: !phoneMode }).first();
  if (phoneMode && !(await locate().isVisible().catch(() => false))) await page.getByRole('button', { name: 'Abrir menu lateral' }).first().click();
  await locate().click(options);
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
  await page.getByText(/Bom dia|Boa tarde|Boa noite/).first().waitFor({ timeout: 15000 });
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

  await goTab(page, 'Lançamentos');
  // A aba abre no calendário; a lista fica em "Extrato (n)".
  await page.getByRole('button', { name: /^Extrato \(1\)/ }).first().click();
  await page.locator('text=Mercado E2E >> visible=true').first().waitFor();
  console.log('PASS: a despesa aparece no extrato');

  // Cartão: cadastra, lança compra parcelada (3x) e confere a fatura de cada parcela.
  await goTab(page, 'Cartões de Crédito');
  await page.getByRole('button', { name: 'Cadastrar Primeiro Cartão' }).click();
  await page.fill('#card-name-input', 'Cartão Teste');
  await page.fill('#card-limit-input', '500000');
  await page.selectOption('#card-closing-input', '10');
  await page.selectOption('#card-due-input', '20');
  await page.getByRole('button', { name: 'Salvar Cartão' }).click();
  await page.getByText('Cartão Teste').first().waitFor();
  console.log('PASS: cadastrou cartão com limite de R$ 5.000,00 (fecha dia 10, vence dia 20)');

  await page.getByRole('button', { name: 'Novo lançamento' }).first().click();
  const cardDialog = page.getByRole('dialog');
  await cardDialog.locator('#tx-amount').waitFor();
  await cardDialog.getByRole('button', { name: 'Despesa', exact: true }).click();
  await cardDialog.getByRole('button', { name: 'Cartão de crédito' }).click();
  await cardDialog.locator('#tx-amount').fill('30000');
  await cardDialog.locator('#tx-description').fill('Geladeira E2E');
  await cardDialog.locator('#tx-category-select').selectOption('cat-casa-decoracao');
  await cardDialog.getByRole('button', { name: /^Parcelado/ }).click();
  await cardDialog.locator('select').filter({ has: page.locator('option[value="3"]') }).last().selectOption('3');
  await cardDialog.getByRole('button', { name: 'Lançar 3x no Cartão' }).click();
  await cardDialog.waitFor({ state: 'detached' });
  console.log('PASS: lançou compra de R$ 300,00 no cartão, parcelada');
  await page.waitForTimeout(2500);
  // Confere na API (o que o servidor guardou): 3 parcelas de R$ 100,00, uma por fatura, mesmo cartão.
  const saved = await page.evaluate(async () => {
    const token = localStorage.getItem('minhas_economias_auth_token_v1');
    const response = await fetch('/api/workspace', { headers: { Authorization: `Bearer ${token}` } });
    const { payload } = await response.json();
    return JSON.parse(payload.transactionsJson).filter((tx) => tx.description.startsWith('Geladeira E2E'));
  });
  assert.equal(saved.length, 3, 'a compra parcelada vira 3 lançamentos');
  assert.deepEqual(saved.map((tx) => tx.amount), [100, 100, 100]);
  assert.equal(new Set(saved.map((tx) => tx.creditCardId)).size, 1);
  assert.equal(new Set(saved.map((tx) => tx.competenceMonth)).size, 3, 'cada parcela cai numa fatura diferente');
  assert.ok(saved.every((tx) => tx.status === 'pending' && tx.paymentMethod === 'credit_card'));
  console.log('PASS: o servidor guardou 3 parcelas de R$ 100,00 em 3 faturas diferentes');

  // Estorno no cartão: lança uma devolução de R$ 40 e confere que ela reduz a fatura (valor negativo no servidor).
  await page.getByRole('button', { name: 'Novo lançamento' }).first().click();
  const refundDialog = page.getByRole('dialog');
  await refundDialog.locator('#tx-amount').waitFor();
  await refundDialog.getByRole('button', { name: 'Despesa', exact: true }).click();
  await refundDialog.getByRole('button', { name: 'Cartão de crédito' }).click();
  await refundDialog.getByTestId('card-refund-toggle').locator('input').check();
  await refundDialog.locator('#tx-amount').fill('4000');
  await refundDialog.locator('#tx-description').fill('Estorno Geladeira E2E');
  await refundDialog.locator('#tx-category-select').selectOption('cat-casa-decoracao');
  await refundDialog.getByTestId('tx-submit-btn').click();
  await refundDialog.waitFor({ state: 'detached' });
  await page.waitForTimeout(2500);
  const afterRefund = await page.evaluate(async () => {
    const token = localStorage.getItem('minhas_economias_auth_token_v1');
    const response = await fetch('/api/workspace', { headers: { Authorization: `Bearer ${token}` } });
    const { payload } = await response.json();
    return JSON.parse(payload.transactionsJson).filter((tx) => tx.creditCardId);
  });
  const refunds = afterRefund.filter((tx) => tx.isCardRefund);
  assert.equal(refunds.length, 1, 'um estorno gravado');
  assert.equal(refunds[0].amount, -40);
  assert.equal(refunds[0].status, 'pending');
  const netTotal = Math.round(afterRefund.reduce((sum, tx) => sum + tx.amount * 100, 0)) / 100;
  assert.equal(netTotal, 260, 'compras de R$ 300 menos o estorno de R$ 40');
  console.log('PASS: o estorno de R$ 40 foi guardado como valor negativo e a fatura líquida ficou em R$ 260,00');

  // Viagens: cria uma viagem e abre a página dela (lista -> viagem -> subtelas).
  await goTab(page, 'Viagens & Câmbio');
  await page.getByRole('button', { name: 'Criar Primeira Viagem' }).click();
  await page.fill('#trip-form-name', 'Lisboa E2E');
  await page.fill('#trip-form-destination', 'Lisboa');
  await page.selectOption('#trip-form-currency', 'EUR');
  await page.fill('#trip-form-start-date', '2027-03-10');
  await page.fill('#trip-form-end-date', '2027-03-20');
  await page.fill('#trip-form-budget', '1500');
  await page.getByRole('button', { name: 'Criar Viagem', exact: true }).click();
  await page.locator('text=Lisboa E2E >> visible=true').first().waitFor();
  console.log('PASS: criou a viagem Lisboa E2E (EUR)');
  await page.locator('text=Lisboa E2E >> visible=true').first().click();
  await page.getByTestId('trip-dedicated-page').waitFor();
  console.log('PASS: abriu a página da viagem');

  // Página do cartão: abre a fatura de dezembro (onde caíram as 3 parcelas), paga parte e leva o restante para a próxima.
  await goTab(page, 'Cartões de Crédito');
  await page.getByRole('button', { name: 'Próximo mês' }).first().click();
  await page.getByText('Cartão Teste').first().click();
  await page.getByTestId('card-dedicated-page').waitFor();
  await page.getByTestId('pay-full-invoice-btn').waitFor({ timeout: 8000 }).catch(async (error) => { console.log('Tela do cartão:', (await page.locator('main').first().innerText()).replace(/\s+/g, ' ').slice(0, 900)); throw error; });
  await page.getByRole('button', { name: 'Pagar Parcial' }).click();
  const partialPanel = page.getByTestId('partial-invoice-payment-panel');
  await partialPanel.locator('input').fill('5000');
  await partialPanel.getByRole('button', { name: 'Confirmar Abatimento' }).click();
  await page.getByTestId('invoice-carry-over-panel').waitFor();
  await page.getByTestId('carry-over-confirm').click();
  await page.getByTestId('carry-over-undo').waitFor();
  await page.waitForTimeout(2500);
  const carried = await page.evaluate(async () => {
    const token = localStorage.getItem('minhas_economias_auth_token_v1');
    const response = await fetch('/api/workspace', { headers: { Authorization: `Bearer ${token}` } });
    const { payload } = await response.json();
    return JSON.parse(payload.transactionsJson).filter((tx) => tx.creditCardId && tx.carriedFromInvoiceMonth);
  });
  assert.ok(carried.length >= 1, 'o restante da fatura foi levado para a próxima (guardado no servidor)');
  console.log(`PASS: pagou R$ 50,00 da fatura e levou ${carried.length} lançamento(s) para a próxima fatura`);
  if (phoneMode) { await noHorizontalScroll(page, "página do cartão com o painel de saldo levado (celular)"); console.log("PASS: no celular a página do cartão com o painel não passa da largura da tela"); }
  await page.getByTestId('carry-over-undo').click();
  await page.getByTestId('carry-over-confirm').waitFor();
  console.log('PASS: desfez o saldo levado e o painel voltou ao estado anterior');

  // Passeio: abre cada tela do menu e cada aba das Configurações; qualquer erro de JavaScript derruba o teste no fim.
  const menuTabs = ['Visão Geral', 'Lançamentos', 'Contas & Carteiras', 'Cartões de Crédito', 'Orçamentos', 'Viagens & Câmbio', 'Compartilhado', 'A Receber', 'Investimentos', 'Metas & Reservas', 'Relatórios & DRE'];
  for (const name of menuTabs) {
    await goTab(page, name);
    await page.locator('main').first().waitFor();
    await page.waitForTimeout(600);
    const text = (await page.locator('main').first().innerText()).trim();
    assert.ok(text.length > 20, `a tela "${name}" abriu vazia`);
  }
  console.log(`PASS: abriu as ${menuTabs.length} telas do menu sem erro`);
  await page.getByRole('button', { name: 'Abrir configurações do aplicativo' }).first().click();
  const settings = page.getByRole('dialog');
  await settings.waitFor();
  let settingsTabs = 0;
  for (const name of [/Apar[eê]ncia/i, /Categorias/i, /Regras/i, /Lembretes/i, /Perfil|Dados|Backup/i]) {
    const tab = settings.getByRole('button', { name }).first();
    if (await tab.count()) { await tab.click(); await page.waitForTimeout(300); settingsTabs += 1; }
  }
  assert.ok(settingsTabs >= 4, 'abas das configurações encontradas');
  await page.keyboard.press('Escape');
  console.log(`PASS: abriu ${settingsTabs} abas das Configurações sem erro`);

  if (phoneMode) await page.getByRole('button', { name: 'Abrir menu lateral' }).first().click();
  await page.getByRole('button', { name: 'Sair da conta' }).first().click();
  await page.getByRole('button', { name: /Entrar na Conta/i }).first().waitFor();
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.getByRole('button', { name: /^Entrar/i }).last().click();
  await goTab(page, 'Visão Geral', { timeout: 15000 });
  await waitVisibleText(page, '826,55');
  console.log('PASS: saiu e entrou de novo; os dados continuam (saldo R$ 826,55 depois do pagamento parcial de R$ 50,00)');

  const phone = await newPage({ width: 390, height: 844 });
  await phone.goto(base, { waitUntil: 'networkidle' });
  await phone.fill('input[name=email]', email);
  await phone.fill('input[name=password]', password);
  await phone.getByRole('button', { name: /^Entrar/i }).last().click();
  await waitVisibleText(phone, '826,55');
  await noHorizontalScroll(phone, 'Visão Geral no celular');
  console.log('PASS: no celular (390 px) a Visão Geral não passa da largura da tela');

  assert.deepEqual(errors, [], 'erros de JavaScript na página');
  console.log('E2E concluído sem erros de JavaScript');
} finally {
  await browser.close();
}
