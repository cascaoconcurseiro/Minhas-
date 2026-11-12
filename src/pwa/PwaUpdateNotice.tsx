import {useEffect} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {createPwaUpdateGate} from './updateGate';
import {hasUpdateBlockers} from './updateBlockers';

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const USER_IDLE_BEFORE_UPDATE_MS = 20 * 1000;
const RECHECK_WHEN_PENDING_MS = 5 * 1000;

/**
 * Atualização automática e silenciosa: procura versão nova de tempos em tempos e ao voltar para a aba,
 * e aplica sozinha só quando é seguro (nada sendo editado, nenhuma janela aberta, sem digitar há alguns
 * segundos e sem salvar na nuvem). Sem aviso na tela.
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

    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: gate.updateAvailable,
      onRegisteredSW(_swUrl, swRegistration) {
        registration = swRegistration;
      },
    });
    const timer = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', checkForUpdate);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', checkForUpdate);
      gate.destroy();
    };
  }, []);

  return null;
}
