/** Tipo das dependências de envio SMTP (trocáveis nos testes via app.locals). */
import { resolvePublicSmtpTarget } from './smtpSecurity.ts';
import nodemailer from 'nodemailer';

export interface ReminderSmtpRouteDependencies {
  resolveTarget: typeof resolvePublicSmtpTarget;
  createTransport: typeof nodemailer.createTransport;
}
