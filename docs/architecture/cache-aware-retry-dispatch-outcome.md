# Cache-aware retry dispatch outcome

## Delivered

Cached enrichment can progress behind provider-blocked work without claiming and
deferring every waiting item. A bounded read-only page and cache-key lookup find
likely-ready work; the existing atomic claim, source fence and provider admission
remain authoritative. Cursor continuation prevents the first waiting page from
hiding later cache hits. One coalesced timer handles continuation and rechecks.

Cache version 2 excludes mutable health/routing telemetry while retaining search
settings and credential generation. Disabled, unconfigured and rejected providers
are not bypassed. Nullable source years now satisfy the optional request contract;
usage storage accepts bounded text retry traces as well as existing UUID history.
New services and tests are ESM, with no new runtime dependency or daemon.

The separate [design and official research](cache-aware-retry-dispatch-design.md)
records September 2026 PostgreSQL, Node, W3C and Docker guidance, alternatives and
the recommendation stack. High-level changes are under Unreleased. There is no
release, version bump, Git tag or image publication.

## Verification

| Check | Result |
| --- | --- |
| Backend with coverage | 1,538 suites; 46,618 tests passed |
| Frontend with coverage | 406 files; 5,719 tests passed |
| PostgreSQL integration | 201 suites; 2,373 tests passed; one opt-in suite/test skipped |
| Clean-source installation acceptance | All 12 checks passed |
| Coverage ratchet | Passed without lowering any baseline |

The full suites passed 54,710 tests, excluding focused reruns and installation
checks. Targeted checks additionally passed 117 unit and 112 PostgreSQL tests.
Real-database tests cover cache hits beyond a waiting page, restart/rescan,
concurrent claims, cache expiry and credential replacement, stable cache identity
after health updates, fresh setup and zero-cost cache usage. Music, disabled
libraries, future due times and rejected credentials remain excluded.

Full validation initially caught an ownership-review snapshot taken before its
pins were refreshed and a missing migration copyright header. Both were corrected.
It also exposed an existing integration-test race: pool connection release starts
socket closure but does not await PostgreSQL advisory-lock release. The test now
observes release with a bounded deadline before asserting recovery. No production
lock was weakened, and both full backend suites subsequently passed.

Lint, both type checks, dependency checks, CI preflight, four policy gates,
migration naming/schema integrity, authoritative schema comparison, ESM checks,
documentation lint and the production client build passed. Backend coverage is
90.20% statements/lines, 84.93% branches and 92.01% functions; frontend coverage is
86.02% statements, 78.58% branches, 85.47% functions and 87.96% lines.

## Installation and local deployment

Runtime commit: `d0954dc080a271170dea1800acf54f11e4842e40`. The clean-source receipt
completed at `2026-09-29T20:17:24.028Z`. PostgreSQL 18.6 fresh and upgraded candidates
reached 305 migrations; the verified `v0.48.4-beta` baseline had 222. Fresh setup,
scheduled progress, backfill crash recovery, persisted-volume upgrade, interrupted
restore protection, verified retry and movie/TV handoff all passed.

Disposable project `classifarr-upgrade-drill-23d6b74211dce7772613ee88e2ffb9a3`, its
volumes, network and candidate image were removed after successful checks. Only
reproducible test data was deleted. The ignored installation receipt and test logs
remain under `.tmp`; no credentials or raw media records are committed.

After testing, the requested `build --no-cache --require-provenance` completed,
followed by `up -d --no-build --force-recreate --wait` for Classifarr only. The image
revision matches the runtime commit. The replacement started at
`2026-09-29T20:23:46.512291351Z` on image
`sha256:9a4f2ebd4dfd586c6b783cee5ddfcbc117102b6cb2c24e61d5b5295db9a94f07`.
The live database advanced from 298 to 305 migrations. Existing mounts, routing,
provider settings, 6,697 inventory items and 10 libraries were preserved. All
eight ingestion records remain complete.

Rollback preparation retains image
`sha256:8993f6dfa53f74b4fe05bf8d3e81df568f00612b9b8742f1be40c5cfb170c63d` as
`classifarr:rollback-before-cache-dispatch-20260929-2017`. A private 80,103,986-byte
database backup is at `data/backups/pre-cache-dispatch-20260929-2017.dump`, mode 600
inside the container. Its archive listing validates; this particular live backup
has not been restored. The image alone is not a database rollback. Other running
applications were untouched.

## Operational observation

Observation window: `2026-09-29T20:23:46Z` through `2026-09-29T20:29:36Z`.

The replacement is healthy with zero restarts and no OOM, memory-limit or PID
denial events. The initial startup sample was 37.17% CPU and 366 MiB. Subsequent
samples were 0.43–3.58% CPU and 299.3–385.4 MiB, with 26–35 PID/thread IDs in
Docker's sampled output. Process inspection showed one application process plus
the supervisor and PostgreSQL processes, not duplicate application workers.
These are short-window samples, not a leak, capacity or sustained-load proof.

The unchanged limit is 2 GiB memory, with 4 GiB total memory-plus-swap allowance.
There is no configured CPU quota or PID ceiling. Existing resource-budget studies
do not authorize changing those live limits; retain measured, opt-in budget
validation rather than applying arbitrary caps to Node and embedded PostgreSQL.

No new ERROR was observed, but scheduled sync subsequently produced two new
`legacy_owner_unknown` warnings. The rebuild did **not** eliminate them. Read-only
inspection explains the exact remaining blockers:

| Library | Unfinished historical sync records | Current ownership record |
| --- | --- | --- |
| 4 | Two running markers, dated July 18 and August 22 | Absent |
| 5 | Six running markers, dated August 19 through September 20 | Absent |

Both libraries have a complete `media_sync` capture, generation 341, dated
September 27. A completed capture does not establish ownership for unrelated old
running records. The claim guard therefore correctly withholds automatic adoption.
Only one local Classifarr container was found; no other active database query was
observed at inspection. Neither fact excludes an external writer reconnecting.
No stopped-writer attestation, forced takeover or record deletion was performed.

Use the existing [recover-and-resume workflow](legacy-ingestion-resume-design.md):
open each library, review the blocked records, confirm older/external writers are
stopped only after establishing that fact, then select **Recover and resume
import**. It preserves inventory and schedules a full owned replay/backfill.
Until that confirmation is available, these two libraries remain blocked.

Historical reports remain preserved; the preceding 24 hours also included four
source-identity warnings. A short clean interval does not prove source metadata
repair. Error-log comparisons account for the database's America/New_York timezone.

All three saved web-search providers are disabled. The 51 pending retries have
zero attempts, identical row fingerprints across observation samples and no new
web-search usage after restart. Configuration is left unchanged; disabled providers
must not be automatically enabled to drain a queue.

## Recommendation and next component

Keep PostgreSQL claims/admission, modular ESM planners, the existing scheduler and
Vue status components. Bounded planning avoids claim/defer writes during waits
and preserves cache progress; its trade-offs are extra reads and restart rescans.
A persistent dispatch index or external broker adds synchronization/operational
cost and is not justified by this small live backlog. Cache-v1 entries expire
naturally, so the upgrade initially has a colder cache. OMDb and dependency-wide
cooldown behavior are unchanged. Ownership-analysis debt remains explicit.

Immediate operational follow-up: resolve the reviewed legacy-import blockers for
libraries 4 and 5 through the existing workflow once stopped writers can be
confirmed. Do not create another recovery mechanism or infer authority from age.

Next code component: **an actionable retry-readiness summary**. Show
cached-ready, provider-waiting, disabled/rejected and future-due counts separately,
with the next check time and one relevant settings action. Use bounded aggregate
reads and existing status/polling infrastructure; do not scan the entire backlog
per browser request, spend provider credits, enable services or imply waiting is
failure. Test fresh setup, intentional disablement, repair and stale observations.
The live disabled-provider backlog makes this a concrete operator need.

GitHub MCP searches found no open Classifarr PRs, including the final recheck.
There was no PR available to randomly select or implement; none was merged.
