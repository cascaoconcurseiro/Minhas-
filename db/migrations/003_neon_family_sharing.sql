-- Isolated family invitations and expense mirrors. Apply with the Neon owner role.
-- After migration 006, the API verifies Firebase identity and sets
-- app.user_id/app.user_email for RLS.
BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_family_invitations (
  invitation_id text PRIMARY KEY CHECK (char_length(invitation_id) BETWEEN 16 AND 128),
  owner_firebase_uid text NOT NULL,
  owner_email text NOT NULL,
  invited_email text NOT NULL,
  invited_firebase_uid text,
  owner_member_id text NOT NULL,
  owner_name text NOT NULL,
  owner_pix_key text,
  relationship text NOT NULL DEFAULT 'outro',
  color text NOT NULL DEFAULT '#6366f1',
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'declined', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (lower(owner_email) <> lower(invited_email))
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_family_invitation_owner_email_uq
  ON public.finance_family_invitations (owner_firebase_uid, invited_email);
CREATE INDEX IF NOT EXISTS finance_family_invitation_invited_status_idx
  ON public.finance_family_invitations (lower(invited_email), status, updated_at DESC);
CREATE INDEX IF NOT EXISTS finance_family_invitation_member_owner_status_idx
  ON public.finance_family_invitations (invited_firebase_uid, lower(owner_email), status);

CREATE TABLE IF NOT EXISTS public.finance_shared_transactions (
  sender_firebase_uid text NOT NULL,
  recipient_firebase_uid text NOT NULL,
  shared_sync_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  recipient_hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_firebase_uid, recipient_firebase_uid, shared_sync_id),
  CHECK (sender_firebase_uid <> recipient_firebase_uid)
);

CREATE INDEX IF NOT EXISTS finance_shared_transactions_recipient_updated_idx
  ON public.finance_shared_transactions (recipient_firebase_uid, recipient_hidden, updated_at DESC);
CREATE INDEX IF NOT EXISTS finance_shared_transactions_sender_updated_idx
  ON public.finance_shared_transactions (sender_firebase_uid, updated_at DESC);

WITH workspace_members AS (
  SELECT w.owner_firebase_uid, w.owner_email, w.display_name,
         CASE
           WHEN jsonb_typeof(w.payload->'familyMembersJson') = 'string'
             THEN (w.payload->>'familyMembersJson')::jsonb
           WHEN jsonb_typeof(w.payload->'familyMembersJson') = 'array'
             THEN w.payload->'familyMembersJson'
           ELSE '[]'::jsonb
         END AS members
    FROM public.finance_workspaces AS w
), outgoing AS (
  SELECT w.*, entries.member AS member,
         lower(entries.member->>'email') AS invited_email
    FROM workspace_members AS w
    CROSS JOIN LATERAL jsonb_array_elements(w.members) AS entries(member)
   WHERE entries.member->>'direction' IS DISTINCT FROM 'incoming'
     AND coalesce(entries.member->>'inviteStatus', '') IN ('invited', 'accepted')
     AND coalesce(entries.member->>'id', '') <> ''
     AND coalesce(entries.member->>'email', '') <> ''
     AND lower(entries.member->>'email') <> lower(w.owner_email)
     AND entries.member->>'email' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
)
INSERT INTO public.finance_family_invitations
  (invitation_id, owner_firebase_uid, owner_email, invited_email,
   invited_firebase_uid, owner_member_id, owner_name, relationship, color, status)
SELECT md5(o.owner_firebase_uid || ':' || o.invited_email),
       o.owner_firebase_uid,
       lower(o.owner_email),
       o.invited_email,
       CASE WHEN o.member->>'inviteStatus' = 'accepted' THEN invited.owner_firebase_uid END,
       o.member->>'id',
       coalesce(nullif(o.display_name, ''), split_part(o.owner_email, '@', 1)),
       coalesce(nullif(o.member->>'relationship', ''), 'outro'),
       coalesce(nullif(o.member->>'color', ''), '#6366f1'),
       CASE
         WHEN o.member->>'inviteStatus' = 'accepted'
          AND invited.owner_firebase_uid IS NOT NULL THEN 'accepted'
         ELSE 'invited'
       END
  FROM outgoing AS o
  LEFT JOIN public.finance_workspaces AS invited
    ON lower(invited.owner_email) = o.invited_email
ON CONFLICT (owner_firebase_uid, invited_email) DO NOTHING;

-- Copy existing recipient-side mirrors without deleting the legacy snapshots.
WITH workspace_transactions AS (
  SELECT w.owner_firebase_uid AS recipient_uid,
         lower(w.owner_email) AS recipient_email,
         entries.tx AS payload
    FROM public.finance_workspaces AS w
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(w.payload->'transactionsJson') = 'string'
          THEN (w.payload->>'transactionsJson')::jsonb
        WHEN jsonb_typeof(w.payload->'transactionsJson') = 'array'
          THEN w.payload->'transactionsJson'
        ELSE '[]'::jsonb
      END
    ) AS entries(tx)
   WHERE entries.tx->>'id' LIKE 'tx-mirror-%'
     AND coalesce(entries.tx->>'sharedSyncId', '') <> ''
     AND coalesce(entries.tx->>'sharedOriginEmail', '') <> ''
), resolved AS (
  SELECT sender.owner_firebase_uid AS sender_uid,
         t.recipient_uid,
         replace(coalesce(t.payload->>'sharedSyncId', t.payload->>'id'), 'tx-mirror-', '') AS shared_sync_id,
         t.payload
    FROM workspace_transactions AS t
    JOIN public.finance_workspaces AS sender
      ON lower(sender.owner_email) = lower(t.payload->>'sharedOriginEmail')
   WHERE sender.owner_firebase_uid <> t.recipient_uid
)
INSERT INTO public.finance_shared_transactions
  (sender_firebase_uid, recipient_firebase_uid, shared_sync_id, payload)
SELECT sender_uid, recipient_uid, shared_sync_id, payload
  FROM resolved
 WHERE shared_sync_id <> ''
ON CONFLICT (sender_firebase_uid, recipient_firebase_uid, shared_sync_id) DO NOTHING;

-- Enable row-level access only after the one-time copy is complete.
ALTER TABLE public.finance_family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_family_invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_family_invitations_participant_policy
  ON public.finance_family_invitations;
CREATE POLICY finance_family_invitations_participant_policy
  ON public.finance_family_invitations
  USING (
    owner_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
    OR lower(invited_email) = lower(nullif(current_setting('app.firebase_email', true), ''))
  )
  WITH CHECK (
    owner_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
    OR (
      lower(invited_email) = lower(nullif(current_setting('app.firebase_email', true), ''))
      AND invited_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
    )
  );


ALTER TABLE public.finance_shared_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_shared_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_shared_transactions_participant_policy
  ON public.finance_shared_transactions;
CREATE POLICY finance_shared_transactions_participant_policy
  ON public.finance_shared_transactions
  USING (
    sender_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
    OR recipient_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  )
  WITH CHECK (
    sender_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
    OR recipient_firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  );


GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.finance_family_invitations TO minhas_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.finance_shared_transactions TO minhas_app;

COMMIT;

