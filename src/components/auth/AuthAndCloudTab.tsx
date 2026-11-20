import React from 'react';
import { FaceIdCard } from './FaceIdCard';
import { AppVersionCard } from '../layout/AppVersionCard';
import { ScreenDiagnostics } from '../layout/ScreenDiagnostics';
import { ProjectAndDatabaseDocsPanel } from '../reports/ProjectAndDatabaseDocsPanel';
import { resolveAuthAndCloudTabProps } from './auth-cloud-tab/authCloudTabConfig';
import type { AuthAndCloudTabProps } from './auth-cloud-tab/authCloudTabConfig';
import { useAuthCloudState } from './auth-cloud-tab/useAuthCloudState';
import { useAuthCloudHealth } from './auth-cloud-tab/useAuthCloudHealth';
import { useAuthCloudActions } from './auth-cloud-tab/useAuthCloudActions';
import type { AuthAndCloudTabContext } from './auth-cloud-tab/authCloudTabContext';

import { AuthLeftColumn } from './auth-cloud-tab/AuthLeftColumn';
import { AuthRepairFeedback } from './auth-cloud-tab/AuthRepairFeedback';
import { AuthRightColumn } from './auth-cloud-tab/AuthRightColumn';
import { AuthStatusCard } from './auth-cloud-tab/AuthStatusCard';

export type { AuthAndCloudTabProps };

/**
 * Conta, login e nuvem: entrar, perfil, saúde do servidor e verificação dos dados.
 * A lógica fica em auth-cloud-tab/ (hooks chamados sempre na mesma ordem; cada um recebe o que os anteriores devolveram).
 */
export const AuthAndCloudTab: React.FC<AuthAndCloudTabProps> = (props) => {
  const ctx0 = resolveAuthAndCloudTabProps(props);
  const ctx1 = { ...ctx0, ...useAuthCloudState(ctx0) };
  const ctx2 = { ...ctx1, ...useAuthCloudHealth(ctx1) };
  const ctx3 = { ...ctx2, ...useAuthCloudActions(ctx2) };
  const form: AuthAndCloudTabContext = ctx3;
  const {
    autoVaultId,
    isAnonymousUser,
    userEmail,
  } = form;
  return (
    <div className="module-page space-y-5">
      {/* Top Banner: Automatic Cloud Status + Prominent Login/Logout State */}
      <AuthStatusCard form={form} />

      <AuthRepairFeedback form={form} />

      {/* Main Grid: Left = Login / Account / Logout | Right = Local Data Audit & Service Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Login, Registration, Profile & Session Management */}
        <AuthLeftColumn form={form} />

        {/* Right Column (7 cols): Local Financial Integrity & Service Health */}
        <AuthRightColumn form={form} />
      </div>

      {!isAnonymousUser && <FaceIdCard />}

      <AppVersionCard />

      <ScreenDiagnostics />

      {/* Complete Project, Database & GitHub Sync Documentation Panel */}
      <ProjectAndDatabaseDocsPanel
        autoVaultId={autoVaultId}
        userEmail={userEmail}
      />
    </div>
  );
};
