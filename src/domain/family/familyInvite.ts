/**
 * Convite familiar: textos e links para quem convidou avisar a pessoa.
 * O app NÃO envia e-mail; o convite fica guardado no servidor e a pessoa o vê ao entrar com o mesmo e-mail.
 */

export type FamilyInviteTone = 'warning' | 'info' | 'neutral';

export interface FamilyInviteStatus {
  tone: FamilyInviteTone;
  title: string;
  detail: string;
}

/** Mensagem pronta para colar no WhatsApp ou em qualquer conversa. */
export function buildFamilyInviteMessage(input: { appUrl: string; email: string }): string {
  return [
    'Oi! Convidei você para dividirmos despesas no Minhas Economias.',
    `Abra ${input.appUrl} e entre com o e-mail ${input.email} (se ainda não tem conta, crie uma com esse mesmo e-mail).`,
    'Depois aceite o meu convite na aba Compartilhado.',
  ].join('\n');
}

/** Abre o WhatsApp com a mensagem pronta; quem convida escolhe o contato e envia. */
export function buildWhatsAppInviteUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Estado de um convite pendente enviado por mim.
 * `hasAccount` vem do servidor: false = e-mail sem conta; true = já tem conta e falta aceitar;
 * undefined = o servidor não soube dizer (não afirmamos nada).
 */
export function getFamilyInviteStatus(email: string, hasAccount: boolean | undefined): FamilyInviteStatus {
  if (hasAccount === false) {
    return {
      tone: 'warning',
      title: 'Essa pessoa ainda não tem conta',
      detail: `Peça para ela criar a conta com o e-mail ${email} e aceitar o convite na aba Compartilhado. O app não envia e-mail: use os botões abaixo para avisar.`,
    };
  }
  if (hasAccount === true) {
    return {
      tone: 'info',
      title: 'Ela já tem conta',
      detail: 'Falta abrir o app e aceitar o convite na aba Compartilhado. O app não envia e-mail: se quiser, avise pelos botões abaixo.',
    };
  }
  return {
    tone: 'neutral',
    title: 'Convite registrado',
    detail: `O app não envia e-mail. Peça para a pessoa entrar com ${email} e aceitar o convite na aba Compartilhado.`,
  };
}

/** Aviso mostrado logo depois de registrar o convite. Sem informação do servidor, mantém o texto de sempre. */
export function getFamilyInviteCreatedNotice(email: string, hasAccount: boolean | undefined): string {
  if (hasAccount === false) {
    return `Convite registrado para ${email}, mas essa pessoa ainda não tem conta. Nenhum e-mail foi enviado: use "Copiar convite" ou "Enviar pelo WhatsApp" no cartão dela e peça que crie a conta com esse mesmo e-mail.`;
  }
  if (hasAccount === true) {
    return `Convite registrado para ${email}. Ela já tem conta e verá o convite ao abrir o app; nenhum e-mail foi enviado.`;
  }
  return `Convite registrado no app para ${email}. Nenhum e-mail foi enviado; peça à pessoa que entre no Minhas Economias com esse mesmo e-mail para ver e aceitar o convite.`;
}
