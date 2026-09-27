/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLibraryCatalogContext, lockLibraryCatalogSource } from './libraryCatalogContext.mjs';
import { validateLibraryCatalog } from './mediaServers/shared/libraryCatalog.mjs';

export function computeLibraryDiff(remoteLibraries, existingRows) {
  const catalog = validateLibraryCatalog(remoteLibraries);
  const existingMap = new Map(existingRows.map(library => [library.external_id, library]));
  const toInsert = [], toUpdate = [], retained = [];
  for (const remote of catalog) {
    if (!remote.media_type) continue;
    const existing = existingMap.get(remote.external_id);
    const arrType = remote.media_type === 'movie' ? 'radarr' : 'sonarr';
    if (!existing) {
      toInsert.push({ ...remote, arrType });
    } else {
      // An archive keeps its reviewed metadata as well as its local identity.
      if (existing.archived_at) continue;
      if (existing.name !== remote.name || existing.media_type !== remote.media_type || existing.arr_type !== arrType) {
        toUpdate.push({ id: existing.id, ...remote, arr_type: arrType });
      }
      retained.push({ ...existing, ...remote, arr_type: arrType });
    }
  }
  const observed = new Set(catalog.map(library => library.external_id));
  return { toInsert, toUpdate, retained, unobserved: existingRows.filter(library => !observed.has(library.external_id)) };
}

/** Network outside the transaction; all catalog writes use the rechecked source. */
export async function reconcileMediaServerLibraries({ db, getMediaServerServiceByType }) {
  const { source, catalog } = await readLibraryCatalogContext(db, getMediaServerServiceByType);
  return db.withTransaction(async client => {
    await client.query("SET LOCAL lock_timeout='500ms'");
    await client.query("SET LOCAL statement_timeout='5s'");
    await lockLibraryCatalogSource(client, source);
    const { rows } = await client.query('SELECT * FROM libraries WHERE media_server_id=$1 ORDER BY id', [source.id]);
    const { toInsert, toUpdate, retained, unobserved } = computeLibraryDiff(catalog, rows);
    for (const library of toUpdate) {
      await client.query(`UPDATE libraries SET name=$1,media_type=$2,arr_type=$3,updated_at=NOW()
        WHERE id=$4 AND archived_at IS NULL`, [library.name, library.media_type, library.arr_type, library.id]);
    }
    for (const library of toInsert) {
      const { rows: [inserted] } = await client.query(`INSERT INTO libraries(media_server_id,external_id,name,media_type,arr_type)
        VALUES ($1,$2,$3,$4,$5) RETURNING *`, [source.id, library.external_id, library.name, library.media_type, library.arrType]);
      await client.query(`INSERT INTO library_policies
        (library_id,name,description,enabled,priority,auto_classify_threshold,prompt_threshold)
        VALUES ($1,$2,$3,true,5,85,60) ON CONFLICT(library_id) DO NOTHING`,
      [inserted.id, `${inserted.name} Policy`, `Auto-generated policy for ${inserted.name}`]);
      retained.push(inserted);
    }
    await client.query('UPDATE media_server SET last_sync=NOW() WHERE id=$1', [source.id]);
    return { libraries: retained, preservedLibraries: unobserved.map(library => ({ id: library.id, name: library.name })) };
  });
}

export async function syncMediaServerLibraries({ db, getMediaServerServiceByType, mediaSyncService, logger }) {
  const result = await reconcileMediaServerLibraries({ db, getMediaServerServiceByType });
  for (const library of result.libraries.filter(row => row.is_active === true && !row.archived_at)) {
    Promise.resolve().then(() => mediaSyncService.syncLibrary(library.id, { incremental: false, batchSize: 100 }))
      .then(outcome => logger.info('Library discovery content sync finished', {
        libraryId: library.id, success: outcome.success === true, reason: outcome.reason,
      })).catch(() => logger.error('Library discovery content sync failed', { libraryId: library.id }));
  }
  return result;
}
