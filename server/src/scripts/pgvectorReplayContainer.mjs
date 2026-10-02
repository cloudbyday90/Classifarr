/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// eslint-disable-next-line n/no-unpublished-import -- Disposable offline rehearsal only.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { BASELINE_PGVECTOR_VERSION } from './pinnedReleaseSchema.mjs';

/** Supply historical install SQL from its pinned image, not a rewritten snapshot.
 * Upstream ships the current full install script plus forward update scripts;
 * the historical full script is needed only by these empty-database rehearsals.
 */
export async function createPgvectorReplayContainer({ Container = PostgreSqlContainer } = {}) {
    const scriptPath = `/usr/share/postgresql/18/extension/vector--${BASELINE_PGVECTOR_VERSION}.sql`;
    const source = await new Container(`pgvector/pgvector:${BASELINE_PGVECTOR_VERSION}-pg18`).start();
    let content;
    try {
        const result = await source.exec(['cat', scriptPath]);
        if (result.exitCode !== 0 || !result.output.includes('CREATE TYPE vector')) {
            throw new Error('Pinned pgvector installation script is unavailable');
        }
        content = result.output;
    } finally {
        await source.stop();
    }
    return new Container('pgvector/pgvector:0.8.7-pg18')
        .withCopyContentToContainer([{ content, target: scriptPath }]);
}
