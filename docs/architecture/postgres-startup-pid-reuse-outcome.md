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
- Candidate image, no-cache local deployment and schema round-trip results will
  be recorded after testing the committed source.

The broader script/bootstrap run passed 160 suites and 2245 tests; one existing
Linux directory-fsync test is skipped on Windows. Backend lint and the configured
typecheck pass. The startup dependency tree is now included in that typecheck;
an exploratory check found missing annotations in older helpers, which are fixed
without changing their control flow. `embeddedChildProcess` retains the exact
same stdio slots, now constructed with a typed array. Reviewed ownership digests
were updated only for that equivalent construction and JSDoc-only changes to
`embeddedDatabaseControl`; both analysis digests and review categories remain
unchanged. This is not certification of unresolved production writer paths.

## Limits and next recommendation

No open Classifarr PRs were returned by GitHub MCP or the saved GitHub CLI login,
so no PR was selected, applied or merged. No version/tag/release change.

This fixes only proved reuse by this helper's persistent I/O workers. Arbitrary
process collisions and unknown media-import ownership are not automatically
overridden. The local legacy import markers remain under the existing reviewed
recovery procedure; local Docker and Unraid use separate databases despite sharing
Plex. Production Unraid was not inspected or changed.

Next: obtain equivalent restart evidence from the rebuilt image and the exact
source's remote CI, then complete the separate legacy-import recovery review.
Do not broaden PID exemptions or fabricate media-import ownership to silence logs.
