import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolvePublicSmtpTarget } from './smtpSecurity.ts';
import { registerSessionAuth } from './routes/authRoutes.ts';
import { registerGuards } from './routes/guards.ts';
import { registerWorkspaceRoutes } from './routes/workspaceRoutes.ts';
import { registerFamilyRoutes } from './routes/familyRoutes.ts';
import { registerHealthRoutes } from './routes/healthRoutes.ts';
import { registerMarketDataRoutes } from './routes/marketDataRoutes.ts';
import { registerReminderRoutes } from './routes/reminderRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
// Na Vercel há um proxy na frente da função: sem isto, `req.ip` seria o IP do proxy (igual para todos) e os
// limites de tentativa (cadastro, Face ID) valeriam para todos os usuários juntos. Com 1 salto confiável,
// `req.ip` passa a ser o IP real do cliente (X-Forwarded-For).
if (process.env.VERCEL) app.set('trust proxy', 1);
app.locals.reminderSmtpRouteDependencies = {
  resolveTarget: resolvePublicSmtpTarget,
  createTransport: nodemailer.createTransport,
};

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '4mb' }));
  const ctx1 = registerSessionAuth(app);
  const ctx2 = { ...ctx1, ...registerGuards(app, ctx1) };
  registerWorkspaceRoutes(app);
  registerFamilyRoutes(app, ctx2);
  registerHealthRoutes(app);
  registerMarketDataRoutes(app);
  registerReminderRoutes(app, ctx2);


  // Rota da API que não existe: resposta JSON curta (o app lê toda resposta da API como JSON).
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Rota da API não encontrada.' });
  });

  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          watch: null,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(__dirname, '..', 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }

  // Última camada: qualquer erro não tratado (JSON malformado, corpo grande demais, falha inesperada) vira
  // resposta JSON curta, nunca página HTML com detalhes técnicos. O app lê todas as respostas da API como JSON.
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 500;
    if (status >= 400 && status < 500) {
      res.status(status).json({
        error: status === 413 ? 'Os dados enviados são grandes demais.' : 'Requisição inválida.',
      });
      return;
    }
    console.error('Erro não tratado na API:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  });
}

void startServer();

export default app;
