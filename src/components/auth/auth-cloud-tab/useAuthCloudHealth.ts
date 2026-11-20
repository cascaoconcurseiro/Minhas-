/** Verificação de saúde do servidor e dados auditados. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import { summarizeBackendHealth } from '../../../utils/backendHealth';
import { useEffect, useMemo } from 'react';
import { runFinancialIntegrityAudit } from '../../../domain/trips/travelRules';
import type { AuthAndCloudTabPropsApi } from './authCloudTabConfig';
import type { AuthCloudStateApi } from './useAuthCloudState';

export function useAuthCloudHealth(ctx: AuthAndCloudTabPropsApi & AuthCloudStateApi) {
  const {
    accounts,
    cards,
    categories,
    goals,
    investments,
    isAnonymousUser,
    setApiHealth,
    transactions,
    trips,
    userEmail,
  } = ctx;
  const checkBackendHealth = async (): Promise<boolean> => {
    setApiHealth((prev) => ({ ...prev, status: 'checking', neonStatus: 'checking' }));
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const summary = summarizeBackendHealth(res.ok, data);
      setApiHealth({
        ...summary,
        checkedAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
      return summary.status === 'ok';
    } catch {
      setApiHealth({
        status: 'error',
        neonStatus: 'error',
        authConfigured: false,
        geminiConfigured: false,
        checkedAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
      return false;
    }
  };

  useEffect(() => {
    void checkBackendHealth();
  }, []);

  const isNamedAccountLoggedIn = Boolean(userEmail && !isAnonymousUser);

  const auditReport = useMemo(
    () =>
      runFinancialIntegrityAudit({
        accountsCount: accounts.length,
        cardsCount: cards.length,
        accounts,
        cards,
        categories,
        transactions,
        investments,
        goals,
        trips,
      }),
    [accounts, cards, categories, transactions, investments, goals, trips]
  );

  return {
    auditReport,
    checkBackendHealth,
    isNamedAccountLoggedIn,
  };
}

export type AuthCloudHealthApi = ReturnType<typeof useAuthCloudHealth>;
