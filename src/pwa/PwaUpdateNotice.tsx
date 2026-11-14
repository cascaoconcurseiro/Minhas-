import {useEffect} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {createPwaUpdateGate} from './updateGate';
import {hasUpdateBlockers} from './updateBlockers';
import {markUpdatePending, registerPwaControl} from './pwaControl';

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const USER_IDLE_BEFORE_UPDATE_MS = 2 * 1000;
const RECHECK_WHEN_PENDING_MS = 2 * 1000;
// Logo ao abrir (antes de qualquer toque) a atualização pode entrar sem a pessoa perceber; depois disso só
// entra com o app em segundo plano, como nos grandes apps: nunca com a tela em uso.
const STARTUP_GRACE_MS = 8 * 1000;

/**
 * Atualização automática e silenciosa: procura versão nova ao abrir, ao voltar para o app e de tempos
 * em tempos, e aplica sozinha só quando é seguro (nada sendo editado, nenhuma janela aberta, sem tocar
 * há poucos segundos e sem salvar na nuvem), para ninguém perder o que está digitando. Sem aviso na tela.
 * A pessoa também pode pedir a atualização na hora em Configurações (`checkAndApplyUpdate`).
 */
export function PwaUpdateNotice() {
  useEffect(() => {
    let updateSW: () => Promise<void> = () => Promise.resolve();
    const startedAt = Date.now();
    let interacted = false;
    const markInteraction = () => { interacted = true; };
    document.addEventListener('pointerdown', markInteraction, true);
    document.addEventListener('keydown', markInteraction, true);
    const canApplyNow = () => document.hidden || (!interacted && Date.now() - startedAt < STARTUP_GRACE_MS);
    const gate = createPwaUpdateGate({
      document,
      applyUpdate: () => updateSW(),
      isBusy: () => hasUpdateBlockers() || !canApplyNow(),
      idleMs: USER_IDLE_BEFORE_UPDATE_MS,
      blockWhileDialogOpen: false,
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
      document.removeEventListener('pointerdown', markInteraction, true);
      document.removeEventListener('keydown', markInteraction, true);
      gate.destroy();
    };
  }, []);

  // Sem barra "Nova versão": a atualização é silenciosa (o botão manual continua em Conta, Login & Nuvem)
  return null;
}
