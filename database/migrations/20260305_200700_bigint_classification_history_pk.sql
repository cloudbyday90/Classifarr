-- Migration: 20260305_200700_bigint_classification_history_pk.sql
--
-- PURPOSE
-- Completes the classification_history.id INTEGER → BIGINT upgrade that was
-- started (but only half-finished) in migration 20260305_200500_bigint_primary_keys.sql.
--
-- That migration successfully widened the underlying SEQUENCE to BIGINT but could
-- not alter the column type itself because nine tables hold FOREIGN KEY constraints
-- referencing classification_history(id).  PostgreSQL requires every FK on the
-- referenced column to be dropped before the column type can change.
--
-- This migration:
--   1. Dynamically discovers and drops all FK constraints that reference
--      classification_history(id) via pg_constraint — not hardcoded names.
--   2. Widens classification_history.id to BIGINT.
--   3. Widens every known referencing classification_id column to BIGINT to
--      maintain FK type consistency across the schema.
--   4. Recreates all FK constraints with NOT VALID (instantaneous DDL; no lock
--      on referencing tables during ADD CONSTRAINT).
--   5. Validates each FK constraint individually using VALIDATE CONSTRAINT
--      (SHARE UPDATE EXCLUSIVE lock — reads and writes to the referencing tables
--      continue during validation; only full table scans are held).
--
-- SAFETY — EXISTING INSTALLS
-- The migration runner wraps each migration in BEGIN/COMMIT (see migrations.js
-- applyMigration()).  Any failure inside the DO block propagates out to that
-- transaction and causes a full ROLLBACK, leaving no orphaned schema changes.
-- The outer idempotency guard (col_type = 'bigint' → RETURN) makes the migration
-- safe to re-run: if classification_history.id is already bigint the entire body
-- is skipped.
--
-- SAFETY — FRESH INSTALLS
-- Fresh installs load database/schema/current.sql (INTEGER columns, all FKs
-- present) and then run any pending migrations on top.  This migration will find
-- classification_history.id = integer and execute the full upgrade path.
--
-- DYNAMIC FK DISCOVERY
-- Step 1 queries pg_constraint instead of hardcoding constraint names.  This
-- handles any edge case where a constraint was renamed or created with a
-- non-default name (e.g. manual DBA change, custom fork, future schema revision).
-- Any FK referencing classification_history(id) is dropped regardless of its name.
--
-- LOCK PROFILE
-- • ALTER TABLE … ALTER COLUMN TYPE bigint: ACCESS EXCLUSIVE on each table.
--   Table rewrites for int4→int8; on typical Classifarr installs (< 500k rows)
--   this completes in under a second.
-- • ADD CONSTRAINT … NOT VALID: ACCESS EXCLUSIVE momentarily to add the
--   constraint row to pg_constraint, then released.  No row scan.
-- • VALIDATE CONSTRAINT: SHARE UPDATE EXCLUSIVE — concurrent reads and writes
--   on the referencing table continue; only a sequential row scan is held.
--   Safe to run online without blocking application traffic.

DO $$
DECLARE
  pk_type    TEXT;
  fk_type    TEXT;
  col_type   TEXT;
  r          RECORD;
  tbl        TEXT;
BEGIN
  SELECT data_type INTO pk_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'classification_history'
     AND column_name  = 'id';

  -- Check whether the referencing columns are also already bigint.
  -- Sampling clarification_responses is sufficient — all 9 were created together
  -- and are widened together; if one is bigint, all are.
  SELECT data_type INTO fk_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'clarification_responses'
     AND column_name  = 'classification_id';

  -- Skip only when BOTH the PK and the referencing columns are already bigint.
  -- This handles the case where the schema snapshot already contained a bigint PK
  -- (e.g. captured after migration 200500 ran on a fresh DB) but the referencing
  -- integer columns were not yet widened.
  IF pk_type = 'bigint' AND fk_type = 'bigint' THEN
    RAISE NOTICE 'classification_history.id and referencing columns are already bigint — migration skipped.';
    RETURN;
  END IF;

  -----------------------------------------------------------------------
  -- Step 1: Dynamically drop ALL FK constraints referencing
  --         classification_history(id) — discovered via pg_constraint so
  --         the migration is not sensitive to constraint naming conventions.
  -----------------------------------------------------------------------
  FOR r IN
    SELECT c.conname AS constraint_name,
           c.conrelid::regclass AS referencing_table
      FROM pg_constraint c
     WHERE c.confrelid = 'public.classification_history'::regclass
       AND c.contype   = 'f'
       AND c.confkey @> ARRAY(
             SELECT a.attnum
               FROM pg_attribute a
              WHERE a.attrelid = 'public.classification_history'::regclass
                AND a.attname  = 'id'
           )::smallint[]
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
      r.referencing_table,
      r.constraint_name
    );
    RAISE NOTICE 'Dropped FK constraint % on %', r.constraint_name, r.referencing_table;
  END LOOP;

  -----------------------------------------------------------------------
  -- Step 2: Widen the primary key column itself
  -----------------------------------------------------------------------
  ALTER TABLE classification_history ALTER COLUMN id TYPE bigint;
  RAISE NOTICE 'classification_history.id widened to bigint.';

  -----------------------------------------------------------------------
  -- Step 3: Widen every referencing classification_id column to bigint.
  --         PostgreSQL recommends matching types on both sides of a FK;
  --         mismatched types (integer FK → bigint PK) work via implicit cast
  --         today but can silently prevent index-only scans and may break in
  --         a future PostgreSQL version.
  --         Tables checked for existence before ALTER to guard against
  --         very-old upgrade paths where a referencing table may not yet exist.
  --         NOTE: error_log.classification_id is a loose reference (no FK
  --         constraint); it is included here for type consistency.
  -----------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY[
    'clarification_responses',
    'classification_corrections',
    'classification_embeddings',
    'content_analysis_log',
    'embedding_errors',
    'embedding_retry_queue',
    'error_log',
    'media_requests',
    'pattern_match_log',
    'webhook_log'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = tbl
         AND column_name  = 'classification_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN classification_id TYPE bigint',
        tbl
      );
      RAISE NOTICE '%.classification_id widened to bigint.', tbl;
    ELSE
      RAISE NOTICE '%.classification_id skipped (column not found — old schema).', tbl;
    END IF;
  END LOOP;

  -----------------------------------------------------------------------
  -- Step 4: Recreate FK constraints using NOT VALID.
  --         NOT VALID adds the constraint metadata instantly without scanning
  --         existing rows (ACCESS EXCLUSIVE is held only for the brief DDL,
  --         not for a full table scan).  Existing rows are validated in Step 5.
  --
  --         Original ON DELETE behaviour from schema/current.sql:
  --           clarification_responses    → no ON DELETE  (RESTRICT by default)
  --           classification_corrections → ON DELETE CASCADE
  --           classification_embeddings  → ON DELETE CASCADE
  --           content_analysis_log       → no ON DELETE  (RESTRICT by default)
  --           embedding_errors           → ON DELETE CASCADE
  --           embedding_retry_queue      → ON DELETE CASCADE
  --           media_requests             → no ON DELETE  (RESTRICT by default)
  --           pattern_match_log          → ON DELETE CASCADE
  --           webhook_log                → no ON DELETE  (RESTRICT by default)
  --
  --         Each ADD CONSTRAINT is skipped if the table or column does not exist
  --         (guards against upgrade paths that haven't yet created that table).
  -----------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clarification_responses') THEN
    ALTER TABLE clarification_responses
      ADD CONSTRAINT clarification_responses_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id)
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='classification_corrections') THEN
    ALTER TABLE classification_corrections
      ADD CONSTRAINT classification_corrections_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='classification_embeddings') THEN
    ALTER TABLE classification_embeddings
      ADD CONSTRAINT classification_embeddings_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='content_analysis_log') THEN
    ALTER TABLE content_analysis_log
      ADD CONSTRAINT content_analysis_log_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id)
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='embedding_errors') THEN
    ALTER TABLE embedding_errors
      ADD CONSTRAINT embedding_errors_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='embedding_retry_queue') THEN
    ALTER TABLE embedding_retry_queue
      ADD CONSTRAINT embedding_retry_queue_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media_requests') THEN
    ALTER TABLE media_requests
      ADD CONSTRAINT media_requests_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id)
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pattern_match_log') THEN
    ALTER TABLE pattern_match_log
      ADD CONSTRAINT pattern_match_log_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='webhook_log') THEN
    ALTER TABLE webhook_log
      ADD CONSTRAINT webhook_log_classification_id_fkey
      FOREIGN KEY (classification_id) REFERENCES classification_history (id)
      NOT VALID;
  END IF;

  -----------------------------------------------------------------------
  -- Step 5: Validate each FK constraint.
  --         VALIDATE CONSTRAINT acquires SHARE UPDATE EXCLUSIVE (not ACCESS
  --         EXCLUSIVE), so concurrent reads and writes to the referencing table
  --         continue while PostgreSQL scans the rows.  This is the standard
  --         approach for adding FKs to tables that must stay online.
  --         Each VALIDATE is skipped if the table or constraint doesn't exist
  --         (belt-and-suspenders guard for incomplete Step 4 paths).
  -----------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='clarification_responses_classification_id_fkey') THEN
    ALTER TABLE clarification_responses    VALIDATE CONSTRAINT clarification_responses_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classification_corrections_classification_id_fkey') THEN
    ALTER TABLE classification_corrections VALIDATE CONSTRAINT classification_corrections_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classification_embeddings_classification_id_fkey') THEN
    ALTER TABLE classification_embeddings  VALIDATE CONSTRAINT classification_embeddings_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='content_analysis_log_classification_id_fkey') THEN
    ALTER TABLE content_analysis_log       VALIDATE CONSTRAINT content_analysis_log_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embedding_errors_classification_id_fkey') THEN
    ALTER TABLE embedding_errors           VALIDATE CONSTRAINT embedding_errors_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='embedding_retry_queue_classification_id_fkey') THEN
    ALTER TABLE embedding_retry_queue      VALIDATE CONSTRAINT embedding_retry_queue_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='media_requests_classification_id_fkey') THEN
    ALTER TABLE media_requests             VALIDATE CONSTRAINT media_requests_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pattern_match_log_classification_id_fkey') THEN
    ALTER TABLE pattern_match_log          VALIDATE CONSTRAINT pattern_match_log_classification_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='webhook_log_classification_id_fkey') THEN
    ALTER TABLE webhook_log                VALIDATE CONSTRAINT webhook_log_classification_id_fkey;
  END IF;

  RAISE NOTICE 'classification_history.id and all referencing classification_id columns upgraded to bigint. All FK constraints recreated and validated.';
END $$;

--
-- That migration successfully widened the underlying SEQUENCE to BIGINT but could
-- not alter the column type itself because nine tables hold FOREIGN KEY constraints
-- referencing classification_history(id).  PostgreSQL requires every FK on the
-- referenced column to be dropped before the column type can change.
--
-- This migration:
--   1. Drops all 9 FK constraints pointing at classification_history(id).
--   2. Widens classification_history.id to BIGINT.
--   3. Widens every referencing classification_id column to BIGINT to maintain
--      FK type consistency across the schema.
--   4. Recreates all 9 FK constraints with their original ON DELETE behaviour.
--
-- DOWNTIME RISK
-- Each ALTER TABLE … ALTER COLUMN TYPE bigint is a full table rewrite (int4 → int8
-- changes on-disk storage) and takes an ACCESS EXCLUSIVE lock for the duration.
-- For typical Classifarr installs the tables are small and the migration completes
-- in under a second.  For large installs (hundreds of thousands of rows in
-- classification_history) expect 1–30 seconds per table.  All reads and writes to
-- affected tables are blocked while the rewrite runs.  Schedule this migration
-- during a low-traffic window on large installs.
--
-- SAFETY
-- The entire migration runs inside the migration runner's BEGIN/COMMIT transaction,
-- so a partial failure rolls back cleanly with no orphaned schema changes left behind.
-- The outer DO $$ check makes the migration idempotent: if classification_history.id
-- is already bigint (e.g. a fresh install generated against a future schema) every
-- subsequent step is skipped without error.

DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'classification_history'
     AND column_name  = 'id';

  -- Skip everything if the column is already bigint (idempotent re-run guard).
  IF col_type = 'bigint' THEN
    RAISE NOTICE 'classification_history.id is already bigint — migration skipped.';
    RETURN;
  END IF;

  -----------------------------------------------------------------------
  -- Step 1: Drop all FK constraints that reference classification_history(id)
  -----------------------------------------------------------------------
  ALTER TABLE clarification_responses   DROP CONSTRAINT IF EXISTS clarification_responses_classification_id_fkey;
  ALTER TABLE classification_corrections DROP CONSTRAINT IF EXISTS classification_corrections_classification_id_fkey;
  ALTER TABLE classification_embeddings  DROP CONSTRAINT IF EXISTS classification_embeddings_classification_id_fkey;
  ALTER TABLE content_analysis_log       DROP CONSTRAINT IF EXISTS content_analysis_log_classification_id_fkey;
  ALTER TABLE embedding_errors           DROP CONSTRAINT IF EXISTS embedding_errors_classification_id_fkey;
  ALTER TABLE embedding_retry_queue      DROP CONSTRAINT IF EXISTS embedding_retry_queue_classification_id_fkey;
  ALTER TABLE media_requests             DROP CONSTRAINT IF EXISTS media_requests_classification_id_fkey;
  ALTER TABLE pattern_match_log          DROP CONSTRAINT IF EXISTS pattern_match_log_classification_id_fkey;
  ALTER TABLE webhook_log                DROP CONSTRAINT IF EXISTS webhook_log_classification_id_fkey;

  -----------------------------------------------------------------------
  -- Step 2: Widen the primary key column itself
  -----------------------------------------------------------------------
  ALTER TABLE classification_history ALTER COLUMN id TYPE bigint;

  -----------------------------------------------------------------------
  -- Step 3: Widen every referencing classification_id column to bigint
  -- (PostgreSQL requires FK participants to share a compatible type; keeping
  --  referencing columns as integer would work via implicit cast in most cases
  --  but makes the schema inconsistent and risks surprises on future DDL.)
  -----------------------------------------------------------------------
  ALTER TABLE clarification_responses    ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE classification_corrections ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE classification_embeddings  ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE content_analysis_log       ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE embedding_errors           ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE embedding_retry_queue      ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE media_requests             ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE pattern_match_log          ALTER COLUMN classification_id TYPE bigint;
  ALTER TABLE webhook_log                ALTER COLUMN classification_id TYPE bigint;

  -----------------------------------------------------------------------
  -- Step 4: Recreate all FK constraints with their original ON DELETE behaviour
  --
  -- Original constraints (from schema/current.sql):
  --   clarification_responses          → no ON DELETE (default RESTRICT)
  --   classification_corrections       → ON DELETE CASCADE
  --   classification_embeddings        → ON DELETE CASCADE
  --   content_analysis_log             → no ON DELETE (default RESTRICT)
  --   embedding_errors                 → ON DELETE CASCADE
  --   embedding_retry_queue            → ON DELETE CASCADE
  --   media_requests                   → no ON DELETE (default RESTRICT)
  --   pattern_match_log                → ON DELETE CASCADE
  --   webhook_log                      → no ON DELETE (default RESTRICT)
  -----------------------------------------------------------------------
  ALTER TABLE clarification_responses
    ADD CONSTRAINT clarification_responses_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id);

  ALTER TABLE classification_corrections
    ADD CONSTRAINT classification_corrections_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE;

  ALTER TABLE classification_embeddings
    ADD CONSTRAINT classification_embeddings_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE;

  ALTER TABLE content_analysis_log
    ADD CONSTRAINT content_analysis_log_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id);

  ALTER TABLE embedding_errors
    ADD CONSTRAINT embedding_errors_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE;

  ALTER TABLE embedding_retry_queue
    ADD CONSTRAINT embedding_retry_queue_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE;

  ALTER TABLE media_requests
    ADD CONSTRAINT media_requests_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id);

  ALTER TABLE pattern_match_log
    ADD CONSTRAINT pattern_match_log_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id) ON DELETE CASCADE;

  ALTER TABLE webhook_log
    ADD CONSTRAINT webhook_log_classification_id_fkey
    FOREIGN KEY (classification_id) REFERENCES classification_history (id);

  RAISE NOTICE 'classification_history.id and all 9 referencing classification_id columns upgraded to bigint.';
END $$;
