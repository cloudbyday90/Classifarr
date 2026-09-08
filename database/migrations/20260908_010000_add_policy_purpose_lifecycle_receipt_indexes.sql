/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

CREATE INDEX IF NOT EXISTS idx_policy_initial_intent_establishments_lifecycle_receipt
    ON policy_initial_intent_establishments (established_at DESC, id DESC)
    INCLUDE (policy_id, intent_id)
    WHERE state = 'established' AND intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policy_native_intent_change_receipts_lifecycle_receipt
    ON policy_native_intent_change_receipts (created_at DESC, id DESC)
    INCLUDE (policy_id, target_intent_id, target_intent_version)
    WHERE result_status_id = 'applied';
