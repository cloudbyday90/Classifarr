/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { collectOwnershipInventory, INGESTION_RELATIONS } from '../scripts/inventoryWriterCompatibility/ownershipInventory.mjs';
import { evaluateOwnershipGate } from '../scripts/inventoryWriterCompatibility/ownershipGate.mjs';
import { runInventoryWriterCompatibility } from '../scripts/runInventoryWriterCompatibility.mjs';

const schema = { path: 'database/schema/current.sql', source: `
ALTER TABLE public.library_ingestion_state ADD CONSTRAINT parent FOREIGN KEY(library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;
CREATE TRIGGER checkpoint_changed AFTER UPDATE ON public.library_ingestion_state FOR EACH ROW EXECUTE FUNCTION public.changed();` };
const writer = { path: 'server/src/services/writer.mjs', source: `await own(() => db.query('UPDATE library_ingestion_state SET phase=$1', ['complete']));` };
const guard = { path: 'server/src/services/guard.mjs', source: 'export const allowed = true;\n' };
const inventory = (files = [schema, writer], gaps = [], guards = []) => collectOwnershipInventory(files, gaps, guards);
function manifest(report = inventory(), classification = 'unresolved') {
    return { contract: 'inventory.ownership-review.v1', baselineRevision: 'a'.repeat(40), parser: report.parser,
        protectedRelations: INGESTION_RELATIONS, reviews: [{ id: 'review', classification,
            reason: 'Synthetic review of this exact fixture source.', followUp: 'Retain explicit boundaries and test owner loss.' }],
        entries: report.entries.map(entry => ({ path: entry.path, digest: entry.digest, analysisDigest: entry.analysisDigest, review: 'review' })) };
}
const failures = result => result.failures.map(item => item.reason);

test('all four relations, capture triggers and checkpoint cascade parents share existing discovery', () => {
    const report = inventory([schema, { ...writer, source: INGESTION_RELATIONS.map(name => `db.query('DELETE FROM ${name}');`).join('\n') + "db.query('DELETE FROM libraries');" }]);
    expect(report.candidates.map(item => item.target)).toEqual([...INGESTION_RELATIONS, 'libraries']);
    expect(report.candidates.at(-1).kind).toBe('cascade_parent');
    expect(report.triggers).toMatchObject([{ name: 'checkpoint_changed' }]);
});

test.each(['owned', 'separately_coordinated', 'unresolved'])('unchanged %s review is only drift evidence', classification => {
    const report = inventory();
    const result = evaluateOwnershipGate(report, manifest(report, classification));
    expect(result).toMatchObject({ passed: true, productionCompatible: false, databaseConnections: 0, providerRequests: 0, writes: 0 });
    expect(result.reviewedCounts[classification]).toBe(2);
    expect(result.unresolvedExamples).toEqual(classification === 'unresolved' ? [writer.path] : []);
});

test('new writer fails and guard removal with identical SQL invalidates whole-file review', () => {
    const review = manifest();
    expect(failures(evaluateOwnershipGate(inventory([schema, writer, { ...writer, path: 'server/src/new.mjs' }]), review))).toContain('unreviewed_source');
    const unguarded = { ...writer, source: "db.query('UPDATE library_ingestion_state SET phase=$1', ['complete']);" };
    expect(failures(evaluateOwnershipGate(inventory([schema, unguarded]), review))).toContain('changed_review_source');
});

test('dependency-only helper changes are watched even without SQL', () => {
    const before = inventory([schema, guard], [], [guard.path]);
    const after = inventory([schema, { ...guard, source: 'export const allowed = false;' }], [], [guard.path]);
    expect(failures(evaluateOwnershipGate(after, manifest(before)))).toContain('changed_review_source');
    expect(failures(evaluateOwnershipGate(inventory([schema], [], [guard.path]), manifest(before)))).toContain('unreadable_review_source');
});

test('removed or renamed candidates cannot silently retain stale review entries', () => {
    expect(failures(evaluateOwnershipGate(inventory([schema]), manifest()))).toContain('stale_review_entry');
    const result = evaluateOwnershipGate(inventory([schema, { ...writer, path: 'server/src/renamed.mjs' }]), manifest());
    expect(failures(result)).toEqual(expect.arrayContaining(['unreviewed_source', 'stale_review_entry']));
});

test('new SQL DDL is reviewed even when no protected DML can be extracted', () => {
    const report = inventory([schema, writer, { path: 'database/migrations/20260927_190000_unsafe.sql', source: 'CREATE FUNCTION unsafe() RETURNS void LANGUAGE sql AS $$ SELECT external_writer() $$;' }]);
    expect(failures(evaluateOwnershipGate(report, manifest()))).toContain('unreviewed_source');
});

test('TRUNCATE CASCADE includes FK ancestors even when ON DELETE is NO ACTION', () => {
    const report = inventory([
        { ...schema, source: schema.source.replace('ON DELETE CASCADE', '') },
        { ...writer, source: "db.query('TRUNCATE libraries CASCADE');" },
    ]);
    expect(report.cascadeParents.delete).not.toContain('libraries');
    expect(report.cascadeParents.truncate).toContain('libraries');
    expect(report.candidates).toMatchObject([{ operation: 'TRUNCATE', target: 'libraries', kind: 'cascade_parent' }]);
});

test.each(['indirect_query_argument', 'dynamic_sql_execution', 'unsupported_source_language'])('existing %s gap remains explicit and changed analysis fails', reason => {
    const report = inventory([schema, writer], [{ path: writer.path, reason }]);
    expect(evaluateOwnershipGate(report, manifest(report))).toMatchObject({ passed: true, gapCount: 1 });
    expect(failures(evaluateOwnershipGate(report, manifest()))).toContain('changed_review_analysis');
});

test.each(['source_parse_error', 'missing_worktree_source', 'nonlocal_or_nonregular_source', 'source_size_limit', 'unknown_gap'])('%s is never waived by an unchanged digest', reason => {
    const report = inventory([schema, writer], [{ path: writer.path, reason }]);
    expect(evaluateOwnershipGate(report, manifest(report)).passed).toBe(false);
    expect(failures(evaluateOwnershipGate(report, manifest(report)))).toContain(reason);
});

test('missing schema and broken source fail without loading or executing application code', () => {
    const report = inventory([{ ...writer, source: 'const = ;' }]);
    expect(failures(evaluateOwnershipGate(report, manifest()))).toEqual(expect.arrayContaining(['missing_authoritative_schema', 'source_parse_error']));
    const untrusted = inventory([schema, { ...writer, source: "/* eslint-disable inventory/collect */ throw new Error('do not execute'); db.query('DELETE FROM media_server_items');" }]);
    expect(untrusted.candidates).toMatchObject([{ operation: 'DELETE' }]);
});

test('LF/CRLF and enumeration order have identical source and analysis fingerprints', () => {
    const before = inventory([schema, guard], [], [guard.path]);
    const after = inventory([guard, schema].map(file => ({ ...file, source: file.source.replaceAll('\n', '\r\n') })), [], [guard.path]);
    expect(after.sourceFingerprint).toBe(before.sourceFingerprint);
    expect(after.entries).toEqual(before.entries);
    expect(evaluateOwnershipGate(after, manifest(before)).passed).toBe(true);
});

test.each([
    value => { value.contract = 'wrong'; },
    value => { value.baselineRevision = ''; },
    value => { value.parser = null; },
    value => { value.protectedRelations = ['media_server_items']; },
    value => { value.reviews = []; },
    value => { value.reviews.push(value.reviews[0]); },
    value => { value.reviews[0].classification = 'safe'; },
    value => { value.reviews[0].reason = ''; },
    value => { value.reviews[0].followUp = ''; },
    value => { value.entries = []; },
    value => { value.entries.push(value.entries[0]); },
    value => { value.entries[0].review = 'absent'; },
    value => { value.entries[0].path = 'server/src/../secrets.mjs'; },
    value => { value.entries[0].path = 'C:/secret.mjs'; },
    value => { value.entries[0].digest = 'not-a-hash'; },
    value => { value.entries[0].analysisDigest = 'not-a-hash'; },
])('malformed review contract fails closed (%#)', change => {
    const review = manifest(); change(review);
    expect(failures(evaluateOwnershipGate(inventory(), review))).toEqual(['invalid_review_manifest']);
});

test('parser upgrades require review; source contents never appear in gate output', () => {
    const report = inventory(); const review = manifest(report);
    review.parser = { ...review.parser, version: 'unreviewed' };
    const result = evaluateOwnershipGate(report, review);
    expect(failures(result)).toContain('parser_review_changed');
    expect(JSON.stringify(result)).not.toContain('UPDATE library_ingestion_state');
});

test('unresolved examples are bounded and prototype-like review IDs are data', () => {
    const report = inventory([schema, ...Array.from({ length: 15 }, (_, index) => ({ ...writer, path: `server/src/writer${index}.mjs` }))]);
    const review = manifest(report);
    review.reviews[0].id = 'constructor';
    review.entries.forEach(entry => { entry.review = 'constructor'; });
    const result = evaluateOwnershipGate(report, review);
    expect(result.passed).toBe(true);
    expect(result.reviewCounts.constructor).toBe(16);
    expect(result.reviewedCounts.unresolved).toBe(16);
    expect(result.unresolvedExamples).toHaveLength(10);
});

test('gate is enforced in least-privileged CI and local preflight', () => {
    const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
    expect(ci).toContain('run: npm run inventory:ownership:check');
    expect(ci.indexOf('Check ingestion ownership review drift')).toBeGreaterThan(ci.indexOf('Install server dependencies'));
    const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts['test:ci:preflight']).toContain('inventory:ownership:check');
    expect(pkg.scripts['inventory:ownership:check']).toContain('--check-ownership');
});

test('current repository review passes without database access', () => {
    expect(runInventoryWriterCompatibility(['--check-ownership'])).toMatchObject({ passed: true, productionCompatible: false, writes: 0 });
    expect(() => runInventoryWriterCompatibility(['--check-ownership', '--accept'])).toThrow('accepts no arguments');
}, 60000);
