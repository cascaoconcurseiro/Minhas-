import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Edit3,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { Category, Transaction } from '../types/finance';
import {
  calculateDragOffset,
  resolveSnapOffset,
  SWIPE_THRESHOLDS,
} from '../utils/gestureRules';
import { formatBRL, formatShortDateBR } from '../utils/financeRules';
import { CategoryIconBadge } from './CategoryIconBadge';

interface SwipeableTransactionCardProps {
  transaction: Transaction;
  category?: Category;
  originLabel: string;
  originMarks?: React.ReactNode;
  installmentMeta?: string | null;
  onToggleStatus: (txId: string) => void;
  onEdit: (tx: Transaction) => void;
  onDuplicate?: (tx: Transaction) => void;
  onDelete: (txId: string, deleteGroup?: boolean) => void;
  onOpenActionSheet: (tx: Transaction) => void;
}

export const SwipeableTransactionCard: React.FC<SwipeableTransactionCardProps> = ({
  transaction,
  category,
  originLabel,
  originMarks,
  installmentMeta,
  onToggleStatus,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenActionSheet,
}) => {
  const [offset, setOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPressing, setIsPressing] = useState<boolean>(false);

  const startCoordRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);
  const initialOffsetRef = useRef<number>(0);
  const gestureDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredLongPressRef = useRef<boolean>(false);
  const dragDistanceRef = useRef<number>(0);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressing(false);
  }, []);

  const closeSwipe = useCallback(() => {
    setOffset(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, [clearLongPress]);

  // Touch and pointer handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    clearLongPress();
    hasTriggeredLongPressRef.current = false;
    dragDistanceRef.current = 0;
    startCoordRef.current = { x: clientX, y: clientY };
    startTimeRef.current = Date.now();
    initialOffsetRef.current = offset;
    gestureDirectionRef.current = null;
    setIsPressing(true);

    // Start 450ms press-and-hold timer
    longPressTimerRef.current = setTimeout(() => {
      hasTriggeredLongPressRef.current = true;
      setIsPressing(false);
      // Gentle haptic feedback on mobile if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(45);
        } catch {
          // ignore
        }
      }
      onOpenActionSheet(transaction);
      closeSwipe();
    }, 450);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!startCoordRef.current || hasTriggeredLongPressRef.current) return;

    const dx = clientX - startCoordRef.current.x;
    const dy = clientY - startCoordRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    dragDistanceRef.current = Math.max(dragDistanceRef.current, dist);

    // Cancel long press if finger moved beyond slop threshold (10px)
    if (dist > 10) {
      clearLongPress();
    }

    // Determine gesture direction if undecided
    if (!gestureDirectionRef.current && dist > 8) {
      if (Math.abs(dy) > Math.abs(dx) * 1.1) {
        gestureDirectionRef.current = 'vertical';
        return;
      }
      gestureDirectionRef.current = 'horizontal';
      setIsDragging(true);
    }

    if (gestureDirectionRef.current === 'horizontal') {
      const rawDelta = initialOffsetRef.current + dx;
      const damped = calculateDragOffset(rawDelta);
      setOffset(damped);
    }
  };

  const handlePointerEnd = () => {
    clearLongPress();

    if (hasTriggeredLongPressRef.current) {
      startCoordRef.current = null;
      setIsDragging(false);
      return;
    }

    if (gestureDirectionRef.current === 'horizontal') {
      const duration = Math.max(1, Date.now() - startTimeRef.current);
      const dx = offset - initialOffsetRef.current;
      const velocityX = (dx / duration) * 1000;

      const snap = resolveSnapOffset(offset, velocityX);
      setOffset(snap.targetOffset);

      if (snap.autoTriggerRight) {
        // Direct right swipe completed: toggle status and close
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate?.(35);
          } catch {
            // ignore
          }
        }
        onToggleStatus(transaction.id);
        setTimeout(() => {
          setOffset(0);
        }, 300);
      }
    }

    startCoordRef.current = null;
    gestureDirectionRef.current = null;
    setIsDragging(false);
  };

  const isPaid = transaction.status === 'paid';
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const catName = isTransfer
    ? 'Transferência'
    : transaction.isInvoicePayment
    ? 'Fatura Paga'
    : category?.name || 'Geral';

  return (
    <div className="relative overflow-hidden select-none touch-pan-y group">
      {/* LEFT TRAY (Revealed when swiping RIGHT: Toggle Paid/Pending Status) */}
      <div
        className="absolute inset-y-0 left-0 flex items-stretch z-0"
        style={{ width: `${SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT}px` }}
      >
        <button
          type="button"
          onClick={() => {
            onToggleStatus(transaction.id);
            closeSwipe();
          }}
          className={`w-full flex flex-col items-center justify-center gap-1.5 font-semibold text-white px-3 transition-colors active:brightness-90 ${
            isPaid
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
          aria-label={isPaid ? 'Marcar como Pendente' : 'Marcar como Efetivado'}
        >
          {isPaid ? (
            <Clock className="h-5 w-5 stroke-[2.5]" />
          ) : (
            <Check className="h-5 w-5 stroke-[2.5]" />
          )}
          <span className="text-[11px] leading-tight font-medium">
            {isPaid ? 'Pendente' : 'Efetivar'}
          </span>
        </button>
      </div>

      {/* RIGHT TRAY (Revealed when swiping LEFT: Edit, Duplicate, Delete) */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch z-0"
        style={{ width: `${SWIPE_THRESHOLDS.ACTIONS_WIDTH_LEFT}px` }}
      >
        {/* Button 1: Editar */}
        <button
          type="button"
          onClick={() => {
            closeSwipe();
            onEdit(transaction);
          }}
          className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-medium active:brightness-90 transition-colors"
          aria-label={`Editar ${transaction.description}`}
        >
          <Edit3 className="h-5 w-5" />
          <span className="text-[11px] leading-tight">Editar</span>
        </button>

        {/* Button 2: Duplicar */}
        {onDuplicate && (
          <button
            type="button"
            onClick={() => {
              closeSwipe();
              onDuplicate(transaction);
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-medium active:brightness-90 transition-colors"
            aria-label={`Duplicar ${transaction.description}`}
          >
            <Copy className="h-5 w-5" />
            <span className="text-[11px] leading-tight">Duplicar</span>
          </button>
        )}

        {/* Button 3: Excluir */}
        <button
          type="button"
          onClick={() => {
            closeSwipe();
            onDelete(transaction.id, Boolean(transaction.installmentGroupId));
          }}
          className="flex-1 flex flex-col items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium active:brightness-90 transition-colors"
          aria-label={`Excluir ${transaction.description}`}
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[11px] leading-tight">Excluir</span>
        </button>
      </div>

      {/* FOREGROUND CARD SURFACE */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          handlePointerDown(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (startCoordRef.current) {
            handlePointerMove(e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          handlePointerEnd();
        }}
        onPointerCancel={(e) => {
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          handlePointerEnd();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          clearLongPress();
          onOpenActionSheet(transaction);
        }}
        onClick={(e) => {
          if (offset !== 0) {
            e.stopPropagation();
            closeSwipe();
            return;
          }
          if (dragDistanceRef.current > 12) {
            e.stopPropagation();
            return;
          }
          if (!hasTriggeredLongPressRef.current) {
            onOpenActionSheet(transaction);
          }
        }}
        className={`relative z-10 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors cursor-pointer select-none ${
          isPressing
            ? 'bg-slate-100 dark:bg-slate-800 scale-[0.995]'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <CategoryIconBadge
              icon={category?.icon}
              color={category?.color}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 break-words">
                  {transaction.description}
                </h4>
                {installmentMeta && (
                  <span className="shrink-0 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400">
                    {installmentMeta}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {catName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  {originMarks}
                  <span className="break-words max-w-[220px]">{originLabel}</span>
                </span>
              </div>
              {transaction.tags && transaction.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {transaction.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300"
                    >
                      <span className="font-mono text-emerald-600">#</span>
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div
              className={`font-mono tabular-nums font-bold text-sm ${
                isIncome
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : isTransfer
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {isIncome ? '+' : transaction.type === 'expense' ? '-' : ''}
              {formatBRL(transaction.amount)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {formatShortDateBR(transaction.date)}
            </div>
          </div>
        </div>

        {/* Footer row: status badge + swipe hint / quick menu trigger */}
        <div className="mt-2.5 flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(transaction.id);
              }}
              className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isPaid
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
              }`}
            >
              {isPaid ? (
                <Check className="h-3 w-3 stroke-[2.5]" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {isPaid ? 'Efetivado' : 'Pendente'}
            </button>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden xs:inline">
              ← Deslize ou segure
            </span>
          </div>

          {/* Quick 3-dots button for one-touch action sheet access */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenActionSheet(transaction);
            }}
            aria-label={`Menu de opções para ${transaction.description}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
