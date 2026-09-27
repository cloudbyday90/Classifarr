/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INGESTION_RELATIONS } from './ownershipInventory.mjs';

const classifications = new Set(['owned', 'separately_coordinated', 'unresolved']);
const reviewableGaps = new Set(['indirect_query_argument', 'dynamic_sql_execution', 'unsupported_source_language']);
const safePath = path => typeof path === 'string' && path.length <= 2048 &&
    ['server/src/', 'scripts/', 'execution/', 'database/migrations/', 'database/schema/'].some(root => path.startsWith(root)) &&
    /\.(?:mjs|js|cjs|sql|py)$/.test(path) && path.split('/').every(part => /^[\w.-]+$/.test(part) && part !== '.' && part !== '..');
const text = value => typeof value === 'string' && value.trim().length >= 20 && value.length <= 2000;

function validManifest(manifest) {
    if (manifest?.contract !== 'inventory.ownership-review.v1' ||
        JSON.stringify(manifest.protectedRelations) !== JSON.stringify(INGESTION_RELATIONS) ||
        !/^[a-f0-9]{40}$/.test(manifest.baselineRevision) || !manifest.parser ||
        !Array.isArray(manifest.reviews) || !manifest.reviews.length || manifest.reviews.length > 100 ||
        !Array.isArray(manifest.entries) || !manifest.entries.length || manifest.entries.length > 20000) return false;
    const reviews = new Map();
    for (const review of manifest.reviews) {
        if (!review || typeof review.id !== 'string' || !/^[a-z][a-z_-]{0,79}$/.test(review.id) || reviews.has(review.id) ||
            !classifications.has(review.classification) || !text(review.reason) || !text(review.followUp)) return false;
        reviews.set(review.id, review);
    }
    const paths = new Set();
    for (const entry of manifest.entries) {
        if (!entry || !safePath(entry.path) || paths.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.digest) ||
            !/^[a-f0-9]{64}$/.test(entry.analysisDigest) || !reviews.has(entry.review)) return false;
        paths.add(entry.path);
    }
    return true;
}

/** A passing result means reviewed drift only, never proof of runtime ownership. */
export function evaluateOwnershipGate(inventory, manifest) {
    const failures = [];
    const result = { contract: 'inventory.ownership-gate.v1', passed: false,
        productionCompatible: false, meaning: 'No unreviewed static inventory drift; unresolved paths are not authorized',
        sourceFingerprint: inventory.sourceFingerprint, protectedRelations: INGESTION_RELATIONS,
        scannedFiles: inventory.scannedFiles, candidateCount: inventory.candidates.length,
        gapCount: inventory.gaps.length, reviewedCounts: { owned: 0, separately_coordinated: 0, unresolved: 0 },
        unresolvedExamples: [], reviewCounts: Object.create(null), failures, databaseConnections: 0, providerRequests: 0, writes: 0 };
    if (!validManifest(manifest)) {
        failures.push({ reason: 'invalid_review_manifest' });
        return result;
    }
    const reviews = new Map(manifest.reviews.map(review => [review.id, review]));
    if (manifest.parser.name !== inventory.parser.name || manifest.parser.version !== inventory.parser.version) {
        failures.push({ reason: 'parser_review_changed' });
    }
    const expected = new Map(manifest.entries.map(entry => [entry.path, entry]));
    const current = new Map(inventory.entries.map(entry => [entry.path, entry]));
    for (const gap of inventory.gaps) if (!reviewableGaps.has(gap.reason)) {
        failures.push({ path: gap.path, reason: gap.reason });
    }
    for (const entry of inventory.entries) {
        const reviewed = expected.get(entry.path);
        if (!entry.digest) failures.push({ path: entry.path, reason: 'unreadable_review_source' });
        else if (!reviewed) failures.push({ path: entry.path, reason: 'unreviewed_source', digest: entry.digest });
        else if (entry.digest !== reviewed.digest) failures.push({ path: entry.path, reason: 'changed_review_source', digest: entry.digest });
        else if (entry.analysisDigest !== reviewed.analysisDigest) failures.push({ path: entry.path, reason: 'changed_review_analysis', analysisDigest: entry.analysisDigest });
        else {
            const review = reviews.get(reviewed.review);
            result.reviewedCounts[review.classification]++;
            result.reviewCounts[review.id] = (result.reviewCounts[review.id] ?? 0) + 1;
            if (review.classification === 'unresolved' && !entry.path.endsWith('.sql') && result.unresolvedExamples.length < 10) {
                result.unresolvedExamples.push(entry.path);
            }
        }
    }
    for (const entry of manifest.entries) if (!current.has(entry.path)) failures.push({ path: entry.path, reason: 'stale_review_entry' });
    result.passed = failures.length === 0;
    return result;
}
