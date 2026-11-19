/** Subtela Como funciona: explicação dos cenários de moeda e grupo. Parte de TripsTab (ver TripsTab.tsx). */
import { ArrowLeftRight, Coins, Sparkles, Users } from 'lucide-react';
import type { TripPageContext } from './tripsTabContext';

export function TripHowItWorksView({ form }: { form: TripPageContext }) {
  const {
    activeSubView,
  } = form;
  return (
    <>
{/* SUB-VIEW 4: COMPLETE EXPLANATION OF ALL MULTI-CURRENCY & GROUP SCENARIOS */}
      {activeSubView === 'how_it_works' && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Guia de Arquitetura Financeira: Viagens, Multi-Moeda & Rateio em Grupo
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Como o Minhas Economias BR resolve todas as possibilidades reais de compras internacionais, IOF e reembolsos entre amigos ou casal:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                <Coins className="h-4 w-4" />
                1. Lançamento em Outra Moeda (4 Regimes de Conversão)
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                No formulário de <strong>Novo Lançamento</strong>, ao escolher USD, EUR, GBP, ARS, CLP etc., o app calcula o valor exato em Reais conforme o meio usado:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Conta Global (Wise / Nomad / C6 / Inter):</strong> Usa automaticamente o seu <em>Câmbio Médio Ponderado</em> dos lotes comprados (ou câmbio comercial + 1,1% IOF).
                </li>
                <li>
                  <strong>Cartão de Crédito Brasileiro no Exterior:</strong> Aplica a cotação do cartão + <strong>3,38% de IOF</strong> e lança o valor exato em R$ direto na fatura do cartão.
                </li>
                <li>
                  <strong>Papel Moeda (Espécie):</strong> Converte pela taxa efetiva paga na casa de câmbio.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-400">
                <Users className="h-4 w-4" />
                2. Quando Você Paga vs. Quando um Amigo Paga
              </span>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Se VOCÊ pagou a conta do restaurante (€ 90 para 3 pessoas):</strong> O seu banco/cartão registra a saída real de € 90 (R$ 579,68), mas o seu orçamento pessoal da viagem registra apenas a <strong>Sua Parte Real (€ 30 / R$ 193,23)</strong> e lança € 60 a receber dos amigos.
                </li>
                <li>
                  <strong>Se um AMIGO pagou no cartão dele (€ 150 para 3 pessoas):</strong> O sistema <strong>NÃO desconta do seu banco brasileiro</strong> (isolamento contábil), soma € 50 na sua meta pessoal de gastos da viagem e registra que você deve € 50 a ele.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-violet-700 dark:text-violet-400">
                <ArrowLeftRight className="h-4 w-4" />
                3. Como Receber ou Pagar (Em R$ no PIX ou na Moeda da Viagem)
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Na aba <strong>Divisão do Grupo & Acerto</strong>, ao clicar em <em>Liquidar / Receber</em>, você escolhe como o dinheiro foi transferido:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                <li>
                  <strong>Receber/Pagar em R$ via PIX:</strong> Você pode usar o <strong>VET Efetivo (com IOF incluso)</strong> para não sair no prejuízo dos impostos que pagou no cartão, ou definir uma cotação combinada. O app ainda cria automaticamente a entrada/saída em R$ no seu extrato bancário!
                </li>
                <li>
                  <strong>Receber/Pagar em EUR ou USD (Wise-to-Wise ou Notas):</strong> Quita a dívida diretamente na moeda estrangeira sem mexer no saldo em Reais do seu banco no Brasil.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <Sparkles className="h-4 w-4" />
                4. 5 Modos de Rateio sem Erro de Centavos
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Cada despesa da viagem pode ser dividida de 5 formas: <strong>Igualitária (1/N)</strong>, <strong>Valores Exatos</strong> (quando cada pessoa pede um prato diferente), <strong>Porcentagem (%)</strong>, <strong>Cotas/Pesos</strong> (ex: casal paga 2 cotas, solteiro paga 1) ou <strong>100% Individual</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
