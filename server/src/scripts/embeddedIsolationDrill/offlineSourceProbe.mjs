/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { rename, writeFile, unlink } from 'node:fs/promises';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { prepareOfflineMigrationCopy } from '../../bootstrap/offlineMigrationCopy.mjs';
import { inspectMigrationTree, digestMigrationTree } from '../../bootstrap/embeddedMigrationTree.mjs';
import { SOURCE, CANDIDATE, MIGRATION_ROOT } from './identityMigrationDatabase.mjs';

/** Synthetic source/receipts only, after conversion and before candidate selection. */
export async function verifyOfflineSourceFailures() {
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
    const prepare = () => prepareOfflineMigrationCopy({ journal, source: SOURCE, candidate: CANDIDATE });
    const original = await journal.source.read();
    const before = await digestMigrationTree(CANDIDATE, await inspectMigrationTree(CANDIDATE));
    const ready = await prepare();
    await assert.rejects(ready.copy(), /migration_copy_not_admitted/);
    await rename('/identity-migration/source.json', '/identity-migration/source.held');
    try { await assert.rejects(prepare(), /migration_source_provenance_missing/); }
    finally { await rename('/identity-migration/source.held', '/identity-migration/source.json'); }
    await journal.source.write({ ...original, systemId: (BigInt(original.systemId) + 1n).toString() });
    try { await assert.rejects(prepare(), /migration_source_changed/); }
    finally { await journal.source.write(original); }
    await writeFile('/identity-migration/source/unexpected', 'synthetic drift');
    try { await assert.rejects(prepare(), /migration_source_changed/); }
    finally { await unlink('/identity-migration/source/unexpected'); }
    await prepare();
    assert.equal(await digestMigrationTree(CANDIDATE, await inspectMigrationTree(CANDIDATE)), before);
  });
}
