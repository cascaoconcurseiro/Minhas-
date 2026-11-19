BEGIN;

-- Integridade: workspace, convites e compartilhados só podem apontar para contas que existem em
-- app_users (a tabela de login própria desde a migração 008). Antes disso as colunas guardavam IDs de
-- provedores antigos e não havia como ligar as tabelas. Sem ON DELETE CASCADE de propósito: apagar uma
-- conta nunca apaga dados financeiros em silêncio; a exclusão precisa tratar esses dados antes.
--
-- Conferido em produção antes de criar (2026-11-19): nenhum workspace, convite ou compartilhado aponta
-- para conta inexistente. finance_workspace_migrations fica de fora: guarda o histórico da importação
-- do Firebase com os IDs antigos, que não existem em app_users.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'finance_workspaces_owner_user_fk') THEN
    ALTER TABLE public.finance_workspaces
      ADD CONSTRAINT finance_workspaces_owner_user_fk
      FOREIGN KEY (owner_user_id) REFERENCES public.app_users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'finance_family_invitations_owner_user_fk') THEN
    ALTER TABLE public.finance_family_invitations
      ADD CONSTRAINT finance_family_invitations_owner_user_fk
      FOREIGN KEY (owner_user_id) REFERENCES public.app_users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'finance_family_invitations_invited_user_fk') THEN
    ALTER TABLE public.finance_family_invitations
      ADD CONSTRAINT finance_family_invitations_invited_user_fk
      FOREIGN KEY (invited_user_id) REFERENCES public.app_users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'finance_shared_transactions_sender_user_fk') THEN
    ALTER TABLE public.finance_shared_transactions
      ADD CONSTRAINT finance_shared_transactions_sender_user_fk
      FOREIGN KEY (sender_user_id) REFERENCES public.app_users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'finance_shared_transactions_recipient_user_fk') THEN
    ALTER TABLE public.finance_shared_transactions
      ADD CONSTRAINT finance_shared_transactions_recipient_user_fk
      FOREIGN KEY (recipient_user_id) REFERENCES public.app_users(id);
  END IF;
END;
$$;

COMMIT;
