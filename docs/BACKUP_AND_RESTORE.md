# Backup e restauração

## O que cada cópia contém

- O arquivo JSON exportado em Configurações contém o workspace pessoal do app: contas, cartões, categorias, lançamentos, metas, investimentos, viagens, contatos familiares sem vínculo de convite e preferências incluídas pelo exportador.
- Lançamentos espelhados recebidos de outra conta e contatos ligados a convites Neon são excluídos do arquivo. O formato v6 inclui o ID Neon Auth do titular; ao importar em outra conta, os marcadores de compartilhamento são removidos para impedir que dados antigos sejam enviados a relações da nova conta.
- Esse JSON **não** é um backup integral do banco Neon. Convites e lançamentos espelhados são armazenados em tabelas próprias e não são exportados. Ao restaurar na mesma conta, convites existentes são mantidos e lançamentos compartilhados só são sincronizados novamente através de relações que continuam aceitas no Neon.
- Firebase Auth e Firestore foram removidos do runtime. A identidade atual e os dados financeiros são armazenados no Neon; o backup JSON não substitui backup integral do PostgreSQL.

## Exportar e restaurar o workspace pelo app

1. Entre na conta Neon Auth correta e abra Configurações → backup.
2. Exporte o JSON e guarde uma cópia fora do dispositivo. Antes de substituir dados, exporte também o estado atual.
3. Para restaurar, selecione o arquivo JSON e confirme a substituição. O app valida versão, coleções e categorias antes de alterar o estado da sessão.
4. Mantenha a tela aberta até o status da nuvem confirmar a gravação no Neon. Em caso de erro, não considere a restauração concluída: os dados podem estar apenas nesta sessão/localStorage; reconecte e sincronize antes de sair.
5. Reabra o app e confira contas, lançamentos e totais. A exportação/restauração não recria convites nem linhas de compartilhamento familiar.

## Backup integral e recuperação do Neon

O projeto Neon atual está no plano Free e a configuração mostra histórico/PITR de seis horas. Essa janela ajuda a recuperar erros recentes, mas não é uma cópia independente de longo prazo. O projeto não tem agenda automática de snapshots; a API Neon informa que a agenda automática requer plano pago. Para retenção maior, use um dump PostgreSQL autenticado com credencial administrativa segura, armazenado fora do repositório, ou avalie um plano com maior retenção. Não coloque `DATABASE_URL` em arquivos versionados, logs ou no frontend. Antes de uma restauração real:

1. Confirme o projeto, branch, banco e ponto de recuperação de destino.
2. Faça um snapshot/dump do estado atual para permitir retorno.
3. Restaure primeiro em branch/banco isolado e compare contagens e integridade das tabelas `finance_workspaces`, `finance_family_invitations` e `finance_shared_transactions`.
4. Só então aplique o procedimento de recuperação no ambiente principal, com o app sem gravar durante a janela de restauração.
5. Reabra o app e valide com o titular: dados do workspace, autenticação, convites e lançamentos compartilhados.

Foi feito um ensaio isolado: criou-se snapshot manual da branch raiz e restaurou-se em uma nova branch `qa-restore-branch-2026-11-03`; a branch restaurada ficou pronta, seu schema foi comparado sem diferenças com a origem e as quatro tabelas operacionais foram listadas. Com autorização do usuário, as duas branches de QA foram excluídas depois do ensaio; a branch production permaneceu primária/padrão, sem substituição. O snapshot temporário expira em 4/nov às 22:00 UTC. Esse ensaio valida o caminho de snapshot/restore e estrutura, mas não é um exercício de dump/restore independente nem de retorno após corrupção de dados. O app não depende do Firestore para persistência; o fluxo JSON restaura apenas o workspace pessoal.

## Cópia PostgreSQL diária em GitHub Actions

Foi escolhido o GitHub Actions com retenção de 30 dias. O repositório `cascaoconcurseiro/Minhas-` é público, então os artefatos da Actions podem ser baixados por quem tem acesso de leitura ao repositório. O workflow envia somente um arquivo `.age` cifrado; nunca envia o dump PostgreSQL em texto aberto. A chave privada não deve ser adicionada ao repositório, a uma GitHub Secret ou ao artifact. Guarde uma cópia recuperável da chave fora do GitHub; perdê-la torna os artifacts irrecuperáveis.

O workflow `.github/workflows/neon-backup.yml` roda diariamente às 13:00 UTC e também pode ser executado manualmente. Ele usa `pg_dump` pelo endpoint direto, inclui o schema `public`, remove owner/ACLs do arquivo e cifra o dump com `age`. O artifact tem retenção de 30 dias. O GitHub guarda o segredo `NEON_BACKUP_DATABASE_URL` (credencial PostgreSQL de leitura de backup) e a variável pública `NEON_BACKUP_AGE_RECIPIENT` (recipient age); não coloque nenhuma delas em arquivos versionados. A role de backup deve permanecer sem escrita, criação de objetos, roles ou databases. Como as tabelas têm RLS forçado, um dump completo precisa de uma exceção de leitura dedicada para backup para incluir dados de todos os titulares; valide esse privilégio estritamente no escopo das três tabelas financeiras.

O identity local de backup foi criado em `C:\Users\Wesley\Documents\Minhas Economias Backup\neon-backup.agekey`, fora do repositório e com ACL limitada à conta Windows atual e SYSTEM. Antes de considerar a recuperação independente pronta, copie esse arquivo para um cofre/offline sob controle do usuário e confirme que é possível acessá-lo em outro dispositivo. O workflow não fica pronto para backup integral de produção até o teste de RLS/dump/restore em QA passar e `NEON_BACKUP_DATABASE_URL` apontar para a role de produção com as permissões mínimas.

Para restaurar: baixe o artifact e descriptografe localmente com `age --decrypt --identity neon-backup.agekey backup.dump.age > backup.dump`. Confira o catálogo com `pg_restore --list backup.dump`; restaure somente em uma branch ou database isolado com `pg_restore --no-owner --no-privileges --dbname="$DATABASE_URL" backup.dump`, depois compare esquema, constraints, RLS e totais agregados das tabelas `finance_workspaces`, `finance_family_invitations` e `finance_shared_transactions`. Nunca restaure o dump diretamente sobre production.
