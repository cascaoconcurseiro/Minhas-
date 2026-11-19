/** Envio de lembrete por e-mail com o SMTP do usuário. Parte do servidor (ver backend/app.ts). */
import type { Express } from 'express';
import type { AuthUserIdentity } from '../authUser.ts';
import type { ReminderSmtpRouteDependencies } from '../smtpDependencies.ts';
import type { GuardsApi } from './guards.ts';

export function registerReminderRoutes(app: Express, ctx: GuardsApi) {
  const {
    reminderEmailLimit,
  } = ctx;
  // Email Reminder Dispatch Endpoint (Custom User SMTP Credentials)
  app.post('/api/reminders/send-email', async (req, res) => {
    try {
      const user = res.locals.authUser as AuthUserIdentity;
      if (reminderEmailLimit.isBlocked(user.uid)) {
        res.status(429).json({ error: 'Muitos e-mails enviados em pouco tempo. Aguarde uma hora e tente de novo.' });
        return;
      }
      const rawTo = String(req.body?.to || '').trim().toLowerCase();
      const subject = String(
        req.body?.subject || '[Minhas Economias BR] Lembrete Financeiro'
      ).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
      const textBody = String(req.body?.textBody || '').trim();
      const htmlBody = String(req.body?.htmlBody || '').trim();
      if (textBody.length > 100_000 || htmlBody.length > 200_000) {
        res.status(413).json({ error: 'O resumo do e-mail ficou grande demais.' });
        return;
      }
      const recurrence = String(req.body?.recurrence || 'daily');
      const preferredTime = String(req.body?.preferredTime || '08:00');

      const smtpObj = req.body?.smtp || {};
      const smtpHost = String(smtpObj.host || req.body?.smtpHost || '').trim();
      const smtpPort = Number(smtpObj.port ?? req.body?.smtpPort ?? 587);
      const smtpUser = String(smtpObj.user || req.body?.smtpUser || '').trim();
      const smtpPass = String(smtpObj.pass || req.body?.smtpPass || '').trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawTo || !emailRegex.test(rawTo)) {
        res.status(400).json({
          error: 'Informe um endereço de e-mail válido para o envio dos lembretes.',
        });
        return;
      }

      if (
        !smtpHost ||
        !Number.isFinite(smtpPort) ||
        !smtpUser ||
        !smtpPass
      ) {
        res.status(400).json({
          error:
            'Configure suas credenciais SMTP (Host, Porta, Usuário e Senha) nas configurações de e-mail dos lembretes.',
        });
        return;
      }

      const smtpDependencies = app.locals
        .reminderSmtpRouteDependencies as ReminderSmtpRouteDependencies;
      const smtpTarget = await smtpDependencies.resolveTarget(smtpHost, smtpPort);
      if (!smtpTarget) {
        res.status(400).json({
          error: 'Use um servidor SMTP público em uma porta compatível (25, 465, 587 ou 2525).',
        });
        return;
      }

      const sentAt = new Date().toISOString();
      const deliveryMode = 'custom_smtp' as const;
      reminderEmailLimit.recordFailure(user.uid);

      const transporter = smtpDependencies.createTransport({
        host: smtpTarget.address,
        port: smtpPort,
        secure: smtpPort === 465,
        requireTLS: smtpPort !== 465,
        tls: { servername: smtpTarget.servername },
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
      });

      const fromAddress = smtpUser.includes('@')
        ? `"Minhas Economias BR" <${smtpUser}>`
        : `"Minhas Economias BR" <${rawTo}>`;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: rawTo,
          subject,
          text: textBody,
          html: htmlBody || undefined,
        });
      } catch (smtpErr) {
        console.warn('Falha ao entregar lembrete via SMTP:', smtpErr instanceof Error ? smtpErr.message : 'erro desconhecido');
        res.status(502).json({
          error: 'O servidor SMTP não aceitou o envio. Confira host, porta e credenciais.',
        });
        return;
      }

      const recurrenceLabelMap: Record<string, string> = {
        daily: 'Diário (Todos os dias)',
        weekly: 'Semanal (Segundas-feiras)',
        monthly: 'Mensal (Dia 1º do mês)',
        weekdays: 'Dias Úteis (Seg a Sex)',
        urgent_only: 'Apenas Urgentes',
      };
      const recurrenceLabel =
        recurrenceLabelMap[recurrence] || 'Diário (Todos os dias)';

      res.json({
        ok: true,
        sentTo: rawTo,
        subject,
        sentAt,
        deliveryMode,
        smtpHost,
        smtpPort,
        smtpUser,
        message: `Resumo financeiro enviado via SMTP (${smtpHost}:${smtpPort}) para ${rawTo} (Horário: ${preferredTime} • Recorrência: ${recurrenceLabel}).`,
      });
    } catch (err: unknown) {
      console.error('Erro em /api/reminders/send-email:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'Não foi possível enviar o lembrete agora. Tente de novo.' });
    }
  });
}
