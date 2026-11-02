# Backup e restauração

## O que cada cópia contém

- O arquivo JSON exportado em Configurações contém o workspace pessoal do app: contas, cartões, categorias, lançamentos, metas, investimentos, viagens, membros familiares e preferências incluídas pelo exportador.
- Esse JSON **não** é um backup integral do banco Neon. Convites e lançamentos compartilhados são armazenados em tabelas próprias do Neon e não fazem parte desse arquivo.
- O espelho `cloud_vaults` no Firestore também não cobre essas tabelas familiares. Ele é uma contingência do workspace, não um backup completo do PostgreSQL.

## Exportar e restaurar o workspace pelo app

1. Entre na conta Firebase correta e abra Configurações → backup.
2. Exporte o JSON e guarde uma cópia fora do dispositivo. Antes de substituir dados, exporte também o estado atual.
3. Para restaurar, selecione o arquivo JSON e confirme a substituição. O app valida versão, coleções e categorias antes de alterar o estado da sessão.
4. Mantenha a tela aberta até o status da nuvem confirmar a gravação no Neon. Em caso de erro, não considere a restauração concluída: os dados podem estar apenas nesta sessão/localStorage; reconecte e sincronize antes de sair.
5. Reabra o app e confira contas, lançamentos e totais. A exportação/restauração não recria convites nem linhas de compartilhamento familiar.

## Backup integral e recuperação do Neon

Para cobrir também `finance_family_invitations` e `finance_shared_transactions`, use backup/PITR do projeto Neon ou um dump PostgreSQL autenticado com credencial administrativa segura, armazenado fora do repositório. Não coloque `DATABASE_URL` em arquivos versionados, logs ou no frontend. Antes de uma restauração real:

1. Confirme o projeto, branch, banco e ponto de recuperação de destino.
2. Faça um snapshot/dump do estado atual para permitir retorno.
3. Restaure primeiro em branch/banco isolado e compare contagens e integridade das tabelas `finance_workspaces`, `finance_family_invitations` e `finance_shared_transactions`.
4. Só então aplique o procedimento de recuperação no ambiente principal, com o app sem gravar durante a janela de restauração.
5. Reabra o app e valide com o titular: dados do workspace, autenticação, convites e lançamentos compartilhados.

Este repositório não automatiza nem testa uma restauração de produção. O espelho Firestore deve permanecer habilitado até existir uma rotina de backup integral e um ensaio de recuperação aprovado; o fluxo JSON é apenas recuperação do workspace pelo app.
