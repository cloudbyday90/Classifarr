/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const databaseConnectionErrorCode = error => typeof error?.code === 'string' &&
  /^(?:[0-9A-Z]{5}|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE)$/.test(error.code) ? error.code : 'connection_lost';

/**
 * Own a checked-out client's error events until its callback settles and the pool takes over.
 * @param {*} client
 * @param {{ operation?: string, logger?: { warn: (...args: any[]) => void } }} options
 */
export function createDatabaseClientLease(client, { operation, logger } = {}) {
  const controller = new AbortController();
  let failure = null, released = false;
  const onError = error => {
    if (failure) return;
    failure = error instanceof Error ? error : new Error('database_connection_lost');
    controller.abort(failure);
  };
  // Real pg clients are EventEmitters; small injected adapters may expose only query/release.
  client.on?.('error', onError);
  return {
    signal: controller.signal,
    get failed() { return failure !== null; },
    assertHealthy() { if (failure) throw failure; },
    release(discard = false) {
      if (released) return;
      released = true;
      try {
        if (failure || discard) client.release(true);
        else client.release();
      } finally {
        client.removeListener?.('error', onError);
        if (failure) logger?.warn('Database operation lost its checked-out connection',
          { operation, code: databaseConnectionErrorCode(failure) }, { skipDbPersist: true });
      }
    },
  };
}
