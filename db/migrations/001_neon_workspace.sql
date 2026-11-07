-- Phase 1: preserve the existing Firestore workspace contract during cutover.
-- Apply with the Neon owner role. The API must use a restricted role and set
-- After migration 006, the API sets app.user_id per transaction; never expose
-- DATABASE_URL to the browser.

CREATE TABLE IF NOT EXISTS public.finance_workspaces (
  vault_id text PRIMARY KEY
    CHECK (char_length(vault_id) BETWEEN 16 AND 60),
  owner_firebase_uid text NOT NULL,
  owner_email text NOT NULL,
  display_name text,
  payload jsonb NOT NULL
    CHECK (jsonb_typeof(payload) = 'object'),
  source_updated_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_workspaces_payload_contract CHECK (
    payload ?& ARRAY[
      'uid', 'updatedAt', 'accountsJson', 'cardsJson', 'categoriesJson',
      'transactionsJson', 'goalsJson', 'investmentsJson'
    ]
    AND payload->>'uid' = vault_id
    AND payload->>'accountsJson' IS NOT NULL
    AND payload->>'cardsJson' IS NOT NULL
    AND payload->>'categoriesJson' IS NOT NULL
    AND payload->>'transactionsJson' IS NOT NULL
    AND payload->>'goalsJson' IS NOT NULL
    AND payload->>'investmentsJson' IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS finance_workspaces_owner_idx
  ON public.finance_workspaces (owner_firebase_uid);

CREATE INDEX IF NOT EXISTS finance_workspaces_updated_at_idx
  ON public.finance_workspaces (updated_at DESC);

ALTER TABLE public.finance_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_workspaces FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_workspaces_owner_policy
  ON public.finance_workspaces;
CREATE POLICY finance_workspaces_owner_policy
  ON public.finance_workspaces
  USING (
    owner_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  )
  WITH CHECK (
    owner_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  );

CREATE TABLE IF NOT EXISTS public.finance_workspace_migrations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vault_id text NOT NULL,
  owner_firebase_uid text NOT NULL,
  source text NOT NULL CHECK (source = 'firestore'),
  source_updated_at timestamptz,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  entity_counts jsonb NOT NULL CHECK (jsonb_typeof(entity_counts) = 'object'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vault_id, source)
);

ALTER TABLE public.finance_workspace_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_workspace_migrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_workspace_migrations_owner_policy
  ON public.finance_workspace_migrations;
CREATE POLICY finance_workspace_migrations_owner_policy
  ON public.finance_workspace_migrations
  USING (
    owner_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  )
  WITH CHECK (
    owner_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  );
