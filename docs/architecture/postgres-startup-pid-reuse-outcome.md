# PostgreSQL helper-thread PID reuse outcome

Date: 2026-10-04. Branch: `main`. No release or Unraid deployment.

## Reproduction

Historical source `cbad9423832881db808aaa183e0eda1b34c2b806`, rebuilt locally as
`sha256:5bb4a0e0d473a885669e0d9666da811e83b4df39437584000ce9ee39cc197f6c`,
failed on its first seeded forced restart with a 0.5-CPU quota and 100 ms startup
health checks. The native error was `lock file "postmaster.pid" already exists`:
old PID 157, new PostgreSQL PID 156. A separate diagnostic-only replay mounted a
trace wrapper and confirmed that 157 was a `libuv-worker` in the startup helper's
thread group 143. This is a real local mechanism, not proven attribution of the
earlier CI run, whose native error was not retained.

The same source passed a full eight-phase routing rehearsal and two twelve-cycle
restart runs before the intensified startup health checks exposed the race.
Ordinary PID allocation was stable at 120. These are timing observations, not
proof the failure was repaired. The previous current image
`sha256:0cf38db57f67000849dbe15f208df4b1bf3846ebb1dccdf33e858c31f0f4c70b`
also passed the full routing rehearsal, but **failed** the new deterministic
worker-collision regression at recovery, as expected.

All these containers used synthetic data, no external network or published ports,
bounded CPU/memory/PIDs and randomly named disposable storage. The real routing
tests retained the packaged entrypoint; only the explicitly identified trace
experiment mounted source. The deterministic fixture writes a synthetic lock
identity only inside its fresh disposable cluster; application code never does.

## Change

The startup preflight initializes asynchronous file I/O before launch and verifies
only persistent workers of its own helper before passing a native PostgreSQL PID
exception. Unknown/foreign owners remain blocked. PID-file reads reuse the existing
bounded, no-follow reader. Both identity reads share the startup deadline and
cancellation. A fixed event records verified reuse without publishing native PIDs.
The companion exit-evidence change preserves a sanitized native exit tuple.

Design and tradeoffs are in [PID-reuse design](postgres-startup-pid-reuse-design.md)
and [exit-evidence design](postgres-startup-exit-evidence-design.md).

## Validation

- Focused startup, lifecycle, routing and installation tests: 18 suites, 363 tests
  passed before image validation.
- New deterministic image regression fails on the previous image at the intended
  worker-PID collision. Live competing server and WAL recovery checks passed
  before that expected failure.
- The no-cache image built from `faac53d385a0795e4a0bf73c952e38c61ccd2a4c` is
  `sha256:cf9586432c9c0302a3a3ed2b4466ef94cb49f58c5a9ea0d95bfb402207089f02`.
  This is a local Docker image ID, not verified published registry provenance.
- That exact image passed the deterministic worker-collision regression, live
  competing-postmaster and foreign-process refusal, committed-data/WAL recovery,
  65-second startup, native exit/signal reporting, timeout, cancellation and
  entrypoint signal-forwarding checks. No native lock is deleted by recovery.
- Six seeded forced restarts passed with 0.5 CPU and both health-check intervals
  set to 100 ms, using the packaged entrypoint without source overrides. This
  complements the deterministic regression; timing success alone is not proof.
- The full eight-phase routing upgrade/restart rehearsal passed against local
  baseline `sha256:6c04c447e6a32d53c708e316f5ea0aeecaa0264579cda3e8f5b31bc0d2bfae67`
  (source `eef03e57ffdd26d638f32f1593c424b438041ea2`). History, retry budgets and
  credential pauses survived; two movie reads, two TV reads and zero provider
  writes occurred. Forced exit 137 and graceful exit 0 were checked without OOM.
  Container/volume cleanup passed. Existing fixture deadline adjustments do not
  establish that a real provider cooldown elapsed.
- Lifecycle I/O checks passed: real Linux symlink/FIFO rejection, cancelled and
  stalled reads, no late shutdown command, helper cancellation, clean restart,
  retained sentinel data and `fsync=on`.
- The Windows-skipped directory-fsync case was exercised using the same native
  assertions against packaged code in a network-isolated Linux container:
  complete exclusive copy, matching source/target digests, unchanged source,
  `EEXIST` on a second copy, and unchanged digests after refusal. This is a Linux
  behavioral check, not a claim that the Windows Jest skip disappeared.
- After rebuilding, `dumpSchema` ran against a fresh isolated PostgreSQL 18
  instance from the candidate, seeded from the committed schema. The dump loaded
  into a second fresh database and produced an identical second dump.
  `database/schema/current.sql` has no Git diff. Neither application database
  supplied the snapshot; the disposable schema container was removed.

The broader script/bootstrap run passed 160 suites and 2245 tests; one existing
Linux directory-fsync test is skipped on Windows. Backend lint and the configured
typecheck pass. The startup dependency tree is now included in that typecheck;
an exploratory check found missing annotations in older helpers, which are fixed
without changing their control flow. `embeddedChildProcess` retains the exact
same stdio slots, now constructed with a typed array. Reviewed ownership digests
were updated only for that equivalent construction and JSDoc-only changes to
`embeddedDatabaseControl`; both analysis digests and review categories remain
unchanged. This is not certification of unresolved production writer paths.

## Local deployment evaluation

Only local Compose service `classifarr` was recreated with `--no-deps --no-build
--force-recreate --wait`. Container `98103562799c` started at
`2026-10-04T18:31:16.766824353Z` on the candidate image above. It became healthy,
returned HTTP 200, and confirmed Node 24.21.0, PostgreSQL 18.6, pgvector 0.8.7 and
`fsync=on`. Existing app-data/media binds, UID/GID 1000, read-only root and 2 GiB
memory limit remain unchanged. The existing template sets neither a CPU quota
nor a PID limit; this change adds no persistent service or unbounded worker pool.

Startup completed eight imports and recorded two `legacy_owner_unknown` warnings,
with zero ERROR rows for this container hostname. The two Family and six Movies
legacy running markers still have no matching ingestion owner or recovery
progress. No recovery attestation was submitted or inventory removed. Sharing
Plex with the separate Unraid database does not explain or resolve those records.

Spot samples ranged from 363.6 to 407.5 MiB, 37–45 PIDs, and 0.63–46.93% CPU
during startup work; no OOM or container restart occurred. The process inventory
contained the expected init, supervisor/application and PostgreSQL processes.
This short evaluation does not prove sustained headroom or absence of leaks.
The other local apps and all pre-existing stopped containers were left alone.
Disposable startup, routing, schema and Linux-fsync containers were removed;
the routing harness also verified removal of its labelled volumes.

The recovery-change skill kept the real fault injection isolated and unknown
legacy ownership protected. The release-evidence skill kept historical source,
local image validation and remote CI claims separate. Final documentation lint
checked 1866 files with no errors. No UI or accessibility contract changed.

## Limits and next recommendation

No open Classifarr PRs were returned by GitHub MCP or the saved GitHub CLI login,
so no PR was selected, applied or merged. No version/tag/release change.

This fixes only proved reuse by this helper's persistent I/O workers. Arbitrary
process collisions and unknown media-import ownership are not automatically
overridden. The local legacy import markers remain under the existing reviewed
recovery procedure; local Docker and Unraid use separate databases despite sharing
Plex. Production Unraid was not inspected or changed.

Next: verify the pushed source's remote CI, then complete the separate
legacy-import recovery review and the database-enforced writer boundary needed
for safe automatic takeover. The previous source's successful CI is not evidence
for this patch.
Do not broaden PID exemptions or fabricate media-import ownership to silence logs.
