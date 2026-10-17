# Gateway catalog retention — outcome

Date: 2026-10-17. See the [design](gateway-catalog-retention-design.md).

## Implemented boundary

An optional, separately installed PostgreSQL registry stores catalog recovery-set
identities and immutable file dependencies using native UUIDv7. Registration binds
a real root bundle, a distinct isolated-verifier result and a rederived bounded
inventory. It does not turn that result into an inference receipt or live cleanup
authorization. Root history does not become another root's file dependency.

Three active sets bound replacement: two retained copies plus one replacement.
Both surviving sets must pass file/dependency checks before an older root can be
retired. Fixed-file deletion preserves dependency pins until the final retired
write. Shared dependencies remain pinned by other roots. SQL guards also protect
referenced archive records and immutable index rows. Partial registration rolls
back; uncertain retirement remains pinned. No attempt or cooldown is reset.

The internal capture seam supports separate catalog/inference directories while
counting their managed bytes together. The old coordinator refuses new work when
registered catalog roots require integration it does not yet support. There is
no new timer, HTTP action, configuration switch or automatic schema migration.
The registry itself is local retention bookkeeping, not part of the older v5
snapshot and not an off-host backup.

## Verification checkpoint

470 gateway unit tests passed. The first broad unit invocation omitted the local
OpenSSL path and failed TLS-fixture setup; rerunning with the existing configured
OpenSSL binary passed without changing application behavior. The first SQL pass
passed 293 gateway tests across 16 suites; additional gate tests are being checked.

Native container evidence, final checks and image details will be recorded after
the immutable-source build and isolated rehearsal. This checkpoint does not claim
that those later checks have passed.

## Remaining integration

Independent catalog admission must replace v5's verification-only exporting-job
seam, preserve combined original retry budgets, and integrate the initial/daily/
capacity schedule with both storage directories. No live scheduler is enabled by
this increment. Protection expiry, restored-worker activation and production
deployment remain outside scope. Unraid, Plex and shared Ollama are untouched.

A fresh GitHub MCP enumeration found no open PR to select. No PR is substituted
or merged, and no release/tag is planned.
