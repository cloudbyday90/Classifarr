-- Classifarr - AI-powered media classification for the *arr ecosystem
-- Copyright (C) 2024-2026 Classifarr Contributors
--
ALTER TABLE library_profiles ADD COLUMN IF NOT EXISTS observation_summary JSONB;

COMMENT ON COLUMN library_profiles.observation_summary IS
    'Versioned inventory-row prevalence, metadata coverage, and typed identity counts; observed evidence, not policy exclusions.';
