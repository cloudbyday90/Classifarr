/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';

let db;

async function createReadyLegacyPolicy() {
    const suffix = randomUUID().replaceAll('-', '');
    const library = await db.query(
        `INSERT INTO libraries (external_id, name, media_type)
         VALUES ($1, $2, 'movie')
         RETURNING id`,
        [`native-reconciliation-${suffix}`, `Native Reconciliation ${suffix}`],
    );
    const libraryId = library.rows[0].id;
    const policy = await db.query(
        `INSERT INTO library_policies (library_id, name)
         VALUES ($1, $2)
         RETURNING id`,
        [libraryId, `Family Policy ${suffix}`],
    );
    const preset = await db.query(
        `INSERT INTO content_presets (
           key, name, description, category, signals, is_system, display_order
         )
         VALUES ($1, $2, $3, 'integration_test', $4::jsonb, TRUE, 0)
         RETURNING id`,
        [
            `family-${suffix}`,
            `Family ${suffix}`,
            'Scheduler-owned legacy policy conversion fixture.',
            JSON.stringify({ genres: { require_any: ['Family'] } }),
        ],
    );
    await db.query(
        `INSERT INTO policy_presets (policy_id, preset_id, weight, sort_order)
         VALUES ($1, $2, 1, 0)`,
        [policy.rows[0].id, preset.rows[0].id],
    );

    return {
        libraryId,
        policyId: policy.rows[0].id,
        presetId: preset.rows[0].id,
    };
}

beforeAll(() => {
    db = getPool();
});

describe('Native intent reconciliation scheduler integration', () => {
    it('converts a ready legacy policy through the scheduler without a client apply request', async () => {
        const fixture = await createReadyLegacyPolicy();
        const before = await db.query(
            'SELECT COUNT(*)::int AS count FROM policy_intents WHERE policy_id = $1',
            [fixture.policyId],
        );
        expect(before.rows[0].count).toBe(0);

        const { schedulerService } = await import('../../services/scheduler.mjs');
        const { nativeIntentReconciliationService } =
            await import('../../services/nativeIntentReconciliationService.mjs');
        const { DB_ADVISORY_LOCKS } = await import('../../config/database.mjs');

        const scheduled = await schedulerService.runScheduledTask(
            'native-intent-reconciliation-integration',
            () => nativeIntentReconciliationService.run(),
            DB_ADVISORY_LOCKS.NATIVE_INTENT_RECONCILIATION,
        );

        expect(scheduled).toBe(true);

        const intent = await db.query(
            `SELECT id, policy_id, library_id, active, source, inference_state, validation_status
             FROM policy_intents
             WHERE policy_id = $1`,
            [fixture.policyId],
        );
        expect(intent.rows).toEqual([
            expect.objectContaining({
                policy_id: fixture.policyId,
                library_id: fixture.libraryId,
                active: true,
                source: 'legacy_presets',
                inference_state: 'inferred',
                validation_status: 'valid',
            }),
        ]);
        const intentId = intent.rows[0].id;

        const [rules, templates, snapshots, events, ledger, states] = await Promise.all([
            db.query(
                `SELECT intent_role, collection, signal_type, operator, "values"
                 FROM policy_intent_rules
                 WHERE intent_id = $1`,
                [intentId],
            ),
            db.query(
                `SELECT preset_id, link_state
                 FROM policy_intent_template_applications
                 WHERE intent_id = $1`,
                [intentId],
            ),
            db.query(
                `SELECT policy_id, payload_redacted
                 FROM policy_intent_rollback_snapshots
                 WHERE intent_id = $1`,
                [intentId],
            ),
            db.query(
                `SELECT event_type, actor_type, reason_code, metadata->>'actorSourceId' AS actor_source_id
                 FROM policy_intent_migration_events
                 WHERE policy_id = $1
                 ORDER BY id`,
                [fixture.policyId],
            ),
            db.query(
                `SELECT run.run_state, run.source_status_id, run.converted_count,
                        outcome.policy_id, outcome.outcome_state, outcome.reason_id
                 FROM policy_native_intent_reconciliation_runs run
                 JOIN policy_native_intent_reconciliation_outcomes outcome ON outcome.run_id = run.id
                 WHERE outcome.policy_id = $1
                 ORDER BY run.id DESC
                 LIMIT 1`,
                [fixture.policyId],
            ),
            db.query(
                `SELECT COUNT(*)::int AS count
                 FROM policy_native_intent_reconciliation_states
                 WHERE policy_id = $1`,
                [fixture.policyId],
            ),
        ]);

        expect(rules.rows).toEqual(expect.arrayContaining([
            expect.objectContaining({
                intent_role: 'purpose',
                collection: 'purpose',
                signal_type: 'genres',
                operator: 'require_any',
                values: { require_any: ['Family'] },
            }),
        ]));
        expect(templates.rows).toEqual([
            expect.objectContaining({
                preset_id: fixture.presetId,
                link_state: 'applied',
            }),
        ]);
        expect(snapshots.rows).toEqual([
            expect.objectContaining({
                policy_id: fixture.policyId,
                payload_redacted: false,
            }),
        ]);
        expect(events.rows.map(event => event.event_type)).toEqual([
            'conversion_started',
            'rollback_snapshot_created',
            'conversion_applied',
        ]);
        expect(events.rows).toEqual(expect.arrayContaining([
            expect.objectContaining({
                actor_type: 'reconciler',
                reason_code: 'native_intent_reconciliation',
                actor_source_id: 'native_intent_reconciliation',
            }),
        ]));
        expect(ledger.rows).toEqual([
            expect.objectContaining({
                run_state: 'applied',
                source_status_id: 'applied',
                converted_count: 1,
                policy_id: fixture.policyId,
                outcome_state: 'applied',
                reason_id: 'conversion_applied',
            }),
        ]);
        expect(states.rows[0].count).toBe(0);
    });
});
