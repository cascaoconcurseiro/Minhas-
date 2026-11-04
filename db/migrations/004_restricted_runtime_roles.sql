-- Create least-privilege runtime roles with SQL, not the Neon Console/API.
-- Neon-created roles inherit `neon_superuser`; SQL-created roles do not.
-- Apply as neondb_owner while production still uses the existing DATABASE_URL.
-- These roles start NOLOGIN. Set strong passwords through a secure Neon SQL
-- session, store the resulting app DSN in Vercel DATABASE_URL, and only then
-- deploy/smoke-test the new credential. Do not put passwords in this file.
--
-- App permissions match backend/app.ts: workspace CRUD except DELETE, import
-- receipt SELECT/INSERT, invitations SELECT/INSERT/UPDATE, shared transaction
-- SELECT/INSERT/UPDATE/DELETE, plus the identity sequence for migration receipts.
-- The GitHub manual workflow runs SELECT 1, so its role needs CONNECT only.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'minhas_app_runtime'
  ) THEN
    CREATE ROLE minhas_app_runtime NOLOGIN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'minhas_daily_runtime'
  ) THEN
    CREATE ROLE minhas_daily_runtime NOLOGIN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members m
      JOIN pg_catalog.pg_roles parent ON parent.oid = m.roleid
      JOIN pg_catalog.pg_roles member ON member.oid = m.member
     WHERE parent.rolname = 'neon_superuser'
       AND member.rolname IN ('minhas_app_runtime', 'minhas_daily_runtime')
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.pg_roles
     WHERE rolname IN ('minhas_app_runtime', 'minhas_daily_runtime')
       AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Runtime roles must not have admin attributes or neon_superuser membership';
  END IF;
END;
$$;

GRANT CONNECT ON DATABASE neondb TO minhas_app_runtime;
GRANT USAGE ON SCHEMA public TO minhas_app_runtime;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.finance_workspaces TO minhas_app_runtime;
GRANT SELECT, INSERT
  ON TABLE public.finance_workspace_migrations TO minhas_app_runtime;
GRANT USAGE, SELECT
  ON SEQUENCE public.finance_workspace_migrations_id_seq TO minhas_app_runtime;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.finance_family_invitations TO minhas_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.finance_shared_transactions TO minhas_app_runtime;

GRANT CONNECT ON DATABASE neondb TO minhas_daily_runtime;

COMMIT;
