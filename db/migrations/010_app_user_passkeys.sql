BEGIN;

-- Passkeys (Face ID / Touch ID) para entrar sem digitar a senha. Guarda somente a chave
-- PÚBLICA do aparelho; a chave privada e o rosto nunca saem do celular.
CREATE TABLE IF NOT EXISTS public.app_user_passkeys (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  rp_id text NOT NULL,
  device_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT app_user_passkeys_id_length CHECK (char_length(id) BETWEEN 16 AND 1024)
);

CREATE INDEX IF NOT EXISTS app_user_passkeys_user_idx ON public.app_user_passkeys (user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'minhas_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_user_passkeys TO minhas_app_runtime;
  END IF;
END;
$$;

COMMIT;
