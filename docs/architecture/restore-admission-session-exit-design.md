# Restore-admission session-exit evidence

Date: 2026-10-08. Scope: isolated integration tests, not runtime recovery.

## Evidence and contract

[CI run 37763137059](https://github.com/cloudbyday90/Classifarr/actions/runs/37763137059)
failed immediately after two normal admission leases were released. A fresh local
baseline passes all four admission tests, consistent with an intermittent race.
The installed pg-pool implementation removes a client from its pool before its
asynchronous connection shutdown completes. The test currently assumes that a
synchronous `release(true)` also acknowledges PostgreSQL session termination.

Official sources retrieved on 2026-10-08:

- [node-postgres pool API](https://node-postgres.com/apis/pool): release returns
  void; destroying a client instructs the pool to disconnect it.
- [node-postgres client API](https://node-postgres.com/apis/client): connection
  shutdown and the end event are distinct from pool release.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html):
  session locks last until explicit unlock or session termination.

The production busy refusal is safe and must remain immediate. Normal admission
is held until process exit; no new production retry, unlock, timeout, privilege,
ownership, schema or memory behavior is needed for a test synchronization defect.

## Implementation plan

Use a small ESM integration-only fixture that tracks each checked-out session's
PID and exact server-side backend start time. Observe those sessions through
parameterized, read-only `pg_stat_activity` queries in the current disposable
suite database. Do not infer exit from pool counts or a fixed sleep. Poll within
five seconds, with bounded query time and a fixed diagnostic on expiry. Never
terminate a session to manufacture a successful wait.

Record sessions before admission. Explicitly await their exit at each transition
from released normal/restore ownership to a new owner. Cleanup releases only
fixture-owned clients, then observes their exit; an unknown query failure or a
timeout fails the test rather than permitting the next transition.

Add a controlled delayed-release regression using a real PostgreSQL client:
release can return while the backend remains alive, restoration must still be
refused, and the observer must time out. Once the fixture permits actual
disconnect and observes exit, one restoration must succeed. This deliberately
extends the race window without changing production code. Retain multi-owner,
interrupted-gate and connection-loss tests and run the full disposable DB suite.
Apply the same observation boundary to adjacent schema-maintenance tests, which
also immediately request exclusive admission after normal/maintenance release.

## Alternatives and recommendation

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Observe fixture session exit | Tests the real ownership boundary; bounded and read-only | Small test helper and extra catalog reads | Use |
| Fixed sleep or repeated restore attempts | Simple | Flaky timing or repeated write-capable operations masks defects | Reject |
| Change runtime release/admission APIs | Could expose asynchronous completion | Unneeded production change; process-exit handlers cannot await it | Defer unless runtime evidence requires it |

Completion requires the controlled regression, focused tests, full DB integration,
unchanged runtime safeguards, and a clean no-cache local image evaluation. Image
health alone is not proof of this concurrency contract. Audit hidden dependency
updates separately; do not mix untested major upgrades into this reliability fix.

Next: release preparation after exact-commit CI, with any newly discovered
dependency/security blockers handled as separately tested batches.
