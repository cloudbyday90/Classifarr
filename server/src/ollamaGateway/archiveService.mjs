/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withGatewayArchiveSnapshot } from './archiveRepository.mjs';
import { createArchiveDirectory, finishArchive } from './archiveFiles.mjs';
import { dumpGatewayArchive } from './archiveDump.mjs';

export async function createGatewayArchive(client, configuration, parent, signal) {
  let directory;
  const manifest = await withGatewayArchiveSnapshot(client, { ...configuration, signal }, async ({ report, archiveId, snapshot }) => {
    directory = await createArchiveDirectory(parent, archiveId);
    const dump = await dumpGatewayArchive(configuration, snapshot, directory, signal);
    return { version: 1, schemaVersion: 7, archiveId, report, dump };
  });
  signal?.throwIfAborted();
  return finishArchive(directory, manifest);
}
