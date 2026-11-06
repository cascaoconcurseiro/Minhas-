# Especificação de Segurança — Minhas Economias

## Identidade e banco operacional

- Firebase Authentication autentica o usuário e emite o ID token usado pela API.
- PostgreSQL no Neon é a fonte de verdade operacional para workspaces e dados familiares.
- O navegador nunca recebe `DATABASE_URL`; as rotas verificam o token Firebase antes de consultar o Neon.
- Cada transação no PostgreSQL define `app.firebase_uid` e `app.firebase_email`; as políticas RLS limitam leitura e escrita ao titular ou participante permitido.

## Firestore desativado

- O cliente e a API do app não importam o SDK do Firestore nem executam consultas nessa base.
- As regras do projeto negam leitura e escrita em todas as coleções.
- O Firebase permanece no produto somente para Auth e emissão de ID tokens.

## API e dados financeiros

- Rotas de workspace, compartilhamento familiar, lembretes por e-mail, câmbio ao vivo e sincronização de cotações exigem Firebase ID token válido.
- `/api/health` permanece público e retorna apenas estado agregado, sem identificadores nem erros/credenciais do banco.
- A criação inicial usa `ON CONFLICT DO NOTHING`; salvamentos usam revisão otimista e retornam `409` se outra gravação venceu.
- Convites e lançamentos compartilhados residem em tabelas Neon separadas, com RLS por participante.
- Ao sincronizar despesas compartilhadas, a API valida a cota como valor numérico finito e seguro em centavos, entre zero e o valor total do lançamento, antes de gravar; cota inválida retorna `400` sem iniciar a transação de gravação.
- A sincronização bloqueia a linha do convite aceito até concluir a transação, serializando gravações de despesas com revogação e sua exclusão dos registros compartilhados.
- O estado de saúde da API consulta a conexão Neon e a tabela operacional; `503` indica que persistência não está disponível.
- O endpoint SMTP só informa sucesso quando Nodemailer confirma o envio; falha do provedor retorna `502`.
- O usuário fornece suas credenciais SMTP pela interface; elas são enviadas à API autenticada e podem integrar o snapshot de configurações salvo no Neon. Não são segredos de servidor. A aplicação não deve registrá-las em logs nem expô-las em respostas.
- O SMTP aceita apenas hostname DNS público e portas `25`, `465`, `587` ou `2525`; rejeita respostas DNS privadas/mistas, fixa a conexão ao IP validado e exige TLS (TLS implícito na `465`, STARTTLS nas demais).
