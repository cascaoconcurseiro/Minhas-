/** Tipos e props de SettingsModal. */
import { AppSettings, Category, FamilyMember } from '../../../types/finance';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  initialTab?: 'appearance' | 'categories' | 'rules' | 'reminders' | 'profile';
  categories?: Category[];
  familyMembers?: FamilyMember[];
  userEmail?: string | null;
  isUserLoggedIn?: boolean;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onAddCategory?: (newCat: Omit<Category, 'id'>) => void;
  onUpdateCategoryBudget?: (catId: string, newBudget: number) => void;
  onDeleteCategory?: (catId: string) => void;
  onOpenCloudTab?: () => void;
  onSignOut?: () => Promise<void>;
  onExportFullBackupJson: () => void;
  onImportFullBackupJson: (jsonText: string) => boolean | Promise<boolean>;
  onResetWorkspaceData: () => void;
}

/** Aplica os valores padrão das props (mesmos de antes) e devolve tudo num objeto. */
export function resolveSettingsModalProps({
  isOpen,
  onClose,
  settings,
  initialTab = 'appearance',
  categories = [],
  familyMembers = [],
  userEmail,
  isUserLoggedIn = false,
  onUpdateSettings,
  onAddCategory,
  onUpdateCategoryBudget,
  onDeleteCategory,
  onOpenCloudTab,
  onSignOut,
  onExportFullBackupJson,
  onImportFullBackupJson,
  onResetWorkspaceData,
}: SettingsModalProps) {
  return {
    isOpen,
    onClose,
    settings,
    userEmail,
    onUpdateSettings,
    onAddCategory,
    onUpdateCategoryBudget,
    onDeleteCategory,
    onOpenCloudTab,
    onSignOut,
    onExportFullBackupJson,
    onImportFullBackupJson,
    onResetWorkspaceData,
    initialTab,
    categories,
    familyMembers,
    isUserLoggedIn,
  };
}

export type SettingsModalPropsApi = ReturnType<typeof resolveSettingsModalProps>;
