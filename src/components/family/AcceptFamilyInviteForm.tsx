import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatFamilyInviteCodeInput, isFamilyInviteCodeComplete } from '../../domain/family/familyInvite';

interface AcceptFamilyInviteFormProps {
  inviteId: string;
  onAccept: (code: string) => void;
}

/** Aceitar um convite familiar exige o código que quem convidou enviou (criar conta com o e-mail não basta). */
export const AcceptFamilyInviteForm: React.FC<AcceptFamilyInviteFormProps> = ({ inviteId, onAccept }) => {
  const [code, setCode] = useState('');
  const complete = isFamilyInviteCodeComplete(code);

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete) onAccept(code);
      }}
    >
      <label htmlFor={`family-invite-code-${inviteId}`} className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        Digite o código que quem convidou enviou
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`family-invite-code-${inviteId}`}
          data-testid={`family-invite-code-${inviteId}`}
          aria-label="Código do convite"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          placeholder="ABCD-EFGH"
          value={code}
          onChange={(event) => setCode(formatFamilyInviteCodeInput(event.target.value))}
          className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="submit"
          data-testid={`accept-family-invite-${inviteId}`}
          disabled={!complete}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Aceitar convite
        </button>
      </div>
    </form>
  );
};
