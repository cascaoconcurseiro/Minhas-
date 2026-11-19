# Especificação de Segurança — Minhas Economias

> Atualizado em 2026-11-19. Complementa [banco-de-dados.md](./banco-de-dados.md) e [api.md](./api.md).

## Identidade e banco operacional

- O backend autentica por e-mail e senha contra `app_users` (Neon). A senha nunca é guardada: só o hash scrypt (N=16384, sal aleatório). Senha de 8 a 200 caracteres; e-mail único e em minúsculas.
- A sessão é um token assinado HS256 (30 dias, `aud=session`) com `AUTH_SESSION_SECRET` (ou chave derivada de `DATABASE_URL`). Cada requisição protegida confere assinatura, expiração e `token_version` no banco; o logout incrementa `token_version` e revoga todos os tokens emitidos antes.
- PostgreSQL no Neon é a fonte de verdade operacional para workspaces e dados familiares.
- O navegador nunca recebe `DATABASE_URL`; as rotas verificam o token de sessão e a versão no banco antes de consultar o Neon.
- Cada transação PostgreSQL define `app.user_id` e `app.user_email`; as políticas RLS limitam leitura e escrita ao titular ou participante permitido.

## Provedores externos

- Firebase foi removido por completo (código, dependência e configuração). Não há verificação de e-mail: a família é formada só por convite dentro do sistema.
- **Convite sem verificação de e-mail, protegido por código**: como não há verificação de e-mail, criar uma conta com o e-mail convidado não basta para aceitar: o convite só é aceito com o **código do convite** (HMAC-SHA256 do convite com o segredo da sessão do servidor, 8 caracteres, comparação em tempo constante), que só quem convidou recebe. 8 erros seguidos bloqueiam por 1 hora (limite por instância do servidor, melhor esforço). O convite pode ser revogado a qualquer momento (apaga os espelhos nos dois sentidos). **Limite conhecido:** quem tem o código (ex.: mensagem encaminhada) e o e-mail convidado consegue aceitar; se o segredo do servidor (`AUTH_SESSION_SECRET`) for trocado, os códigos mudam e as mensagens antigas deixam de valer.
- **Aviso "a pessoa já tem conta"** (`invited_has_account`): só é calculado para convites pendentes que o próprio usuário enviou. Isso permite descobrir se um e-mail tem conta, informação que o cadastro (`409 Este e-mail já possui cadastro`) também revela; o cadastro tem limite de 10 tentativas/hora por IP. Criar/atualizar convites tem limite de 20/hora por usuário, para ninguém testar e-mails em massa.
- Limite de tentativas por instância: login 8 falhas/15 min por IP+e-mail; cadastro 10/hora por IP. Tentativa com e-mail inexistente gasta o mesmo tempo de uma senha errada (hash fictício).

## API e dados financeiros

- Rotas de workspace, compartilhamento familiar, lembretes por e-mail, câmbio ao vivo e sincronização de cotações exigem sessão válida (`Authorization: Bearer <token de sessão>`). Rotas públicas: `/api/auth/register`, `/api/auth/login`, `/api/status`.
- `/api/status` é público, não consulta o Neon e informa somente estado agregado de configuração.
- `/api/readiness` consulta a conexão e a tabela Neon apenas com `Authorization: Bearer <CRON_SECRET>`; responde `401` antes de conectar quando o segredo está ausente ou inválido.
- A criação inicial usa `ON CONFLICT DO NOTHING`; salvamentos usam revisão otimista e retornam `409` se outra gravação venceu.
- Convites e lançamentos compartilhados residem em tabelas Neon separadas, com RLS por participante.
- Ao sincronizar despesas compartilhadas, a API valida a cota como valor numérico finito e seguro em centavos, entre zero e o valor total do lançamento, antes de gravar; cota inválida retorna `400` sem iniciar a transação de gravação.
- A sincronização bloqueia a linha do convite aceito até concluir a transação, serializando gravações de despesas com revogação e sua exclusão dos registros compartilhados.
- O status público não comprova disponibilidade do Neon. A rota protegida de readiness consulta a conexão Neon e a tabela operacional; `503` indica que persistência não está disponível.
- O endpoint SMTP só informa sucesso quando Nodemailer confirma o envio; falha do provedor retorna `502`.
- O usuário fornece suas credenciais SMTP pela interface; elas são enviadas à API autenticada e podem integrar o snapshot de configurações salvo no Neon. Não são segredos de servidor. A aplicação não deve registrá-las em logs nem expô-las em respostas.
- O SMTP aceita apenas hostname DNS público e portas `25`, `465`, `587` ou `2525`; rejeita respostas DNS privadas/mistas, fixa a conexão ao IP validado e exige TLS (TLS implícito na `465`, STARTTLS nas demais).

## Face ID / Touch ID (passkeys)

- Implementado com WebAuthn (`@simplewebauthn`): o aparelho guarda a chave privada e o rosto/digital **nunca saem do celular**. O servidor guarda só a chave pública, o contador de uso, os transportes, o domínio (`rp_id`) e um rótulo do aparelho em `app_user_passkeys` (migração 010).
- Atestação `none`, verificação biométrica obrigatória, até 10 aparelhos por conta; o desafio viaja em token assinado com validade de 5 minutos.
- Erros técnicos da biblioteca (`detail`) só são devolvidos quando a verificação do Face ID falha; falhas de banco devolvem só a mensagem amigável.
- O desafio é um token assinado de 5 min, sem uso único no servidor (replay só seria possível com a resposta biométrica completa interceptada).
- Login por passkey tem limite de 20 falhas a cada 15 minutos por IP; remover o Face ID de um aparelho é possível a qualquer momento.
- A oferta de cadastro do Face ID aparece só em celular e tablet.
- **Nunca verificado**: Face ID em iPhone/Safari reais (cobertura apenas por testes automáticos).

## Cabeçalhos e navegador

`vercel.json` aplica Content-Security-Policy restritiva, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` e `Permissions-Policy` (câmera, microfone e localização desativados). Respostas `/api/*` não são cacheadas e o `sw.js` nunca é cacheado.

## Limites de payload e abuso

O corpo JSON do servidor aceita até 4 MB; consultas de câmbio (20/h) e cotações (60/h) têm limite de uso por conta.

Envio de lembrete por e-mail: 20 envios/hora por conta, assunto em uma linha (até 200 caracteres) e corpo limitado (texto 100 mil, HTML 200 mil caracteres), para a rota não virar um disparador de e-mails. Erros inesperados das rotas de câmbio, cotações e e-mail devolvem mensagem genérica em português; o detalhe técnico (mensagem do provedor de IA ou do SMTP) fica só no log do servidor. Caminho `/api/...` inexistente responde `404` em JSON.

## Auditoria de dependências (`bun audit`, 2026-11-19)
Duas vulnerabilidades **moderadas**, ambas em `workbox-build > glob > minimatch` (ferramenta que só roda na hora do build do PWA, nunca no app publicado nem com dado de usuário): `glob` (cancelamento por AbortSignal) e `minimatch` (lentidão com padrões maliciosos). Não há correção dentro das versões que o `workbox-build` aceita; forçar versões novas poderia quebrar o build do PWA. **Risco aceito**; rever quando o `workbox-build`/`vite-plugin-pwa` publicar versão com `glob` ≥ 14.
