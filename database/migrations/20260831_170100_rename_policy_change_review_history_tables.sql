/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

-- Repair local/pre-release databases created while the initial migration used
-- identifiers beyond PostgreSQL's 63-byte limit. Fresh installs already use
-- the concise names and therefore take the no-op path.
DO $$
BEGIN
    IF to_regclass('public.policy_change_review_history_controls') IS NULL
       AND to_regclass('public.policy_candidate_correction_policy_change_review_history_contro') IS NOT NULL THEN
        ALTER TABLE policy_candidate_correction_policy_change_review_history_contro
            RENAME TO policy_change_review_history_controls;
    END IF;

    IF to_regclass('public.policy_change_review_history_aggregates') IS NULL
       AND to_regclass('public.policy_candidate_correction_policy_change_review_history_aggreg') IS NOT NULL THEN
        ALTER TABLE policy_candidate_correction_policy_change_review_history_aggreg
            RENAME TO policy_change_review_history_aggregates;
    END IF;

    IF to_regclass('public.policy_change_review_history_controls') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.policy_change_review_history_controls'::regclass
             AND conname = 'policy_candidate_correction_policy_change_review_history_c_pkey'
       ) THEN
        ALTER TABLE policy_change_review_history_controls
            RENAME CONSTRAINT policy_candidate_correction_policy_change_review_history_c_pkey
            TO policy_change_review_history_controls_pkey;
    END IF;

    IF to_regclass('public.policy_change_review_history_aggregates') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.policy_change_review_history_aggregates'::regclass
             AND conname = 'policy_candidate_correction_policy_change_review_history_a_pkey'
       ) THEN
        ALTER TABLE policy_change_review_history_aggregates
            RENAME CONSTRAINT policy_candidate_correction_policy_change_review_history_a_pkey
            TO policy_change_review_history_aggregates_pkey;
    END IF;
END $$;
