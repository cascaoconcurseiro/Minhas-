import React from 'react';
import { resolveSettingsModalProps } from './settings-modal/settingsModalConfig';
import type { SettingsModalProps } from './settings-modal/settingsModalConfig';
import { useSettingsState } from './settings-modal/useSettingsState';
import { buildSettingsActions } from './settings-modal/buildSettingsActions';
import type { SettingsModalContext } from './settings-modal/settingsModalContext';

import { SettingsAppearanceTab } from './settings-modal/SettingsAppearanceTab';
import { SettingsCategoriesTab } from './settings-modal/SettingsCategoriesTab';
import { SettingsFooter } from './settings-modal/SettingsFooter';
import { SettingsHeader } from './settings-modal/SettingsHeader';
import { SettingsProfileTab } from './settings-modal/SettingsProfileTab';
import { SettingsRemindersTab } from './settings-modal/SettingsRemindersTab';
import { SettingsRulesTab } from './settings-modal/SettingsRulesTab';
import { SettingsTabs } from './settings-modal/SettingsTabs';

export type { SettingsModalProps };

/**
 * Configurações: conta e nuvem, lembretes, categorias, backup e aparência.
 * A lógica fica em settings-modal/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const ctx0 = resolveSettingsModalProps(props);
  const ctx1 = { ...ctx0, ...useSettingsState(ctx0) };
  const { isOpen } = ctx1;
  if (!isOpen) return null;
  const ctxF1 = { ...ctx1, ...buildSettingsActions(ctx1) };
  const form: SettingsModalContext = ctxF1;
  const {

  } = form;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-settings-title"
    >
      <div className="w-full max-w-4xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
        {/* Mobile Pull Indicator */}
        <div className="mx-auto mt-2 -mb-1 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        {/* Header */}
        <SettingsHeader form={form} />

        {/* 4-Tab Navigation Grid — ZERO Horizontal Scrollbar (2x2 on mobile, 4 cols on tablet/desktop) */}
        <SettingsTabs form={form} />

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y modal-form-scroll custom-scrollbar p-5 sm:p-6 space-y-6">
          {/* TAB 1: APPEARANCE & INTERFACE */}
          <SettingsAppearanceTab form={form} />

          {/* TAB 2: CATEGORIES, SUBCATEGORIES & BUDGET CEILINGS */}
          <SettingsCategoriesTab form={form} />

          {/* TAB 3: FINANCIAL RULES, CASCADE & ALERTS */}
          <SettingsRulesTab form={form} />

          {/* TAB 4: DAILY REMINDERS & SCHEDULED NOTIFICATIONS */}
          <SettingsRemindersTab form={form} />

          {/* TAB 5: PROFILE & JSON BACKUP */}
          <SettingsProfileTab form={form} />
        </div>

        {/* Footer */}
        <SettingsFooter form={form} />
      </div>
    </div>
  );
};
