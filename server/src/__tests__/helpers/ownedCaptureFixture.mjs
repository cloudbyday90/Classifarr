/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createMediaSyncOwnership } from '../../services/mediaSyncOwnership.mjs';
import { MediaSourceObservationStore } from '../../services/mediaSourceObservationStore.mjs';

/** Fixture seeding only: each operation acquires the real production lock/lease. */
export function createOwnedCaptureFixture(pool) {
  const own = createMediaSyncOwnership({ pool });
  const store = new MediaSourceObservationStore();
  const run = async (libraryId, fn) => {
    let entered = false;
    const result = await own(libraryId, () => { entered = true; return fn(); });
    if (!entered) throw new Error(`Capture fixture deferred: ${result.reason}`);
    return result;
  };
  return {
    start: (serverId, libraryId, options) => run(libraryId, () => store.start(serverId, libraryId, options)),
    capture: (context, items) => run(context.libraryId, () => store.capture(context, items)),
    finish: (context, options) => run(context.libraryId, () => store.finish(context, options)),
    withCurrentCapture: (context, fn) => run(context.libraryId, () => store.withCurrentCapture(context, fn)),
  };
}

/** Preserve an outer rollback fixture while exercising real owner-scoped transactions. */
export function createTransactionalCaptureFixture(client) {
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
  return createOwnedCaptureFixture({ connect: async () => adapter });
}
