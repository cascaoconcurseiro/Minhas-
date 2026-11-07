import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { Transaction, Trip, TripDashboardSummary } from '../types/finance';
import { MonthlyCalendarView } from './MonthlyCalendarView';
import { MonthlyComparisonBarChart } from './MonthlyComparisonBarChart';
import { SwipeableTransactionCard } from './SwipeableTransactionCard';
import { TripSavingsChart } from './TripSavingsChart';
import { ProjectAndDatabaseDocsPanel } from './ProjectAndDatabaseDocsPanel';
import { TripPdfReportModal } from './TripPdfReportModal';
import { SmartCurrencyConverterCard } from './SmartCurrencyConverterCard';
import { PWAInstallButton } from './PWAInstallButton';

const { createRoot } = await import('react-dom/client');
let root: Root | null = null;
let container: HTMLDivElement | null = null;
function render(element: React.ReactNode) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  act(() => root?.render(element)); return container;
}
function click(target: Element | null) { assert.ok(target, 'expected clickable element'); act(() => (target as HTMLElement).click()); }
function button(label: string, scope: ParentNode = container!) {
  const result = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.includes(label) || b.getAttribute('aria-label') === label);
  assert.ok(result, `expected button ${label}`); return result as HTMLButtonElement;
}
afterEach(() => { if (root) act(() => root?.unmount()); root = null; container?.remove(); container = null; });

const tx: Transaction = { id:'tx1', description:'Mercado', amount:120, date:'2026-11-06', competenceMonth:'2026-11', type:'expense', status:'pending', categoryId:'food', accountId:'acc1', paymentMethod:'pix', recurrence:'single' };

test('MonthlyCalendarView filters, selects dates and dispatches quick-add and transaction actions', () => {
  const calls: unknown[][] = [];
  const page = render(<MonthlyCalendarView selectedMonth="2026-11" transactions={[tx]} accounts={[]} cards={[]} categories={[]} onToggleStatus={(...args) => calls.push(['toggle',...args])} onEditTransaction={(...args) => calls.push(['edit',...args])} onDeleteTransaction={(...args) => calls.push(['delete',...args])} onOpenNewTransaction={(...args) => calls.push(['new',...args])} />);
  click(button('Pendências & A Vencer', page));
  assert.match(page.textContent ?? '', /Mercado/);
  click(page.querySelector('[aria-label="Lançar em 2026-11-06"]'));
  assert.deepEqual(calls.pop(), ['new','expense','2026-11-06']);
  click(button('Efetivar', page)); assert.deepEqual(calls.pop(), ['toggle','tx1']);
  click(button('Editar Mercado', page)); assert.deepEqual((calls.pop() ?? [])[0], 'edit');
  click(button('Excluir Mercado', page)); assert.deepEqual(calls.pop(), ['delete','tx1']);
  click(button('+ Receita', page)); assert.deepEqual(calls.pop(), ['new','income','2026-11-06']);
});

test('MonthlyComparisonBarChart switches between six-month and filtered series', () => {
  const page = render(<MonthlyComparisonBarChart selectedMonth="2026-11" accounts={[]} cards={[]} transactions={[]} periodMonthlySeries={[{month:'2026-10',label:'OUTUBRO TESTE',shortLabel:'OUT',income:10,expense:2,netSavings:8,savingsRate:80,cumulativeBalance:8,expenseDeltaPercent:0,incomeDeltaPercent:0}]} />);
  const filtered = button('Período Filtrado', page);
  click(filtered); assert.match(filtered.className, /bg-white/);
  const sixMonths = button('Últimos 6 Meses', page);
  click(sixMonths); assert.match(sixMonths.className, /bg-white/);
});

test('SwipeableTransactionCard invokes status, edit, duplicate, delete and action-sheet callbacks', () => {
  const calls: string[] = [];
  const page = render(<SwipeableTransactionCard transaction={tx} category={{id:'food',name:'Alimentação',type:'expense',bucket:'essential',monthlyBudget:0,color:'#0f0',icon:'utensils',subcategories:[]}} originLabel="Contas" onToggleStatus={(id) => calls.push(`toggle:${id}`)} onEdit={() => calls.push('edit')} onDuplicate={() => calls.push('duplicate')} onDelete={(id) => calls.push(`delete:${id}`)} onOpenActionSheet={() => calls.push('sheet')} />);
  click(button('Efetivar',page)); click(button('Editar Mercado',page)); click(button('Duplicar Mercado',page)); click(button('Excluir Mercado',page)); click(button('Menu de opções para Mercado',page));
  assert.deepEqual(calls,['toggle:tx1','edit','duplicate','delete:tx1','sheet']);
});

test('TripSavingsChart dispatches period, export, zoom and explanation controls', async () => {
  const exported: number[]=[]; const periods: string[]=[]; const lot={id:'lot1',date:'2026-11-01',currency:'USD' as const,foreignAmount:100,rateBase:5,iofPercent:0,effectiveRateBrl:5,totalBrlPaid:500,sourceLabel:'teste'}; const page=render(<TripSavingsChart exchangeLots={[lot]} currency="USD" fallbackBenchmarkRate={5.5} periodMode="lot" onPeriodModeChange={(mode)=>periods.push(mode)} onExportPdfReport={()=>exported.push(1)} />);
  click(page.querySelector('[data-testid="chart-period-month-btn"]')); assert.deepEqual(periods,['month']);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 240)); });
  click(button('Exportar Relatório PDF',page)); assert.equal(exported.length,1);
  click(button('Aumentar Zoom no gráfico',page)); assert.match(page.querySelector('[title="Redefinir Zoom para 100%"]')?.textContent??'',/125/);
  click(page.querySelector('[title="Redefinir Zoom para 100%"]')); assert.match(page.querySelector('[title="Redefinir Zoom para 100%"]')?.textContent??'',/100/);
  click(page.querySelector('[title="O que representa este cálculo de economia?"]')); assert.match(page.textContent??'',/Como o cálculo de economia cambial funciona/);
});

test('ProjectAndDatabaseDocsPanel switches docs tabs, copies commands and triggers markdown download', async () => {
  let copied=''; const oldClipboard=navigator.clipboard;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async (s:string)=>{copied=s;}}});
  const oldCreate=URL.createObjectURL; const oldRevoke=URL.revokeObjectURL; URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  const oldClick=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){};
  try {
    const page=render(<ProjectAndDatabaseDocsPanel autoVaultId="vault-test" userEmail="test@example.com" />);
    click(button('Arquitetura & Módulos',page)); assert.match(page.textContent??'',/Documentação Gerada no Projeto/);
    click(button('API REST & Motores Puros',page)); assert.match(page.textContent??'',/\/api\/readiness/);
    click(button('Sincronização GitHub',page));
    const input=page.querySelector('input'); assert.ok(input); act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(input,'https://github.com/test/repo.git'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));});
    click(button('Copiar Comandos',page)); await new Promise(r=>setTimeout(r,0));
    assert.ok(copied.includes('git push') || copied.includes('git branch'));
    click(page.querySelector('[data-testid="download-full-docs-btn"]')); assert.equal(document.querySelector('[data-testid="project-and-db-docs-panel"]')!==null,true);
  } finally { Object.defineProperty(navigator,'clipboard',{configurable:true,value:oldClipboard}); URL.createObjectURL=oldCreate; URL.revokeObjectURL=oldRevoke; HTMLAnchorElement.prototype.click=oldClick; }
});

test('TripPdfReportModal calls print and close, and renders safely while closed', () => {
  let prints=0, closes=0; const oldPrint=window.print; window.print=()=>{prints++;};
  const trip: Trip={id:'trip1',name:'Viagem teste',destination:'Lisboa',startDate:'2026-11-01',endDate:'2026-11-05',status:'planning',currency:'EUR',defaultExchangeRate:6,budgetForeign:100,participants:[],exchangeLots:[],settlements:[],coverColor:'#123'};
  const summary: TripDashboardSummary={tripId:'trip1',currency:'EUR',weightedAverageRate:6,totalForeignPurchased:0,totalBrlPurchasedForLots:0,remainingForeignWalletBalance:0,totalDays:5,elapsedDays:0,remainingDays:5,groupTotalSpendForeign:0,groupTotalSpendBrl:0,myPersonalSpendForeign:0,myPersonalSpendBrl:0,myOutOfPocketPaidForeign:0,myOutOfPocketPaidBrl:0,budgetForeign:100,budgetBrlEquivalent:600,budgetRemainingForeign:100,budgetUsedPercent:0,myDailyAverageForeign:0,myDailyAverageBrl:0,safeRemainingDailyForeign:20,safeRemainingDailyBrl:120,dailySeries:[],categoryBreakdown:[],participantBalances:[],simplifiedDebts:[],myNetSettlementForeign:0,myNetSettlementBrl:0};
  try { const closed=render(<TripPdfReportModal trip={trip} summary={summary} transactions={[]} categories={[]} isOpen={false} onClose={()=>closes++}/>); assert.equal(closed.querySelector('[role=dialog]'),null);
    const page=render(<TripPdfReportModal trip={trip} summary={summary} transactions={[]} categories={[]} isOpen onClose={()=>closes++}/>); click(button('Imprimir / Visualizar',page)); click(button('Fechar relatório',page)); assert.equal(prints,1); assert.equal(closes,1);
  } finally { window.print=oldPrint; }
});

test('SmartCurrencyConverterCard converts a preset, reverses direction and applies converted amount', () => {
  const applied:number[][]=[]; const page=render(<SmartCurrencyConverterCard exchangeLots={[]} currency="USD" defaultExchangeRate={5} getAuthToken={async()=> 'synthetic-token'} onUseConvertedValue={(...v)=>applied.push(v)} onApplyLiveRateToTrip={()=>{}} />);
  click(page.querySelector('[data-testid="quick-converter-swap-btn"]'));
  const amount=page.querySelector('[data-testid="quick-converter-amount-input"]') as HTMLInputElement; assert.ok(amount);
  act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set?.call(amount,'50'); amount.dispatchEvent(new Event('input',{bubbles:true})); amount.dispatchEvent(new Event('change',{bubbles:true}));});
  click(button('Lançar Gasto',page));
  assert.equal(applied.length,1); assert.ok(applied[0][0]>=0 && applied[0][1]>=0);
});

test('SmartCurrencyConverterCard applies a synthetic live quote and exposes request failures', async () => {
  const previousFetch=globalThis.fetch; const applied: unknown[][]=[]; let request: RequestInit | undefined;
  globalThis.fetch=async (_input, init) => { request=init; return new Response(JSON.stringify({currency:'USD',targetCurrency:'BRL',commercialRateBrl:5.4,summaryText:'Cotação sintética',fetchedAt:'2026-11-07T12:00:00Z',sources:[]}),{status:200,headers:{'Content-Type':'application/json'}}); };
  try {
    const page=render(<SmartCurrencyConverterCard exchangeLots={[]} currency="USD" defaultExchangeRate={5} getAuthToken={async()=> 'token-sintetico'} onApplyLiveRateToTrip={(...args)=>applied.push(args)} />);
    await act(async()=>{click(page.querySelector('[data-testid="fetch-live-fx-rate-btn"]')); await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal((request?.headers as Record<string,string>).Authorization,'Bearer token-sintetico');
    click(page.querySelector('[data-testid="apply-live-rate-to-trip-btn"]')); assert.deepEqual(applied,[[5.4,'USD']]);

    if(root) act(()=>root?.unmount()); root=null; page.remove();
    globalThis.fetch=async()=>new Response(JSON.stringify({error:'cotação indisponível'}),{status:503,headers:{'Content-Type':'application/json'}});
    const failed=render(<SmartCurrencyConverterCard exchangeLots={[]} currency="USD" defaultExchangeRate={5} getAuthToken={async()=> 'token'} />);
    await act(async()=>{click(failed.querySelector('[data-testid="fetch-live-fx-rate-btn"]')); await new Promise(resolve=>setTimeout(resolve,0));});
    assert.match(failed.querySelector('[data-testid="live-fx-rate-error"]')?.textContent??'',/cotação indisponível/);
  } finally { globalThis.fetch=previousFetch; }
});

test('PWAInstallButton prompts install and handles iOS guide dismissal paths', async () => {
  const oldUA=Object.getOwnPropertyDescriptor(window.navigator,'userAgent');
  const promptEvent=new Event('beforeinstallprompt',{cancelable:true}) as Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted';platform:string}>};
  let prompted=0; promptEvent.prompt=async()=>{prompted++;}; promptEvent.userChoice=Promise.resolve({outcome:'accepted',platform:'web'});
  let page=render(<PWAInstallButton />); act(()=>window.dispatchEvent(promptEvent)); click(button('Instalar App',page)); await act(async()=>{await Promise.resolve();}); assert.equal(prompted,1);
  if(root) act(()=>root?.unmount()); root=null; page.remove();
  Object.defineProperty(window.navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'});
  try {
    page=render(<PWAInstallButton variant="banner" />); click(button('Como Instalar',page)); assert.ok(page.querySelector('[role="dialog"]'));
    click(button('Entendido',page)); assert.equal(page.querySelector('[role="dialog"]'),null);
    click(button('Dispensar sugestão de instalação',page)); assert.equal(page.querySelector('button'),null);
  } finally { if(oldUA) Object.defineProperty(window.navigator,'userAgent',oldUA); else delete (window.navigator as {userAgent?:string}).userAgent; }
});
