/** Troca de senha da conta (exige a senha atual). Parte de AuthLeftColumn. */
import { useState } from 'react';
import { changePassword, getAuthErrorMessage } from '../../../lib/authClient';

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ tone: 'ok', text: 'Senha trocada. Os outros aparelhos precisam entrar de novo.' });
    } catch (error) {
      setMessage({ tone: 'error', text: getAuthErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4 text-xs" data-testid="change-password-form">
      <h4 className="font-bold text-slate-800 dark:text-slate-100">Trocar senha</h4>
      <div>
        <label htmlFor="change-password-current" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Senha atual</label>
        <input id="change-password-current" type="password" autoComplete="current-password" required
          value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="change-password-new" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nova senha (mínimo 8 caracteres)</label>
        <input id="change-password-new" type="password" autoComplete="new-password" required minLength={8}
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
      </div>
      {message && (
        <p role="status" className={message.tone === 'ok' ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-semibold text-rose-700 dark:text-rose-300'}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={busy}
        className="rounded-xl bg-slate-800 dark:bg-slate-200 px-4 py-2.5 text-xs font-bold text-white dark:text-slate-900 disabled:opacity-60">
        {busy ? 'Trocando…' : 'Trocar senha'}
      </button>
    </form>
  );
}
