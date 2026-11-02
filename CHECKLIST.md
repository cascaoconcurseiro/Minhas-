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
- [x] Definir Neon como fonte principal do workspace e manter Firestore como espelho de contingência por enquanto.
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
- [ ] Definir a cópia de contingência e o procedimento de restauração antes de desativar o espelho Firestore.
- [x] Criar estruturas isoladas no Neon para convites e lançamentos familiares; migrar convites e espelhos sem apagar os dados antigos.
- [x] Trocar os fluxos do app/API para ler e gravar compartilhamentos no Neon com verificação de Firebase Auth e RLS.
- [x] Publicar roteamento específico das rotas familiares na Vercel e confirmar que convites/compartilhamentos exigem autenticação (401 sem token).
- [x] Remover referências de tipos Vite não resolvidas pelo compilador de funções Vercel; tipagem local limpa.
- [x] Confirmar no deploy Vercel que os diagnósticos `TS2688` foram resolvidos.
- [x] Carregar telas pesadas sob demanda, reduzindo o chunk inicial para 1,25 MB (350 kB gzip), e remover o aviso de configuração do Vite.
- [x] Publicar a divisão em chunks na Vercel e confirmar o arquivo principal de 1.248.948 bytes.
- [ ] Reduzir ou justificar o chunk inicial restante de 1,25 MB (aviso do limite de 500 kB).
- [ ] Validar ponta a ponta convite, aceite, recusa, revogação e lançamento compartilhado com duas contas reais.
- [ ] Restringir `cloud_vaults` ao dono autenticado; patch owner-only preparado, implantação pendente.
- [x] Remover acesso cruzado entre workspaces Firestore do código cliente; os dados familiares novos ficam em tabelas Neon separadas.

## Interface
- [x] Corrigir largura do modal de novo lançamento no desktop para respeitar o limite visual do componente.
