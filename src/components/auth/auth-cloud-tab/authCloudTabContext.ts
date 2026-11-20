/** Tudo o que AuthAndCloudTab calcula, junto: é o que as partes da tela recebem. */
import type { AuthAndCloudTabPropsApi } from './authCloudTabConfig';
import type { AuthCloudStateApi } from './useAuthCloudState';
import type { AuthCloudHealthApi } from './useAuthCloudHealth';
import type { AuthCloudActionsApi } from './useAuthCloudActions';

export type AuthAndCloudTabContext = AuthAndCloudTabPropsApi &
  AuthCloudStateApi &
  AuthCloudHealthApi &
  AuthCloudActionsApi;
