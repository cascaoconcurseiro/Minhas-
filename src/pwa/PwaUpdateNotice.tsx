import {useEffect} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {createPwaUpdateGate} from './updateGate';
import {hasUpdateBlockers} from './updateBlockers';
import {markUpdatePending, registerPwaControl} from './pwaControl';

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const USER_IDLE_BEFORE_UPDATE_MS = 5 * 1000;
const RECHECK_WHEN_PENDING_MS = 2 * 1000;

/**
 * Atualização automática e silenciosa: procura versão nova ao abrir, ao voltar para o app e de tempos
 * em tempos, e aplica sozinha só quando é seguro (nada sendo editado, nenhuma janela aberta, sem tocar
 * há poucos segundos e sem salvar na nuvem), para ninguém perder o que está digitando. Sem aviso na tela.
 * A pessoa também pode pedir a atualização na hora em Configurações (`checkAndApplyUpdate`).
 */
export function PwaUpdateNotice() {
  useEffect(() => {
    let updateSW: () => Promise<void> = () => Promise.resolve();
    const gate = createPwaUpdateGate({
      document,
      applyUpdate: () => updateSW(),
      isBusy: hasUpdateBlockers,
      idleMs: USER_IDLE_BEFORE_UPDATE_MS,
      blockWhileDialogOpen: true,
      recheckMs: RECHECK_WHEN_PENDING_MS,
    });

    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      if (!registration || !navigator.onLine) return;
      void registration.update().catch(() => undefined);
    };
    const onVisible = () => {
      if (!document.hidden) checkForUpdate();
    };
    const onFocus = () => checkForUpdate();

    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        markUpdatePending();
        gate.updateAvailable();
      },
      onRegisteredSW(_swUrl, swRegistration) {
        registration = swRegistration;
        registerPwaControl({ registration: swRegistration });
        // Ao abrir o app já procura versão nova, sem esperar o primeiro ciclo.
        checkForUpdate();
      },
    });
    registerPwaControl({ applyUpdate: () => updateSW() });
    const timer = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', checkForUpdate);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', checkForUpdate);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      gate.destroy();
    };
  }, []);

  return null;
}
