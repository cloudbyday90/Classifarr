/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AsyncLocalStorage } from 'node:async_hooks';

/** Stop subsequent wrapper operations after an enclosing session lock is lost. */
export function createDatabaseLockScope() {
  const storage = new AsyncLocalStorage();
  return {
    assertHealthy() {
      for (const scope of storage.getStore() ?? []) {
        scope.lease.assertHealthy();
        if (scope.closed) throw new Error('database_lock_scope_closed');
      }
    },
    async run(lease, callback) {
      const scope = { lease, closed: false };
      try { return await storage.run([...(storage.getStore() ?? []), scope], callback); }
      finally { scope.closed = true; }
    },
  };
}
