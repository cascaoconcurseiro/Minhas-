BEGIN;

-- Named NOT NULL constraints are optional across PostgreSQL versions.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('finance_family_invitations', 'owner_firebase_uid', 'owner_user_id'),
    ('finance_shared_transactions', 'recipient_firebase_uid', 'recipient_user_id'),
    ('finance_shared_transactions', 'sender_firebase_uid', 'sender_user_id'),
    ('finance_workspace_migrations', 'owner_firebase_uid', 'owner_user_id'),
    ('finance_workspaces', 'owner_firebase_uid', 'owner_user_id')
  ) AS names(table_name, old_column, new_column)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = format('public.%I', item.table_name)::regclass
         AND conname = item.table_name || '_' || item.old_column || '_not_null'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = format('public.%I', item.table_name)::regclass
         AND conname = item.table_name || '_' || item.new_column || '_not_null'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I',
        item.table_name, item.table_name || '_' || item.old_column || '_not_null',
        item.table_name || '_' || item.new_column || '_not_null');
    END IF;
  END LOOP;
END;
$$;

COMMIT;
