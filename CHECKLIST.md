# Checklist — Minhas Economias

## Hospedagem
- [x] Criar projeto `minhaseconomias` no plano gratuito Hobby da Vercel.
- [x] Conectar projeto ao repositório `cascaoconcurseiro/Minhas-` e branch `main`.
- [x] Publicar o painel na URL de produção e confirmar que abre.
- [x] Configurar `DATABASE_URL`, `FIREBASE_PROJECT_ID` e `FIREBASE_API_KEY` como variáveis de produção na Vercel.
- [x] Criar o segredo GitHub Actions `NEON_DATABASE_URL` com um papel separado.
- [x] Alinhar o CI ao `bun.lock` e ao Bun 1.4.3 usado pelo projeto.

## Integração Neon
- [x] Criar o projeto Neon em São Paulo e aplicar o schema inicial.
- [x] Criar credencial PostgreSQL restrita para a aplicação e guardá-la como variável secreta na Vercel.
- [x] Publicar a API de workspace e validar as credenciais Firebase no runtime de produção.
- [x] Autorizar o domínio de produção na Firebase Authentication, mantendo Firebase Auth.
- [x] Migrar a conta autenticada do Firestore para Neon; conferir migração, leitura e gravação no site publicado.
- [x] Executar manualmente o workflow diário e confirmar `SELECT 1` com sucesso.
- [x] Confirmar workflow ativo com agendamento diário às 09:15 (America/Sao_Paulo); a primeira execução automática está pendente porque o workflow entrou na branch após o cron de hoje.
- [x] Auditar o workspace Neon em produção; nenhum registro correspondeu aos marcadores de mock existentes.
- [x] Publicar a limpeza de registros mock reconhecidos ao carregar snapshots remotos.
- [x] Deixar explícita na interface a diferença entre Firebase Auth, banco Neon e espelho Firestore.
- [x] Com autorização explícita do usuário, excluir os 4 lançamentos identificados como demonstração; preservar a conta.
- [x] Definir Neon como única persistência operacional do workspace; manter Firestore somente para importação inicial de snapshots legados.
- [x] Impedir gravação no espelho quando o salvamento principal no Neon falha; preservar o estado local e sinalizar a falha.
- [x] Manter Neon como autoridade quando o Firestore já existe; ignorar snapshots Firestore mais recentes em vez de promovê-los automaticamente.
- [x] Mostrar falha de sincronização como erro visível, sem a mensagem enganosa de nuvem ativa.
- [x] Marcar como erro uma falha ao atualizar o espelho Firestore durante a carga inicial ou limpeza.
- [x] Publicar essa correção no commit `697e05f` e confirmar o status Vercel `success`.
- [x] Aguardar a gravação do espelho na carga inicial para evitar que uma falha seja sobrescrita pelo status de sucesso; publicar em `8c46ba6` e confirmar a Vercel `success`.
- [ ] Validar concorrência em várias abas e a recuperação após indisponibilidade real do Neon.
- [x] Criar diálogo para conflitos `409`: comparar resumos, baixar cópia JSON das duas versões e escolher explicitamente a versão local ou a do Neon.
- [x] Publicar o diálogo em `07cedd5`; Vercel `success`, bundle servido, APIs autenticadas (401 sem token).
- [x] Publicar a proteção final que mantém a resolução bloqueada até a conclusão do espelho Firestore (`e3fc388`); conferir bundle 200 e APIs 401 sem token.
- [x] Documentar escopo do JSON do app, limites do espelho Firestore e roteiro de recuperação integral do Neon; o ensaio real de restore continua pendente antes de desativar o espelho.
- [x] Criar estruturas isoladas no Neon para convites e lançamentos familiares; migrar convites e espelhos sem apagar os dados antigos.
- [x] Trocar os fluxos do app/API para ler e gravar compartilhamentos no Neon com verificação de Firebase Auth e RLS.
- [x] Publicar roteamento específico das rotas familiares na Vercel e confirmar que convites/compartilhamentos exigem autenticação (401 sem token).
- [x] Remover referências de tipos Vite não resolvidas pelo compilador de funções Vercel; tipagem local limpa.
- [x] Confirmar no deploy Vercel que os diagnósticos `TS2688` foram resolvidos.
- [x] Carregar telas pesadas sob demanda, reduzindo o chunk inicial para 1,25 MB (350 kB gzip), e remover o aviso de configuração do Vite.
- [x] Publicar a divisão em chunks na Vercel e confirmar o arquivo principal de 1.248.948 bytes.
- [x] Adiar modais e busca; chunk inicial local caiu para 568 kB (168 kB gzip), com Firestore em chunk separado de 454 kB (137 kB gzip). O aviso do limite 500 kB permanece visível e foi justificado pelo tamanho comprimido; não foi aumentado o limite.
- [x] Registrar decisão do usuário de encerrar sem validação ponta a ponta do compartilhamento com uma segunda conta; esses fluxos permanecem sem essa evidência.
- [x] Restringir leitura de `cloud_vaults` ao titular autenticado apenas para importação inicial e bloquear lista/criação/atualização/exclusão; regras publicadas no banco nomeado.
- [x] Remover listener, espelho e gravações Firestore do app; workspaces novos são criados diretamente no Neon.
- [x] Remover acesso cruzado entre workspaces Firestore do código cliente; os dados familiares novos ficam em tabelas Neon separadas.

## Interface
- [x] Corrigir largura do modal de novo lançamento no desktop para respeitar o limite visual do componente.

## Sessão 2026-11-02 — continuidade
- [x] Remover listener e escrita de rotina no Firestore; manter leitura legada do próprio cofre somente quando o Neon retornar 404.
- [x] Adicionar criação Neon idempotente para contas sem snapshot legado e manter conflito sem sobrescrita.
- [x] Publicar regras Firestore com leitura de cofre restrita ao titular e todas as gravações/listagens negadas.
- [x] Iniciar leitura Neon diretamente após autenticação; Firestore deixa de ser pré-requisito para carregar o workspace.
- [x] Lazy-load do Firebase Firestore e dos modais/busca; remover e-mail/nome pessoal pré-preenchidos no login.
- [x] Remover script inline e `unsafe-inline` de `script-src`; validar scripts externos no HTML de build.
- [x] Validar formato do backup JSON antes de aplicar estado e esclarecer que sucesso de importação local não confirma gravação no Neon.
- [x] Atualizar passo de testes do CI para não exibir contagem fixa obsoleta.
- [x] Publicar `d1a545d` em `main`; check Vercel `success` e smoke de produção: HTML/CSP/guard/bundle 200 e API protegida 401 sem token.
- [x] Confirmar CI run `41525311897` concluído com sucesso e check Vercel `success` para `1b05c89`.
- [x] Reconsultar histórico do workflow Neon em 2/nov: execução manual bem-sucedida existe; execução automática `schedule` ainda não existe, pois a primeira janela agendada depois da publicação é 3/nov às 09:15 BRT.
- [ ] Confirmar execução automática diária do GitHub Actions; execução manual já foi validada.
- [ ] Publicar regras Firestore owner-only após confirmação explícita; até lá, risco de leitura pública permanece.
- [ ] Validar concorrência e recuperação de indisponibilidade real do Neon.
- [ ] Ensaio de restauração integral do Neon e validação familiar ponta a ponta foram dispensados ou permanecem pendentes conforme escopo anterior.
