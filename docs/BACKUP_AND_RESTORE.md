# Backup e restauração

## O que cada cópia contém

- O arquivo JSON exportado em Configurações contém o workspace pessoal do app: contas, cartões, categorias, lançamentos, metas, investimentos, viagens, membros familiares e preferências incluídas pelo exportador.
- Esse JSON **não** é um backup integral do banco Neon. Convites e lançamentos compartilhados são armazenados em tabelas próprias do Neon e não fazem parte desse arquivo.
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
