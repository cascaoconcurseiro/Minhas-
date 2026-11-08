BEGIN;

-- Login próprio no Neon (substitui o Firebase Auth). A senha nunca é guardada:
-- somente o hash scrypt gerado pelo backend.
CREATE TABLE IF NOT EXISTS public.app_users (
  id text PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_email_lowercase CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_uq ON public.app_users (email);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'minhas_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.app_users TO minhas_app_runtime;
  END IF;
END;
$$;

COMMIT;
