/** Tudo o que SettingsModal calcula, junto: é o que as partes da tela recebem. */
import type { SettingsModalPropsApi } from './settingsModalConfig';
import type { SettingsStateApi } from './useSettingsState';
import type { SettingsActionsApi } from './buildSettingsActions';

export type SettingsModalContext = SettingsModalPropsApi &
  SettingsStateApi &
  SettingsActionsApi;
