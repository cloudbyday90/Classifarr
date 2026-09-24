/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const BASELINE_TAG = 'v0.48.4-beta';
export const BASELINE_COMMIT = 'a0e417fd714919bb4ca30e20f9cd2380136ca74e';
export const BASELINE_SCHEMA_PATH = 'database/schema/current.sql';

/** Read only the immutable, locally checked release snapshot; never a live dump. */
export function assertPinnedReleaseCommit({ git = execFileSync, repoRoot = resolve(import.meta.dirname, '../../..') } = {}) {
    const options = { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 };
    const commit = git('git', ['rev-parse', `refs/tags/${BASELINE_TAG}^{commit}`], options).trim();
    if (commit !== BASELINE_COMMIT) {
        throw new Error('The published baseline tag is missing or differs from the pinned commit');
    }
    return commit;
}

/** Read only the immutable, locally checked release snapshot; never a live dump. */
export function readPinnedReleaseSchema({ git = execFileSync, repoRoot = resolve(import.meta.dirname, '../../..') } = {}) {
    assertPinnedReleaseCommit({ git, repoRoot });
    const options = { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 };
    const schema = git('git', ['show', `${BASELINE_COMMIT}:${BASELINE_SCHEMA_PATH}`], options);
    if (!schema.includes('-- Latest Migration: 20260829_110000_add_ollama_verification_capability_outcome_history.sql') ||
        !schema.includes('CREATE TABLE public.schema_migrations (')) {
        throw new Error('The pinned release snapshot does not contain the expected migration ledger');
    }
    return schema;
}
