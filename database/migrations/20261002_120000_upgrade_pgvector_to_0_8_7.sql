-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- CVE-2026-103484: install the patched native extension in the image first,
-- then update each existing database's extension catalog transactionally.
-- Do not create an optional missing extension or downgrade a newer version.
DO $$
DECLARE
  installed_version text;
BEGIN
  SELECT extversion INTO installed_version FROM pg_extension WHERE extname = 'vector';
  IF installed_version IS NULL THEN
    RAISE NOTICE 'Skipping pgvector upgrade: vector extension is not installed';
    RETURN;
  END IF;

  IF installed_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
     AND string_to_array(installed_version, '.')::int[] >= ARRAY[0, 8, 7] THEN
    RETURN;
  END IF;

  -- Missing update files or insufficient privileges must fail the migration;
  -- the runner must not mark an unpatched database as successfully upgraded.
  ALTER EXTENSION vector UPDATE TO '0.8.7';
END $$;
