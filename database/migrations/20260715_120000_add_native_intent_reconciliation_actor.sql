/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

-- Automated native intent conversion is a distinct auditable server actor.
-- Retain existing event history while allowing the reconciliation service to
-- differentiate its storage-maintenance writes from administrator actions.
ALTER TABLE policy_intent_migration_events
    DROP CONSTRAINT IF EXISTS policy_intent_migration_events_actor_type_chk;

ALTER TABLE policy_intent_migration_events
    ADD CONSTRAINT policy_intent_migration_events_actor_type_chk CHECK (
        actor_type IN (
            'operator',
            'post_upgrade',
            'reconciler',
            'test_fixture',
            'maintainer'
        )
    );
