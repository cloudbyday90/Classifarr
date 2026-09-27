-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0
-- @seed-reconciliation snapshot-required
-- Schema-only snapshots omitted the singleton seeded by the original DDL
-- migration. Never overwrite an existing gate or erase restore evidence.
INSERT INTO policy_native_intent_reconciliation_restore_gates (gate_id, gate_state, reason_id)
SELECT 1, 'ready', 'startup_ready'
WHERE NOT EXISTS (SELECT 1 FROM policy_backup_restore_verifications)
ON CONFLICT (gate_id) DO NOTHING;
