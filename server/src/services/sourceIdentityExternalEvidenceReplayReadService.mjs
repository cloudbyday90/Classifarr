/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { readSourceIdentityExternalEvidenceReplayRows } from './sourceIdentityExternalEvidenceReplay.mjs';

/**
 * Creates the only database read boundary used by automatic source-identity
 * evidence observation. The transaction ends before source-server or TMDb
 * calls begin, avoiding a long-lived database snapshot during network I/O.
 */
export function createSourceIdentityExternalEvidenceReplayReadService({
  withTransaction = db.withTransaction,
  readRows = readSourceIdentityExternalEvidenceReplayRows,
} = {}) {
  if (typeof withTransaction !== 'function' || typeof readRows !== 'function') {
    throw new TypeError('Source identity evidence replay requires a read-only transaction dependency.');
  }

  return Object.freeze({
    async read(limits) {
      return withTransaction(async (client) => {
        if (!client || typeof client.query !== 'function') {
          throw new TypeError('Source identity evidence replay requires a transaction client.');
        }
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        return readRows({ query: client.query.bind(client), limits });
      });
    },
  });
}
