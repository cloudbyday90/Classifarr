-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- Existing profiles have unknown provenance until the queued refresh replaces them.
ALTER TABLE library_profiles ADD COLUMN IF NOT EXISTS inventory_revision BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'library_profiles_inventory_revision_positive_chk'
          AND conrelid = 'library_profiles'::regclass
    ) THEN
        ALTER TABLE library_profiles ADD CONSTRAINT library_profiles_inventory_revision_positive_chk
            CHECK (inventory_revision IS NULL OR inventory_revision > 0);
    END IF;
END $$;

COMMENT ON COLUMN library_profiles.inventory_revision IS
    'Exact library_profile_inventory_state revision used to compute this profile; NULL denotes legacy unverified provenance.';
