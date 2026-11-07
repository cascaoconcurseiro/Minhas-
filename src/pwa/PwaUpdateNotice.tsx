import {useEffect, useState} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {createPwaUpdateGate} from './updateGate';

export function PwaUpdateNotice() {
  const [deferred, setDeferred] = useState(false);

  useEffect(() => {
    let updateSW = () => Promise.resolve();
    const gate = createPwaUpdateGate({
      document,
      applyUpdate: () => updateSW(),
      onDeferred: setDeferred,
    });
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: gate.updateAvailable,
    });

    return () => gate.destroy();
  }, []);

  if (!deferred) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg"
      role="status"
      aria-live="polite"
    >
      Uma atualização está pronta. Salve ou feche a edição atual para atualizar o sistema.
    </div>
  );
}
