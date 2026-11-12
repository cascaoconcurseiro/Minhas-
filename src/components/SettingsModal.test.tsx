import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { AppSettings } from '../types/finance';
import type { Category } from '../types/finance';
import { parseFullFinanceBackup } from '../utils/fullBackup';
import { DEFAULT_REMINDER_SETTINGS } from '../utils/reminderRules';
import { SettingsModal } from './SettingsModal';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalConfirm: typeof window.confirm;
let originalFileReader: typeof globalThis.FileReader;

const settings: AppSettings = {
  theme: 'light',
  density: 'comfortable',
  privacyMode: false,
  showOverviewAlerts: true,
  alertsExpandedByDefault: false,
  budgetWarningPercent: 80,
  userName: 'Conta sintética',
  userPixKey: '',
};

function renderSettings(onExport: () => void, onImport: (jsonText: string) => boolean | Promise<boolean>, options: {
  initialTab?: 'appearance' | 'categories' | 'rules' | 'reminders' | 'profile';
  settings?: AppSettings;
  onClose?: () => void;
  onSignOut?: () => Promise<void>;
  onUpdateSettings?: (partial: Partial<AppSettings>) => void;
  categories?: Category[];
  onAddCategory?: (category: Omit<Category, 'id'>) => void;
  onUpdateCategoryBudget?: (id: string, budget: number) => void;
  onDeleteCategory?: (id: string) => void;
  onResetWorkspaceData?: () => void;
} = {}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(SettingsModal, {
        isOpen: true,
        onClose: options.onClose ?? (() => {}),
        settings: options.settings ?? settings,
        initialTab: options.initialTab ?? 'profile',
        isUserLoggedIn: true,
        userEmail: 'synthetic@example.test',
        onUpdateSettings: options.onUpdateSettings ?? (() => {}),
        categories: options.categories ?? [],
        onAddCategory: options.onAddCategory,
        onUpdateCategoryBudget: options.onUpdateCategoryBudget,
        onDeleteCategory: options.onDeleteCategory,
        onExportFullBackupJson: onExport,
        onImportFullBackupJson: onImport,
        onResetWorkspaceData: options.onResetWorkspaceData ?? (() => {}),
        onSignOut: options.onSignOut,
      })
    );
  });
  return container;
}

function uploadJsonFile(page: HTMLElement, contents: string) {
  const fileInput = page.querySelector<HTMLInputElement>('input[type="file"][accept*="application/json"]');
  assert.ok(fileInput, 'deve existir input de importação JSON');
  const file = new File([contents], 'backup-sintetico.json', { type: 'application/json' });
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [file],
  });
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  return fileInput;
}

class SyntheticFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => unknown) | null = null;

  readAsText(file: Blob) {
    void file.text().then((text) => {
      this.result = text;
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    });
  }
}

beforeEach(() => {
  originalConfirm = window.confirm;
  originalFileReader = globalThis.FileReader;
  globalThis.FileReader = SyntheticFileReader as unknown as typeof FileReader;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  window.confirm = originalConfirm;
  globalThis.FileReader = originalFileReader;
});

test('SettingsModal exports the workspace backup through its callback', async () => {
  let exportCount = 0;
  const page = renderSettings(() => { exportCount += 1; }, () => true);
  const exportButton = Array.from(page.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Baixar backup do workspace (.JSON)')
  );
  assert.ok(exportButton);

  await act(async () => { exportButton.click(); });
  assert.equal(exportCount, 1);
});

test('SettingsModal lets keyboard users focus restore and close with Escape without importing a file', () => {
  let closeCount = 0;
  let importCount = 0;
  const page = renderSettings(() => {}, () => {
    importCount += 1;
    return true;
  }, { onClose: () => { closeCount += 1; } });
  const restoreButton = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Restaurar de Arquivo .JSON'));
  assert.ok(restoreButton);

  restoreButton.focus();
  assert.equal(document.activeElement, restoreButton, 'a ação de restore é alcançável por teclado');
  restoreButton.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true,
  }));

  assert.equal(closeCount, 1, 'Escape fecha a janela de configurações');
  assert.equal(importCount, 0, 'fechar a janela não inicia uma restauração');
});

test('SettingsModal profile fields have labels and remain keyboard-focusable', () => {
  const page = renderSettings(() => {}, () => true);
  for (const id of ['settings-profile-name', 'settings-profile-pix']) {
    const field: HTMLElement | null = page.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected #${id}`);
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === field));
    field.focus();
    assert.equal(document.activeElement, field);
  }
});

test('SettingsModal signs out through its callback and closes only after it resolves', async () => {
  let signOutCalls = 0;
  let closeCalls = 0;
  const page = renderSettings(() => {}, () => true, {
    onSignOut: async () => { signOutCalls += 1; },
    onClose: () => { closeCalls += 1; },
  });
  const signOut = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Sair da Conta'));
  assert.ok(signOut);
  await act(async () => { signOut.click(); await Promise.resolve(); });
  assert.equal(signOutCalls, 1);
  assert.equal(closeCalls, 1);
});

test('SettingsModal confirms restore, forwards synthetic JSON, and reports success', async () => {
  const syntheticBackup = JSON.stringify({
    version: 6,
    ownerUserId: 'synthetic-neon-user',
    exportedAt: '2026-11-07T00:00:00.000Z',
    accounts: [],
    cards: [],
    categories: [{
      id: 'synthetic-category',
      name: 'Alimentação',
      type: 'expense',
      bucket: 'essential',
      monthlyBudget: 100,
      color: '#059669',
      icon: 'shopping-cart',
    }],
    transactions: [],
    goals: [],
    investments: [],
    trips: [],
    familyMembers: [],
    investmentTargets: {},
    settings: {},
  });
  let importedText = '';
  let importedOwnerId: string | undefined;
  let confirmationMessage = '';
  window.confirm = (message?: string) => {
    confirmationMessage = message ?? '';
    return true;
  };
  const page = renderSettings(() => {}, (jsonText) => {
    importedText = jsonText;
    importedOwnerId = parseFullFinanceBackup(jsonText)?.ownerUserId;
    return importedOwnerId === 'synthetic-neon-user';
  });

  await act(async () => {
    const fileInput = uploadJsonFile(page, syntheticBackup);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(fileInput.value, '', 'o input é limpo após ler o arquivo');
  });

  assert.match(confirmationMessage, /substituirá os dados atuais do workspace/);
  assert.equal(importedText, syntheticBackup);
  assert.equal(importedOwnerId, 'synthetic-neon-user');
  assert.match(page.textContent ?? '', /Backup restaurado na sessão/);
});

test('SettingsModal reports rejected JSON and does not claim restoration succeeded', async () => {
  let confirmationCount = 0;
  window.confirm = () => { confirmationCount += 1; return true; };
  let importCount = 0;
  const page = renderSettings(() => {}, () => {
    importCount += 1;
    return false;
  });

  await act(async () => {
    uploadJsonFile(page, '{invalid-json');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(importCount, 0);
  assert.equal(confirmationCount, 0, 'JSON inválido é rejeitado antes da confirmação');
  assert.match(page.textContent ?? '', /Arquivo JSON inválido ou fora do padrão/);
  assert.doesNotMatch(page.textContent ?? '', /Backup carregado na sessão/);
});

test('SettingsModal rejects an unsupported backup version before confirmation or restore', async () => {
  let confirmationCount = 0;
  let importCount = 0;
  window.confirm = () => { confirmationCount += 1; return true; };
  const page = renderSettings(() => {}, () => {
    importCount += 1;
    return true;
  });

  await act(async () => {
    uploadJsonFile(page, JSON.stringify({
      version: 7,
      ownerUserId: 'synthetic-neon-user',
      accounts: [], cards: [], categories: [], transactions: [], goals: [], investments: [], trips: [],
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(confirmationCount, 0, 'um backup de versão desconhecida não chega à confirmação destrutiva');
  assert.equal(importCount, 0, 'o callback de restauração não é chamado');
  assert.match(page.textContent ?? '', /Arquivo JSON inválido ou fora do padrão/);
  assert.doesNotMatch(page.textContent ?? '', /Backup restaurado na sessão/);
});

test('SettingsModal waits for asynchronous restore callback before reporting success', async () => {
  const syntheticBackup = JSON.stringify({
    version: 6,
    ownerUserId: 'synthetic-neon-user',
    accounts: [], cards: [], categories: [{
      id: 'synthetic-category', name: 'Teste', type: 'expense', bucket: 'essential',
      monthlyBudget: 0, color: '#059669', icon: 'shopping-cart',
    }], transactions: [], goals: [], investments: [], trips: [],
  });
  window.confirm = (message?: string) => {
    assert.match(message ?? '', /Prévia do backup.*Contas: 0/);
    return true;
  };
  let finishRestore!: (result: boolean) => void;
  const page = renderSettings(() => {}, () => new Promise<boolean>((resolve) => { finishRestore = resolve; }));

  await act(async () => {
    uploadJsonFile(page, syntheticBackup);
    for (let attempt = 0; attempt < 10 && !finishRestore; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  assert.doesNotMatch(page.textContent ?? '', /Backup restaurado na sessão/);

  await act(async () => { finishRestore(true); await Promise.resolve(); });
  assert.match(page.textContent ?? '', /Backup restaurado na sessão/);
});

test('SettingsModal treats a rejected restore callback as failure', async () => {
  const syntheticBackup = JSON.stringify({
    version: 6,
    ownerUserId: 'synthetic-neon-user',
    accounts: [], cards: [], categories: [{
      id: 'synthetic-category', name: 'Teste', type: 'expense', bucket: 'essential',
      monthlyBudget: 0, color: '#059669', icon: 'shopping-cart',
    }], transactions: [], goals: [], investments: [], trips: [],
  });
  window.confirm = () => true;
  const page = renderSettings(() => {}, async () => { throw new Error('synthetic restore failure'); });

  await act(async () => {
    uploadJsonFile(page, syntheticBackup);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.match(page.textContent ?? '', /Não foi possível ler ou restaurar/);
  assert.doesNotMatch(page.textContent ?? '', /Backup restaurado na sessão/);
});

test('SettingsModal does not invoke restore when the user cancels confirmation', async () => {
  window.confirm = () => false;
  let importCount = 0;
  const page = renderSettings(() => {}, () => {
    importCount += 1;
    return true;
  });

  await act(async () => {
    uploadJsonFile(page, '{"synthetic":true}');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(importCount, 0);
  assert.doesNotMatch(page.textContent ?? '', /Backup carregado na sessão/);
});

test('SettingsModal preference controls route theme, privacy and density changes', async () => {
  const changes: Partial<AppSettings>[] = [];
  const page = renderSettings(() => {}, () => true, {
    initialTab: 'appearance', onUpdateSettings: (change) => changes.push(change),
  });
  const clickText = async (text: string) => {
    const button = [...page.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(text));
    assert.ok(button, `button containing ${text}`);
    await act(async () => { button.click(); });
  };
  await clickText('Modo Escuro Noturno');
  const privacy = page.querySelector<HTMLButtonElement>('[role="switch"]');
  assert.ok(privacy);
  await act(async () => { privacy.click(); });
  await clickText('Compacta');
  assert.deepEqual(changes, [{ theme: 'dark' }, { privacyMode: true }, { density: 'compact' }]);
});

test('SettingsModal category creation, budget edit and delete call domain callbacks, with no subcategory controls', async () => {
  const category: Category = {
    id: 'cat-synthetic', name: 'Categoria teste', type: 'expense', bucket: 'essential',
    monthlyBudget: 100, color: '#059669', icon: 'shopping-cart',
  };
  const added: Array<Omit<Category, 'id'>> = [];
  const budgets: Array<[string, number]> = [];
  const deleted: string[] = [];
  const page = renderSettings(() => {}, () => true, {
    initialTab: 'categories', categories: [category, ...['a', 'b', 'c'].map((suffix) => ({
      ...category, id: `cat-${suffix}`, name: `Categoria ${suffix}`,
    }))],
    onAddCategory: (value) => added.push(value),
    onUpdateCategoryBudget: (id, amount) => budgets.push([id, amount]),
    onDeleteCategory: (id) => deleted.push(id),
  });
  const inputs = [...page.querySelectorAll<HTMLInputElement>('input')];
  const name = inputs.find((input) => input.placeholder?.startsWith('Ex: Educação'));
  assert.ok(name);
  const set = (el: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const form = name.closest('form');
  assert.ok(form);
  await act(async () => {
    set(name, ' Categoria nova ');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(added[0]?.name, 'Categoria nova');
  assert.equal(added[0]?.type, 'expense');

  assert.equal(page.querySelector('input[placeholder="Nova subcategoria..."]'), null, 'não existe campo de subcategoria');
  assert.doesNotMatch(page.textContent ?? '', /[Ss]ubcategoria/);

  const budgetButton = [...page.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('(Editar)'));
  assert.ok(budgetButton);
  await act(async () => { budgetButton.click(); });
  const budgetInput = [...page.querySelectorAll<HTMLInputElement>('input')].find((input) => input.value === '1,00');
  assert.ok(budgetInput);
  await act(async () => {
    set(budgetInput, '25000');
    const save = [...page.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === 'Salvar');
    assert.ok(save); save.click();
  });
  assert.deepEqual(budgets, [[category.id, 250]]);
  await act(async () => { page.querySelector<HTMLButtonElement>('[title="Excluir categoria"]')?.click(); });
  assert.deepEqual(deleted, [category.id]);
});

test('SettingsModal personal reset can be canceled and confirmed', async () => {
  let resets = 0;
  const page = renderSettings(() => {}, () => true, { onResetWorkspaceData: () => { resets += 1; } });
  const open = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Apagar dados do workspace pessoal'));
  assert.ok(open);
  await act(async () => { open.click(); });
  const cancel = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar');
  assert.ok(cancel);
  await act(async () => { cancel.click(); });
  assert.equal(resets, 0);
  const reopen = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Apagar dados do workspace pessoal'));
  assert.ok(reopen);
  await act(async () => { reopen.click(); });
  const confirm = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Sim, apagar dados pessoais'));
  assert.ok(confirm);
  await act(async () => { confirm.click(); });
  assert.equal(resets, 1);
});

test('SettingsModal rules, reminder and profile edits call the settings callback with the expected fields', async () => {
  const changes: Partial<AppSettings>[] = [];
  const page = renderSettings(() => {}, () => true, {
    initialTab: 'rules', onUpdateSettings: (change) => changes.push(change),
  });
  const rulesTab = page.querySelector<HTMLButtonElement>('[data-testid="settings-tab-rules"]');
  assert.ok(rulesTab);
  const alertSwitch = [...page.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((button) => button.getAttribute('aria-checked') === 'true');
  assert.ok(alertSwitch);
  await act(async () => { alertSwitch.click(); });
  const pct = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === '90%');
  assert.ok(pct);
  await act(async () => { pct.click(); });
  assert.deepEqual(changes.slice(0, 2), [{ showOverviewAlerts: false }, { budgetWarningPercent: 90 }]);

  const remindersTab = page.querySelector<HTMLButtonElement>('[data-testid="settings-tab-reminders"]');
  assert.ok(remindersTab);
  await act(async () => { remindersTab.click(); });
  const timeSelect = [...page.querySelectorAll<HTMLSelectElement>('select')].find((select) =>
    Array.from(select.options).some((option) => option.value === '09:00')
  );
  assert.ok(timeSelect);
  await act(async () => {
    timeSelect.value = '18:00';
    timeSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(changes.at(-1)?.reminders?.preferredTime, '18:00');

  const profileTab = page.querySelector<HTMLButtonElement>('[data-testid="settings-tab-account"]');
  assert.ok(profileTab);
  await act(async () => { profileTab.click(); });
  const profileName = page.querySelector<HTMLInputElement>('#settings-profile-name');
  const profilePix = page.querySelector<HTMLInputElement>('#settings-profile-pix');
  assert.ok(profileName && profilePix);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(profileName, 'Nome atualizado');
  profileName.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(changes.at(-1)?.userName, 'Nome atualizado');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(profilePix, 'pix-sintetico');
  profilePix.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(changes.at(-1)?.userPixKey, 'pix-sintetico');
});

test('SettingsModal email and SMTP fields update locally through callbacks without sending messages', async () => {
  const changes: Partial<AppSettings>[] = [];
  const configured = {
    ...settings,
    reminders: {
      ...DEFAULT_REMINDER_SETTINGS,
      enabled: false, preferredTime: '09:00', browserEnabled: false,
      emailNotificationsEnabled: false, notificationEmail: 'synthetic@example.test', emailTime: '08:00',
      emailRecurrence: 'daily' as const, smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpSecure: false,
    },
  } as AppSettings;
  const page = renderSettings(() => {}, () => true, {
    initialTab: 'reminders', settings: configured, onUpdateSettings: (change) => changes.push(change),
  });
  const set = (field: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const email = page.querySelector<HTMLInputElement>('#settings-reminder-email');
  const host = page.querySelector<HTMLInputElement>('#settings-smtp-host');
  const port = page.querySelector<HTMLInputElement>('#settings-smtp-port');
  const user = page.querySelector<HTMLInputElement>('#settings-smtp-user');
  const pass = page.querySelector<HTMLInputElement>('#settings-smtp-pass');
  assert.ok(email && host && port && user && pass);
  const reminderSwitches = [...page.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
  assert.equal(reminderSwitches.length, 2, 'há controles independentes para lembretes automáticos e boletim por e-mail');
  await act(async () => { reminderSwitches.forEach((toggle) => toggle.click()); });
  assert.ok(changes.some((change) => change.reminders?.enabled === true));
  assert.ok(changes.some((change) => change.reminders?.emailNotificationsEnabled === true));
  const recurrence = page.querySelector<HTMLSelectElement>('#settings-email-recurrence');
  const emailTime = page.querySelector<HTMLSelectElement>('#settings-reminder-email-time');
  assert.ok(recurrence && emailTime);
  await act(async () => {
    set(email, 'novo@example.test'); set(host, 'smtp.example.test'); set(port, '465');
    set(user, 'smtp-user'); set(pass, 'synthetic-secret');
    recurrence.value = 'weekly'; recurrence.dispatchEvent(new window.Event('change', { bubbles: true }));
    emailTime.value = '18:00'; emailTime.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.ok(changes.some((change) => change.reminders?.notificationEmail === 'novo@example.test'));
  assert.ok(changes.some((change) => change.reminders?.smtpHost === 'smtp.example.test'));
  assert.ok(changes.some((change) => change.reminders?.smtpPort === 465 && change.reminders?.smtpConfig?.secure === true));
  assert.ok(changes.some((change) => change.reminders?.smtpUser === 'smtp-user'));
  assert.ok(changes.some((change) => change.reminders?.smtpPass === 'synthetic-secret'));
  assert.ok(changes.some((change) => change.reminders?.emailRecurrence === 'weekly'));
  assert.ok(changes.some((change) => change.reminders?.emailPreferredTime === '18:00'));
  const reveal = page.querySelector<HTMLButtonElement>('[aria-label="Mostrar senha SMTP"]');
  assert.ok(reveal);
  await act(async () => { reveal.click(); });
  assert.equal(page.querySelector<HTMLInputElement>('#settings-smtp-pass')?.type, 'text');
  assert.equal(changes.length, 9, 'configurar lembretes/SMTP apenas atualiza callback, sem enviar e-mail');
});
