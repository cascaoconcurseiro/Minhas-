import React, { useEffect } from 'react';
import {
  Check,
  Clock,
  Copy,
  Edit3,
  FastForward,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Category, Transaction } from '../types/finance';
import { formatBRL, formatShortDateBR } from '../utils/financeRules';
import { CategoryIconBadge } from './CategoryIconBadge';

interface TransactionActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  category?: Category;
  originLabel: string;
  hasFutureInstallments?: boolean;
  onEdit: (tx: Transaction) => void;
  onToggleStatus: (txId: string) => void;
  onDuplicate: (tx: Transaction) => void;
  onDelete: (txId: string, deleteGroup?: boolean) => void;
  onAnticipateInstallments?: (installmentGroupId: string) => void;
  onReverseAnticipation?: (targetIdOrGroupId: string) => void;
}

export const TransactionActionSheet: React.FC<TransactionActionSheetProps> = ({
  isOpen,
  onClose,
  transaction,
  category,
  originLabel,
  hasFutureInstallments = false,
  onEdit,
  onToggleStatus,
  onDuplicate,
  onDelete,
  onAnticipateInstallments,
  onReverseAnticipation,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const isPaid = transaction.status === 'paid';
  const isIncome = transaction.type === 'income';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
      aria-label={`Ações rápidas para ${transaction.description}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl animate-sheet-up sm:animate-modal-in modal-shell pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {/* Mobile Pull Handle */}
        <div className="mx-auto -mt-1 mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

        {/* Transaction Summary Card Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <CategoryIconBadge
              icon={category?.icon}
              color={category?.color}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white break-words sm:truncate">
                {transaction.description}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>{category?.name || 'Geral'}</span>
                <span aria-hidden="true"> · </span>
                <span>{originLabel}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums">{formatShortDateBR(transaction.date)}</span>
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div
              className={`font-mono tabular-nums text-base font-extrabold ${
                isIncome
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {isIncome ? '+' : '-'}
              {formatBRL(transaction.amount)}
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold mt-1 ${
                isPaid
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
              }`}
            >
              {isPaid ? 'Efetivado' : 'Pendente'}
            </span>
          </div>
        </div>

        {/* Big Touch Action Rows (Minimum 56px each for thumb ergonomics) */}
        <div className="space-y-2 pt-3">
          {/* Action 1: Alternar Situação / Estornar Fatura */}
          <button
            type="button"
            onClick={() => {
              onToggleStatus(transaction.id);
              onClose();
            }}
            className="w-full flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] transition-all"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                isPaid
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
              }`}
            >
              {isPaid ? <Clock className="h-5 w-5" /> : <Check className="h-5 w-5 stroke-[2.5]" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                {transaction.isInvoicePayment
                  ? 'Estornar Pagamento de Fatura (Refazer Cascata)'
                  : isPaid
                  ? 'Marcar como Pendente'
                  : 'Marcar como Efetivado (Pago/Recebido)'}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {transaction.isInvoicePayment
                  ? 'Devolve o saldo bancário e reabre todas as compras da fatura como pendentes'
                  : isPaid
                  ? 'Reverter lançamento para previsto no saldo'
                  : 'Confirmar débito/crédito na conta corrente'}
              </span>
            </div>
          </button>

          {/* Optional Action: Adiantar Parcelas Futuras */}
          {transaction.installmentGroupId &&
            hasFutureInstallments &&
            onAnticipateInstallments && (
              <button
                type="button"
                onClick={() => {
                  onAnticipateInstallments(transaction.installmentGroupId!);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 rounded-xl border border-violet-200 bg-violet-50/70 p-3.5 text-left hover:bg-violet-100/80 active:scale-[0.99] transition-all"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
                  <FastForward className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-violet-950">
                    Adiantar Parcelas Futuras desta Compra
                  </span>
                  <span className="block text-xs text-violet-700 mt-0.5">
                    Antecipar próximas parcelas para a fatura atual (com opção de desconto)
                  </span>
                </div>
              </button>
            )}

          {/* Optional Action: Desfazer Antecipação */}
          {transaction.isAnticipated && onReverseAnticipation && (
            <button
              type="button"
              onClick={() => {
                onReverseAnticipation(transaction.id);
                onClose();
              }}
              className="w-full flex items-center gap-3.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-left hover:bg-amber-100/80 active:scale-[0.99] transition-all"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-amber-950">
                  Desfazer Antecipação desta Parcela
                </span>
                <span className="block text-xs text-amber-800 mt-0.5">
                  Devolve a parcela para o mês de vencimento original ({transaction.originalCompetenceMonth})
                </span>
              </div>
            </button>
          )}

          {/* Action 2: Editar Lançamento */}
          <button
            type="button"
            onClick={() => {
              onEdit(transaction);
              onClose();
            }}
            className="w-full flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              <Edit3 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Editar Lançamento
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Alterar valor, categoria, conta, parcelas ou nota
              </span>
            </div>
          </button>

          {/* Action 3: Duplicar Lançamento */}
          <button
            type="button"
            onClick={() => {
              onDuplicate(transaction);
              onClose();
            }}
            className="w-full flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.99] transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
              <Copy className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Duplicar Lançamento
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Criar uma cópia rápida desta movimentação no mês
              </span>
            </div>
          </button>

          {/* Action 4: Excluir Lançamento */}
          <button
            type="button"
            onClick={() => {
              onDelete(transaction.id, Boolean(transaction.installmentGroupId));
              onClose();
            }}
            className="w-full flex items-center gap-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 p-3.5 text-left hover:bg-rose-100/70 dark:hover:bg-rose-950/50 active:scale-[0.99] transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-rose-700 dark:text-rose-400">
                {transaction.isInvoicePayment
                  ? 'Excluir Pagamento e Refazer Cascata da Fatura'
                  : 'Excluir Lançamento'}
              </span>
              <span className="block text-xs text-rose-600/80 dark:text-rose-400/70 mt-0.5">
                {transaction.isInvoicePayment
                  ? 'Remove a baixa bancária, recompõe o saldo e reabre as compras do cartão'
                  : transaction.installmentGroupId
                  ? 'Excluir esta parcela ou todas as parcelas do grupo'
                  : 'Remover permanentemente deste extrato'}
              </span>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

