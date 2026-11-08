BEGIN;

-- Logout real: cada logout incrementa token_version e invalida todos os tokens antigos.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

COMMIT;
