/** Tipos, auxiliares e props de GoalsAndSimulatorTab. */
import { BankAccount, InvestmentAsset, SavingsGoal } from '../../../types/finance';

export interface GoalsAndSimulatorTabProps {
  goals: SavingsGoal[];
  investments?: InvestmentAsset[];
  accounts?: BankAccount[];
  /** Leva ao cadastro de conta quando falta uma conta em reais. */
  onRequestCreateAccount?: () => void;
  onContributeGoal: (
    goalId: string,
    amount: number,
    debitAccountId?: string,
    contributionDate?: string
  ) => void;
  onAddGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  onUpdateGoal: (goal: SavingsGoal) => void;
  onDeleteGoal: (goalId: string) => void;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveGoalsAndSimulatorTabProps({
  goals,
  investments = [],
  accounts = [],
  onRequestCreateAccount,
  onContributeGoal,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}: GoalsAndSimulatorTabProps) {
  return {
    goals,
    onRequestCreateAccount,
    onContributeGoal,
    onAddGoal,
    onUpdateGoal,
    onDeleteGoal,
    investments,
    accounts,
  };
}

export type GoalsAndSimulatorTabPropsApi = ReturnType<typeof resolveGoalsAndSimulatorTabProps>;
