-- Move workspace identity from mutable email-derived slugs to Firebase UID.
-- Apply with the Neon owner role after verifying there is one workspace per UID.
BEGIN;

-- Required preflight (performed before this migration): exactly one workspace
-- per owner_firebase_uid, no duplicate (owner_firebase_uid, source) receipts,
-- and no canonical vault ID already owned by another Firebase UID.

ALTER TABLE public.finance_workspaces
  DROP CONSTRAINT IF EXISTS finance_workspaces_vault_id_check;
ALTER TABLE public.finance_workspaces
  ADD CONSTRAINT finance_workspaces_vault_id_length_check
  CHECK (char_length(vault_id) BETWEEN 1 AND 160);

UPDATE public.finance_workspaces
   SET vault_id = 'vault_uid_' || owner_firebase_uid,
       payload = jsonb_set(
         payload,
         '{uid}',
         to_jsonb(('vault_uid_' || owner_firebase_uid)::text),
         true
       );

UPDATE public.finance_workspace_migrations AS receipt
   SET vault_id = 'vault_uid_' || workspace.owner_firebase_uid
  FROM public.finance_workspaces AS workspace
 WHERE receipt.owner_firebase_uid = workspace.owner_firebase_uid
   AND receipt.vault_id <> workspace.vault_id;

CREATE UNIQUE INDEX IF NOT EXISTS finance_workspaces_owner_firebase_uid_uq
  ON public.finance_workspaces (owner_firebase_uid);

COMMIT;
