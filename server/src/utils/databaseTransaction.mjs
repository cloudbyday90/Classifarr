/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createDatabaseClientLease } from './databaseClientLease.mjs';

/**
 * One checked-out client, one callback attempt, and no uncertain-commit replay.
 * @param {*} client
 * @param {(client: any, options: { signal: AbortSignal }) => any} callback
 * @param {{ logger?: { warn: (...args: any[]) => void, error: (...args: any[]) => void }, assertActive?: () => void, readOnlyRepeatable?: boolean }} options
 */
export async function runDatabaseTransaction(client, callback, { logger, assertActive = () => {},
  readOnlyRepeatable = false } = {}) {
  const lease = createDatabaseClientLease(client, { operation: 'transaction', logger });
  let transactionState = 'begin', discard = false;
  try {
    assertActive();
    lease.assertHealthy();
    await client.query(readOnlyRepeatable ? 'BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY' : 'BEGIN');
    lease.assertHealthy();
    transactionState = 'callback';
    const result = await callback(client, { signal: lease.signal });
    lease.assertHealthy();
    assertActive();
    transactionState = 'commit';
    await client.query('COMMIT');
    lease.assertHealthy();
    return result;
  } catch (error) {
    discard = transactionState !== 'callback' || lease.failed;
    if (!lease.failed) {
      try { await client.query('ROLLBACK'); }
      catch {
        discard = true;
        logger?.error('Failed to rollback transaction', {
          rollbackError: 'database_rollback_failed', originalError: 'database_operation_failed',
        }, { skipDbPersist: true });
      }
    }
    throw error;
  } finally {
    lease.release(discard);
  }
}
