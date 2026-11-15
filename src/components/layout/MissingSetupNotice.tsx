import React from 'react';

/** Aviso padrão "falta cadastrar algo" com botão que leva direto ao cadastro. */
export const MissingSetupNotice: React.FC<{
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}> = ({ message, actionLabel = 'Cadastrar conta', onAction, testId = 'missing-setup-notice' }) => (
  <div
    role="alert"
    data-testid={testId}
    className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <p className="text-xs font-semibold text-amber-900">{message}</p>
    {onAction && (
      <button
        type="button"
        data-testid="missing-setup-notice-action"
        onClick={onAction}
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
