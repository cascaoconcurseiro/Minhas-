/** Estado da tela: modo, campos, mensagens e situação da nuvem. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import { useEffect, useState } from 'react';
import type { AuthAndCloudTabPropsApi } from './authCloudTabConfig';

export function useAuthCloudState(ctx: AuthAndCloudTabPropsApi) {
  const {
    cloudSyncStatus,
    settings,
    userDisplayName,
    userEmail,
  } = ctx;
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [nameInput, setNameInput] = useState(userDisplayName || settings.userName || '');
  const [emailInput, setEmailInput] = useState(userEmail || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [pixInput, setPixInput] = useState(settings.userPixKey || '');
  const [authFeedback, setAuthFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time backend API health state
  const [apiHealth, setApiHealth] = useState<{
    status: 'checking' | 'ok' | 'error';
    neonStatus: 'checking' | 'configured' | 'error';
    authConfigured: boolean;
    geminiConfigured: boolean;
    checkedAt: string | null;
  }>({
    status: 'checking',
    neonStatus: 'checking',
    authConfigured: false,
    geminiConfigured: false,
    checkedAt: null,
  });
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);
  const cloudStatusTone = apiHealth.neonStatus === 'checking'
    ? 'checking'
    : apiHealth.neonStatus === 'error' || !apiHealth.authConfigured || apiHealth.status === 'error' || cloudSyncStatus === 'error'
    ? 'error'
    : cloudSyncStatus;

  useEffect(() => {
    setEmailInput(userEmail || '');
  }, [userEmail]);

  useEffect(() => {
    setNameInput(userDisplayName || settings.userName || '');
  }, [userDisplayName, settings.userName]);

  return {
    apiHealth,
    authFeedback,
    authMode,
    cloudStatusTone,
    emailInput,
    isSubmitting,
    nameInput,
    passwordInput,
    pixInput,
    repairFeedback,
    setApiHealth,
    setAuthFeedback,
    setAuthMode,
    setEmailInput,
    setIsSubmitting,
    setNameInput,
    setPasswordInput,
    setPixInput,
    setRepairFeedback,
  };
}

export type AuthCloudStateApi = ReturnType<typeof useAuthCloudState>;
