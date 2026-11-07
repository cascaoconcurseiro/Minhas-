# Especificação de Segurança — Minhas Economias

## Identidade e banco operacional

- Firebase Auth autentica por e-mail/senha e emite o ID token usado pela API.
- PostgreSQL no Neon é a fonte de verdade operacional para workspaces e dados familiares.
- O navegador nunca recebe `DATABASE_URL`; as rotas verificam o ID token Firebase antes de consultar o Neon.
- Cada transação PostgreSQL define `app.user_id` e `app.user_email`; as políticas RLS limitam leitura e escrita ao titular ou participante permitido.

## Provedores externos

- Firebase Auth fornece somente a identidade; Firebase Firestore e Firebase Storage não são usados pelo runtime.

## API e dados financeiros

- Rotas de workspace, compartilhamento familiar, lembretes por e-mail, câmbio ao vivo e sincronização de cotações exigem ID token Firebase válido.
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
