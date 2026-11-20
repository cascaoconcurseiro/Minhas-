/** Ações: varredura, entrar/criar conta, sair e salvar perfil. Parte de AuthAndCloudTab (ver AuthAndCloudTab.tsx). */
import React from 'react';
import { getAuthErrorMessage } from '../../../lib/authClient';
import type { AuthAndCloudTabPropsApi } from './authCloudTabConfig';
import type { AuthCloudStateApi } from './useAuthCloudState';
import type { AuthCloudHealthApi } from './useAuthCloudHealth';

export function useAuthCloudActions(ctx: AuthAndCloudTabPropsApi & AuthCloudStateApi & AuthCloudHealthApi) {
  const {
    authMode,
    checkBackendHealth,
    emailInput,
    nameInput,
    onForceCloudSync,
    onRegisterEmail,
    onRunDiagnosticAndRepair,
    onSignInEmail,
    onSignOut,
    onUpdateSettings,
    passwordInput,
    pixInput,
    setAuthFeedback,
    setIsSubmitting,
    setPasswordInput,
    setRepairFeedback,
    settings,
  } = ctx;
  const handleRunFullScanAndRepair = async () => {
    setRepairFeedback(null);
    const backendHealthy = await checkBackendHealth();
    let repairedCount = 0;
    let repairedLog: string[] = [];
    if (onRunDiagnosticAndRepair) {
      const result = onRunDiagnosticAndRepair();
      repairedCount = result.repairedCount;
      repairedLog = result.repairedLog;
    }
    await onForceCloudSync();
    const localResult = repairedCount > 0
      ? `${repairedCount} inconsistência(s) local(is) corrigida(s): ${repairedLog.join(' ')}`
      : 'Nenhuma inconsistência local encontrada.';
    setRepairFeedback(
      backendHealthy
        ? `Auditoria local concluída. ${localResult} A API e a configuração do Neon estão disponíveis; confira abaixo o estado da última sincronização do workspace.`
        : `Auditoria local concluída. ${localResult} A configuração da API ou do Neon está incompleta; os dados locais foram preservados e a sincronização pode estar pendente.`
    );
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    if (!emailInput.trim() || passwordInput.length < 6) {
      setAuthFeedback({
        type: 'error',
        message: 'Informe um e-mail válido e uma senha com pelo menos 6 caracteres.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await onSignInEmail(emailInput.trim(), passwordInput);
        setAuthFeedback({
          type: 'success',
          message: `Sessão iniciada como ${emailInput.trim()}. O workspace será carregado do Neon.`,
        });
      } else {
        const cleanName = nameInput.trim() || emailInput.split('@')[0];
        await onRegisterEmail(cleanName, emailInput.trim(), passwordInput);
        onUpdateSettings({ userName: cleanName });
        setAuthFeedback({
          type: 'success',
          message: `Conta criada para ${emailInput.trim()} . O workspace será conectado ao Neon.`,
        });
      }
      setPasswordInput('');
    } catch (error) {
      setAuthFeedback({
        type: 'error',
        message: getAuthErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    await onSignOut();
    setAuthFeedback({
      type: 'success',
      message:
        'Você saiu da conta com sucesso! Para entrar novamente ou trocar de usuário, utilize o formulário abaixo.',
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      userName: nameInput.trim() || settings.userName,
      userPixKey: pixInput.trim() || settings.userPixKey,
    });
    setAuthFeedback({
      type: 'success',
      message: 'Perfil salvo nesta sessão. Confira o indicador do Neon para confirmar a sincronização.',
    });
  };

  return {
    handleEmailSubmit,
    handleLogoutClick,
    handleRunFullScanAndRepair,
    handleSaveProfile,
  };
}

export type AuthCloudActionsApi = ReturnType<typeof useAuthCloudActions>;
