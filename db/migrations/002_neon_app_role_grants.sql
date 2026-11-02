-- Run after creating the non-owner runtime role `minhas_app` in Neon.
-- Keep runtime privileges limited to the workspace and its migration receipt.
GRANT USAGE ON SCHEMA public TO minhas_app;
GRANT SELECT, INSERT, UPDATE
  ON public.finance_workspaces TO minhas_app;
GRANT SELECT, INSERT
  ON public.finance_workspace_migrations TO minhas_app;
GRANT USAGE, SELECT
  ON SEQUENCE public.finance_workspace_migrations_id_seq TO minhas_app;
