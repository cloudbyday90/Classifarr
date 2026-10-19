/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const limit = 268435456;

/** Test-only capability scope. Never imported by application code. */
export async function withSnapshotReuse({ client,context,signal,assertSnapshot,readRetention,readBase,readTail },consume) {
  let open = true, busy = false, inventory, base;
  const close = () => { open = false; inventory = undefined; base = undefined; };
  client.once('end',close); client.once('error',close);
  const check = (session,capability) => {
    assert.ok(open,'snapshot_reuse_closed');
    assert.equal(session,client,'snapshot_reuse_client'); assert.equal(capability,context,'snapshot_reuse_context');
    assertSnapshot(client,context); signal?.throwIfAborted();
  };
  const operation = work => async (session,capability,...args) => {
    check(session,capability); assert.equal(busy,false,'snapshot_reuse_busy'); busy = true;
    try { const result = await work(...args); check(session,capability); return result; }
    finally { busy = false; }
  };
  const reuse = Object.freeze({
    retention:operation(async () => {
      if (!inventory) { const value = await readRetention(client,context.report,signal); check(client,context); inventory = freeze(value); }
      return inventory;
    }),
    catalog:operation(async (budget,version = 1) => {
      assert.ok([1,3].includes(version),'snapshot_reuse_version');
      assert.ok(budget && Number.isSafeInteger(budget.bytes) && budget.bytes >= 0 && budget.bytes <= limit,'snapshot_reuse_budget');
      if (!base) {
        const before = budget.bytes, tables = await readBase(client,signal,budget);
        check(client,context);
        base = freeze({ tables,bytes:budget.bytes-before });
      } else {
        if (budget.bytes + base.bytes > limit) throw Object.assign(new Error('gateway_catalog_size_limit'),{code:'gateway_catalog_size_limit'});
        budget.bytes += base.bytes;
      }
      return freeze({ ...base.tables,...(version === 3 ? await readTail(client,signal,budget,3,3) : {}) });
    }),
  });
  try { check(client,context); return await consume(reuse); }
  finally { close(); client.removeListener('end',close); client.removeListener('error',close); }
}
