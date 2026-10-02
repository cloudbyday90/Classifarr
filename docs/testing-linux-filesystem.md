# Linux Filesystem Test

## What The Windows Skip Means

`server/src/__tests__/embeddedMigrationTree.test.mjs` has one Linux-only case:
the complete, exclusive migration-tree copy. The production operation copies
an offline database tree and calls `fsync` on its files and directories before
completion. Windows is not the runtime for that operation.

The other four cases run on Windows. The copy case runs in the normal Ubuntu
CI backend suite; its conditional selects `test`, not `test.skip`, on Linux.
A Windows skip is **not** a passing test or evidence for Linux filesystem behavior.

## Why Keep It

The case verifies:

- The copied tree's names and complete contents match the original digest.
- The complete source tree remains unchanged.
- An existing destination is rejected with `EEXIST` rather than overwritten.
- Both source and destination remain unchanged after the refused second copy.

Run it against real Linux filesystem operations. Removing directory `fsync`,
mocking it away, or deleting the test would weaken the check. Splitting it into
a separate suite is optional organization work, not a substitute for running it.

## Run On Linux Or WSL

Use the repository's pinned Node/npm versions and Linux-installed dependencies:

```bash
cd server
npm ci --include=dev
node scripts/run-jest.mjs --runTestsByPath src/__tests__/embeddedMigrationTree.test.mjs --runInBand --no-coverage --verbose
```

Do not reuse Windows `node_modules` inside Linux. A disposable container can
also use the locked server dependencies with `npm ci --include=dev`; production
images omit Jest and tests on purpose. Use synthetic fixtures on the container's
Linux filesystem, not a mount of an actual database or library.

## Review Outcome And Limits

Reviewed on 2026-10-02 during the [npm update](architecture/npm-12-2-outcome.md).
The assertion was strengthened from checking only `PG_VERSION` to comparing
the complete source tree, and from any rejection to the precise existing-target
error. The OS guard remains because the operation is Linux-specific.

Executed in a disposable Linux container from the npm 12.2 candidate, with
locked development dependencies, a read-only mount of the current test and no
network or live data mounts: **5 tests passed, zero skipped**, including the
strengthened copy case. The corresponding Windows rerun passed its four
portable cases and skipped the Linux case as designed.

This checks copy completeness and successful Linux sync calls, not proof of
power-loss durability, a concurrent-writer guarantee, or permission to migrate
a live database. Existing cold-cluster admission and recovery drills still apply.
