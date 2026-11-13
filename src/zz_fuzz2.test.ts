import test from 'node:test';
import { calculateTripExpenseSplit, simplifyTripDebts, calculateConvertedBrlAmount } from './utils/travelRules';
import { settleSharedExpenses, reopenSharedSettlement, calculateSharedMonthTotals } from './utils/sharedFinanceRules';
import { calculateAccountBalances } from './utils/financeRules';
import { applyAssetOperation } from './utils/investmentRules';
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const r2 = (n:number)=>Math.round(n*100)/100;
test('trip split', () => {
  let bad=0;
  for (let i=0;i<2000;i++) {
    const n = 1+Math.floor(rnd()*6);
    const parts:any[] = Array.from({length:n},(_,k)=>({id:'p'+k,name:'P'+k}));
    const totalF = r2(1+rnd()*900), rate = 3+rnd()*4, totalB = r2(totalF*rate);
    for (const method of ['equal','shares','percentage','exact','individual'] as const) {
      let custom:any[] = [];
      if (method==='percentage') { let left=10000; custom = parts.map((p,k)=>{ const v = k===n-1?left:Math.floor(rnd()*left*0.6); left-=v; return {participantId:p.id, percentage:v/100};}); }
      if (method==='exact') { let left=Math.round(totalF*100); custom = parts.map((p,k)=>{ const v = k===n-1?left:Math.floor(rnd()*left*0.6); left-=v; return {participantId:p.id, exactForeign:v/100};}); }
      if (method==='shares') custom = parts.map(p=>({participantId:p.id, sharesWeight:1+Math.floor(rnd()*3)}));
      const shares = calculateTripExpenseSplit(totalF,totalB,parts,parts.map(p=>p.id),method,custom);
      if (!shares.length) { bad++; if(bad<5) console.log('empty split',method,n,totalF); continue; }
      const sf = r2(shares.reduce((a,s)=>a+s.foreignShare,0)), sb = r2(shares.reduce((a,s)=>a+s.brlShare,0));
      if (Math.abs(sf-totalF)>0.005 || Math.abs(sb-totalB)>0.005) { bad++; if(bad<5) console.log('split mismatch',method,n,totalF,sf,totalB,sb); }
      if (shares.some(s=>s.foreignShare<0||s.brlShare<0)) { bad++; if(bad<5) console.log('negative share',method); }
    }
  }
  console.log('trip split bad', bad);
});
test('debts', () => {
  let bad=0;
  for (let i=0;i<2000;i++) {
    const n = 2+Math.floor(rnd()*5);
    let left=0; const bal:any[] = Array.from({length:n},(_,k)=>{ const v = k===n-1? -left : r2((rnd()-0.5)*500); left=r2(left+v); return {participantId:'p'+k,participantName:'P'+k,netBalanceForeign:v,netBalanceBrl:r2(v*5)}; });
    const t = simplifyTripDebts(bal,5);
    const net = new Map<string,number>(bal.map((b:any)=>[b.participantId,b.netBalanceForeign]));
    for (const x of t as any[]) { net.set(x.fromParticipantId ?? x.fromId, r2((net.get(x.fromParticipantId ?? x.fromId)||0)+x.amountForeign)); net.set(x.toParticipantId ?? x.toId, r2((net.get(x.toParticipantId ?? x.toId)||0)-x.amountForeign)); }
    const residual = [...net.values()].some(v=>Math.abs(v)>0.02);
    if (residual) { bad++; if (bad<4) console.log('debt residual', JSON.stringify(bal.map((b:any)=>b.netBalanceForeign)), JSON.stringify(t)); }
  }
  console.log('debts bad', bad);
});
test('asset ops', () => {
  let bad=0;
  for (let i=0;i<2000;i++) {
    let a:any = {id:'a',ticker:'X',quantity:0,averagePrice:0,currentPrice:10};
    for (let k=0;k<20;k++) { const op = rnd()<0.6?'buy':'sell'; const q = r2(rnd()*50); const p = r2(1+rnd()*100); const before=a; a = applyAssetOperation(a,op as any,q,p); if (a.quantity<0 || !Number.isFinite(a.averagePrice)||!Number.isFinite(a.quantity)) {bad++; if(bad<4) console.log('asset bad',op,before.quantity,q,a.quantity,a.averagePrice);} if (op==='sell' && q>before.quantity+1e-9 && a.quantity!==0) {bad++; if(bad<4) console.log('oversell allowed', before.quantity,q,a.quantity);} }
  }
  console.log('asset bad', bad);
});
test('shared settle roundtrip', () => {
  let bad=0;
  const accs:any[]=[{id:'a',name:'C',type:'checking',initialBalance:100,includeInTotal:true,currency:'BRL'}];
  for (let i=0;i<500;i++) {
    const txs:any[] = Array.from({length:1+Math.floor(rnd()*6)},(_,k)=>{ const amt=r2(10+rnd()*200); return {id:'s'+k,description:'d',amount:amt,date:'2026-11-10',competenceMonth:'2026-11',type:'expense',status:'paid',categoryId:'x',accountId:'a',recurrence:'single',paymentMethod:'pix',isShared:true,sharedMemberId:'m',sharedAmount:r2(amt/2),sharedPaidBy:rnd()<0.5?'me':'member',sharedStatus:'pending'}; });
    const before = JSON.stringify(calculateAccountBalances(accs,txs,'2026-11'));
    const res:any = settleSharedExpenses(txs,accs,{memberId:'m',month:'2026-11',memberName:'M',accountId:'a',date:'2026-11-20',settlementId:'set1'});
    const settledTx = res.transactions.find((t:any)=>t.sharedStatus==='received');
    if (!settledTx) continue;
    const back:any = reopenSharedSettlement(res.transactions, settledTx.id);
    const after = JSON.stringify(calculateAccountBalances(accs,back.transactions,'2026-11'));
    if (after!==before || back.transactions.length!==txs.length) { bad++; if(bad<4) console.log('settle roundtrip differs'); }
  }
  console.log('shared bad', bad);
});
