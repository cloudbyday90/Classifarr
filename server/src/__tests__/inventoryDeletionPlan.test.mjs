/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildInventoryDeletionPlan } from '../scripts/inventoryDeletionPlan/graph.mjs';
import { proposedDisposition } from '../scripts/inventoryDeletionPlan/policies.mjs';
import { assessDeletionSnapshot } from '../scripts/inventoryDeletionPlan/snapshot.mjs';
import { runInventoryDeletionPlan } from '../scripts/runInventoryDeletionPlan.mjs';
import { runInventoryDependentCleanup } from '../scripts/runInventoryDependentCleanup.mjs';

const edge = (id, parent, child, patch = {}) => ({ id, parent, child, childColumns: ['parent_id'], parentColumns: ['id'],
    onDelete: 'CASCADE', validated: true, enforced: true, childIndex: true, ...patch });
const evidence = edges => ({ source: { kind: 'fixture' }, measuredAt: '2026-08-01', edges,
    tables: [...new Set(edges.flatMap(row => [row.parent, row.child]))].map(name => ({ name, kind: 'r', rls: false })) });

test('follows transitive dependencies and preserves parallel constraints without inventing deletion decisions', () => {
    const input = evidence([edge('1', 'root', 'child'), edge('2', 'child', 'audit', { onDelete: 'SET_NULL' }), edge('3', 'root', 'child', { onDelete: 'NO_ACTION' })]);
    const result = buildInventoryDeletionPlan(input, ['root']);
    expect(result.edges).toHaveLength(3); expect(result.dependencyOrder).toEqual(['audit', 'child', 'root']);
    expect(result.edges.every(row => row.disposition === 'unresolved')).toBe(true); expect(result.productionReady).toBe(false);
});
test('cycles are reported and never produce an executable order', () => {
    const result = buildInventoryDeletionPlan(evidence([edge('1', 'root', 'child'), edge('2', 'child', 'root')]), ['root']);
    expect(result.cycles).toEqual([['root', 'child', 'root']]); expect(result.dependencyOrder).toBeNull(); expect(result.executable).toBe(false);
});
test('fingerprints are independent of input enumeration/capture time and change with index evidence', () => {
    const input = evidence([edge('1', 'root', 'child'), edge('2', 'root', 'other')]);
    const first = buildInventoryDeletionPlan(input, ['root']);
    expect(buildInventoryDeletionPlan({ ...input, edges: [...input.edges].reverse(), tables: [...input.tables].reverse(), measuredAt: '2026-09-01' }, ['root']).fingerprint).toBe(first.fingerprint);
    expect(buildInventoryDeletionPlan({ ...input, edges: input.edges.map(row => ({ ...row, childIndex: false })) }, ['root']).fingerprint).not.toBe(first.fingerprint);
});
test.each(['validated', 'enforced', 'childIndex'])('missing %s evidence remains a blocker', field => {
    const result = buildInventoryDeletionPlan(evidence([edge('1', 'root', 'child', { [field]: false })]), ['root']);
    expect(result.blockers.some(row => row.reason.includes(field === 'childIndex' ? 'index' : 'constraint'))).toBe(true);
});
test('known preservation requires matching table, columns and action', () => {
    const history = edge('1', 'public.libraries', 'public.classification_history', { childColumns: ['library_id'], onDelete: 'SET_NULL' });
    expect(proposedDisposition(history)).toBe('preserve_history_detach');
    expect(proposedDisposition({ ...history, onDelete: 'CASCADE' })).toBe('unresolved');
    expect(proposedDisposition({ ...history, childColumns: ['library_id', 'other'] })).toBe('unresolved');
});
test('depth, missing roots, triggers and row-level security remain explicit gaps', () => {
    const input = evidence(Array.from({ length: 130 }, (_, i) => edge(String(i), `node${i}`, `node${i + 1}`)));
    input.tables[0].rls = true; input.triggers = [{ table: 'node0', name: 'opaque' }]; input.rules = [{ table: 'node0', name: 'rewrite' }];
    const result = buildInventoryDeletionPlan(input, ['node0', 'missing']);
    expect(result.gaps).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'depth_limit' }), { table: 'missing', reason: 'root_not_observed' }]));
    expect(result.dependencyOrder).toBeNull(); expect(result.blockers).toContainEqual({ reason: 'trigger_semantics_require_validation' });
    expect(result.blockers).toContainEqual({ reason: 'rewrite_semantics_require_validation' });
});
test('edge overflow and duplicate identities fail before emitting a partial plan', () => {
    expect(() => buildInventoryDeletionPlan({ edges: Array(10001).fill(edge('1', 'root', 'child')) }, ['root'])).toThrow('budget');
    expect(() => buildInventoryDeletionPlan(evidence([edge('1', 'root', 'child'), edge('1', 'root', 'other')]), ['root'])).toThrow('identity');
});
test('offline snapshot exposes parser limits and the CLI rejects connection arguments', () => {
    const result = assessDeletionSnapshot('ALTER TABLE public.enrichment_retry_queue ADD CONSTRAINT retry_fk FOREIGN KEY(media_item_id) REFERENCES public.media_server_items(id) ON DELETE CASCADE;');
    expect(result.edges[0]).toMatchObject({ childIndex: null, validated: null, disposition: 'unresolved' });
    expect(() => runInventoryDeletionPlan(['--database=production'])).toThrow('no arguments');
    expect(runInventoryDeletionPlan([]).edges.some(row => row.child === 'public.media_identity_review_previews')).toBe(true);
});

test('the dependent benchmark refuses production arguments before Docker startup', async () => {
    await expect(runInventoryDependentCleanup({ argv: ['--database=production'], start: () => { throw new Error('Docker must not start'); } }))
        .rejects.toThrow('no arguments');
});
