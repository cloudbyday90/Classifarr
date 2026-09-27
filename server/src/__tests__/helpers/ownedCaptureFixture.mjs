/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMediaSyncOwnership } from '../../services/mediaSyncOwnership.mjs';

/** Use the real lock/lease path on a test client, preserving its outer rollback fixture. */
export async function finishTransactionalCaptureFixture(client, store, context, options) {
  const commands = new Map([
    ['BEGIN', 'SAVEPOINT fixture_owned_capture'],
    ['COMMIT', 'RELEASE SAVEPOINT fixture_owned_capture'],
    ['ROLLBACK', 'ROLLBACK TO SAVEPOINT fixture_owned_capture'],
  ]);
  const adapter = {
    query: (sql, ...args) => client.query(commands.get(sql) ?? sql, ...args),
    on: (...args) => client.on(...args),
    removeListener: (...args) => client.removeListener(...args),
    release() { /* The fixture owns the checked-out client until afterEach. */ },
  };
  return createMediaSyncOwnership({ pool: { connect: async () => adapter } })(context.libraryId,
    () => store.finish(context, options));
}
