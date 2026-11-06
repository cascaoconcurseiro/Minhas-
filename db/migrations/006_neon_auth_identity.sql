BEGIN;

-- Replace Firebase-specific identity names with provider-neutral Neon Auth IDs.
ALTER TABLE public.finance_workspaces
  RENAME COLUMN owner_firebase_uid TO owner_user_id;
ALTER TABLE public.finance_workspace_migrations
  RENAME COLUMN owner_firebase_uid TO owner_user_id;
ALTER TABLE public.finance_family_invitations
  RENAME COLUMN owner_firebase_uid TO owner_user_id;
ALTER TABLE public.finance_family_invitations
  RENAME COLUMN invited_firebase_uid TO invited_user_id;
ALTER TABLE public.finance_shared_transactions
  RENAME COLUMN sender_firebase_uid TO sender_user_id;
ALTER TABLE public.finance_shared_transactions
  RENAME COLUMN recipient_firebase_uid TO recipient_user_id;
ALTER INDEX IF EXISTS public.finance_workspaces_owner_firebase_uid_uq
  RENAME TO finance_workspaces_owner_user_id_uq;

DROP POLICY IF EXISTS finance_workspaces_owner_policy ON public.finance_workspaces;
CREATE POLICY finance_workspaces_owner_policy ON public.finance_workspaces
  USING (owner_user_id = nullif(current_setting('app.user_id', true), ''))
  WITH CHECK (owner_user_id = nullif(current_setting('app.user_id', true), ''));

DROP POLICY IF EXISTS finance_workspace_migrations_owner_policy ON public.finance_workspace_migrations;
CREATE POLICY finance_workspace_migrations_owner_policy ON public.finance_workspace_migrations
  USING (owner_user_id = nullif(current_setting('app.user_id', true), ''))
  WITH CHECK (owner_user_id = nullif(current_setting('app.user_id', true), ''));

DROP POLICY IF EXISTS finance_family_invitations_participant_policy ON public.finance_family_invitations;
CREATE POLICY finance_family_invitations_participant_policy ON public.finance_family_invitations
  USING (
    owner_user_id = nullif(current_setting('app.user_id', true), '')
    OR lower(invited_email) = lower(nullif(current_setting('app.user_email', true), ''))
  )
  WITH CHECK (
    owner_user_id = nullif(current_setting('app.user_id', true), '')
    OR (
      lower(invited_email) = lower(nullif(current_setting('app.user_email', true), ''))
      AND invited_user_id = nullif(current_setting('app.user_id', true), '')
    )
  );

DROP POLICY IF EXISTS finance_shared_transactions_participant_policy ON public.finance_shared_transactions;
CREATE POLICY finance_shared_transactions_participant_policy ON public.finance_shared_transactions
  USING (
    sender_user_id = nullif(current_setting('app.user_id', true), '')
    OR recipient_user_id = nullif(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    sender_user_id = nullif(current_setting('app.user_id', true), '')
    OR recipient_user_id = nullif(current_setting('app.user_id', true), '')
  );

COMMIT;
