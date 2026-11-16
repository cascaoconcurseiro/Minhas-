\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'minhas_app_runtime') THEN
    CREATE ROLE minhas_app_runtime NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'minhas_daily_runtime') THEN
    CREATE ROLE minhas_daily_runtime NOLOGIN;
  END IF;

  IF EXISTS (
    SELECT FROM pg_roles
    WHERE rolname IN ('minhas_app_runtime', 'minhas_daily_runtime')
      AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)
  ) OR EXISTS (
    SELECT FROM pg_auth_members AS membership
    JOIN pg_roles AS member ON member.oid = membership.member
    WHERE member.rolname IN ('minhas_app_runtime', 'minhas_daily_runtime')
  ) THEN
    RAISE EXCEPTION 'Os papéis de execução devem ser dedicados e sem privilégios administrativos';
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO minhas_app_runtime, minhas_daily_runtime', current_database());
END;
$$;

GRANT USAGE ON SCHEMA public TO minhas_app_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.app_users,
  public.finance_workspaces,
  public.finance_family_invitations TO minhas_app_runtime;
GRANT SELECT, INSERT ON TABLE public.finance_workspace_migrations TO minhas_app_runtime;
GRANT USAGE, SELECT ON SEQUENCE public.finance_workspace_migrations_id_seq TO minhas_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.app_user_passkeys,
  public.finance_shared_transactions TO minhas_app_runtime;

COMMIT;
