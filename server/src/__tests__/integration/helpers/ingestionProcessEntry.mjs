/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import './ingestionProcessIsolation.mjs';
import * as db from '../../../config/database.mjs';
import { MediaSyncService } from '../../../services/mediaSync.mjs';

try {
  const sync = new MediaSyncService();
  if ((await db.query('SELECT current_database() AS name')).rows[0].name !== process.env.POSTGRES_DB) {
    throw new Error('unexpected_fixture_database');
  }
  let busy = false;
  process.on('message', async message => {
    if (busy) { process.send({ type: 'error', id: message?.id, code: 'COMMAND_BUSY' }); return; }
    busy = true;
    try {
      if (!Number.isSafeInteger(message?.id) || message.id < 1 ||
          !Number.isSafeInteger(message.libraryId) || message.libraryId < 1) {
        throw new Error('invalid_fixture_command');
      }
      const source = (await db.query(`SELECT ms.url,ms.type FROM libraries l
        JOIN media_server ms ON ms.id=l.media_server_id WHERE l.id=$1`, [message.libraryId])).rows[0];
      if (source?.url !== process.env.FIXTURE_JELLYFIN_ORIGIN || source.type !== 'jellyfin') {
        throw new Error('unexpected_fixture_source');
      }
      const result = await sync.syncLibrary(message.libraryId, { batchSize: 1, incremental: true });
      process.send({ type: 'result', id: message.id, result });
    } catch (error) {
      process.send({ type: 'error', id: message?.id, code: /^[A-Z0-9_]{1,32}$/.test(error.code ?? '') ? error.code : 'COMMAND_FAILED' });
    } finally { busy = false; }
  });
  process.on('disconnect', () => process.exit(0));
  process.send({ type: 'ready' });
} catch {
  process.send({ type: 'fatal' }, () => process.exit(1));
}
