/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

CREATE INDEX IF NOT EXISTS idx_policy_intent_receipts_policy_lifecycle_source
    ON policy_native_intent_change_receipts (policy_id, created_at DESC, id DESC)
    INCLUDE (target_intent_id, target_intent_version)
    WHERE result_status_id = 'applied';
