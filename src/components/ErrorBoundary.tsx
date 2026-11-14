import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Muda quando a pessoa troca de tela: limpa o erro e tenta desenhar de novo. */
  resetKey?: string;
  /** 'tela' mostra o aviso dentro da página; 'janela' fecha a janela que quebrou; 'app' cobre tudo. */
  scope?: 'tela' | 'janela' | 'app';
  onError?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Se uma tela ou janela der erro ao desenhar, mostra um aviso com saída em vez de deixar o app em branco.
 * Os dados não são afetados: ficam guardados e sincronizados como antes.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Erro ao desenhar a tela:', error instanceof Error ? error.message : String(error));
    this.props.onError?.();
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.scope === 'janela') return null;
    return (
      <div
        role="alert"
        className={`${this.props.scope === 'app' ? 'min-h-screen' : 'min-h-[40vh]'} grid place-items-center p-6 text-center`}
      >
        <div className="max-w-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Não foi possível abrir esta tela</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Seus dados estão seguros. Tente de novo ou recarregue o app.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
