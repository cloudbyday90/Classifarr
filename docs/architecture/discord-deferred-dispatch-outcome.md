# Discord deferred delivery dispatcher — outcome

Date: 2026-10-04. Starting revision: `32f915e6`. Branch: `main`.
See the [design, alternatives and official sources](discord-deferred-dispatch-design.md).

## Implemented

Future admitted classification, confidence and pending alerts retain their exact
serialized body for a bounded retry window. A scheduler-owned worker retries only
durably deferred receipts after the shared cooldown clears. It does not replay
uncertain, in-flight, rejected, delivered or legacy unbuffered notifications.

The worker rechecks configuration, bot/channel identity, classification status,
clarification status and the original three-attempt budget. Initial send admission
and payload retention share a transaction; HTTP runs afterward without SQL locks.
Completion requires positive message evidence. A lost admission acknowledgement
can strand a notification but cannot authorize a duplicate send.

Bounds: four serial candidates per minute, 45-second cancellation signal,
15-second individual HTTP/body deadline, 256 KiB response limit, 64 KiB retained
body, 1,000 entries installation-wide, 24-hour eligibility and 100 cleanup rows
per pass. Database settlement has separate five-second statement/two-second lock
limits; 45 seconds is not a promise that all database settlement has finished.
Expired payloads cannot be sent; downtime can delay physical deletion. Backups
retain their own lifecycle. Successful or uncertain/permanently refused sends
remove the buffer while preserving audit receipts.

Capacity contention/fullness or unsupported/oversized retention bodies preserve
the original single-send behavior but do not gain automatic retry. A fixed warning
identifies an unbuffered deferral. Bodies contain notification content and configured
mentions, not credentials, request headers or provider responses. The existing
database and backup access boundary therefore also protects the temporary buffer.

The admin delivery panel now distinguishes a queued retry from an unbuffered or
expired deferral. Its new `retryQueued` Boolean describes saved state, not guaranteed
future delivery: current settings are checked again before sending. Viewing it is
read-only and makes no Discord call. Existing text labels, status announcements,
focus behavior and user-requested refresh remain intact.

The recovery-change skill guided design-first limits, conservative crash behavior,
the race tests and isolated database checks. New services are small ESM factories;
no broker, dependency update or deployment-template change is required.

## Verification

- Isolated PostgreSQL and real loopback HTTP cover competing workers, recreated
  services, cooldown persistence, all terminal/unknown states, configuration and
  decision changes, stop cancellation, lost socket/commit acknowledgement, rollback,
  positive evidence, buffer limits, bounded cleanup and read-only status.
  Final combined run: **five suites / 100 tests passed**, including 27 dispatcher
  integration cases. Restart cases recreate service instances over retained SQL
  state; fixture-clock changes make cooldowns due. They are not elapsed-time or
  crash-killed-container evidence.
- The important competing-worker regression: observing another sender's `sending`
  state must not discard its buffer; that sender may still receive a confirmed 429.
- Upgrade from the starting schema, idempotent migration replay, fresh snapshot
  load and zero-drift round trip passed on isolated PostgreSQL 18. No live database
  supplied the committed schema. The ownership manifest change covers only the
  new retry table and generated snapshot; ingestion schema and authority are
  unchanged. Existing unresolved ownership debt remains unresolved.
- Linux: four suites / 35 tests passed with no skips, including native HTTP and
  the Linux directory-fsync test. The disposable fixture used a read-only source
  mount, no external network and no application data volume. Fixture image:
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`.
- Full backend coverage: **1,668 suites / 51,308 tests passed**, with the separately
  verified Linux-only Windows skip. Final focused review/worker/scheduler/code-health
  rerun: **six suites / 32,269 tests passed**. Lifecycle wiring: **52 passed**.
  Backend coverage: statements/lines **90.05%**, branches **85.52%**, functions
  **91.44%**. No baseline was lowered.
- Server/client lint and type checks, frontend production build, normal/production
  dependency-use gates, migration integrity, copyright, npm flags, static import
  and ESM mock-shape checks passed. Ownership review passed; its
  `productionCompatible: false` remains the pre-existing unresolved-writer status,
  not a new ingestion authorization. Staged secret scanning found no leaks.
- Full frontend coverage: **434 files / 6,294 tests passed**; statements **86.67%**,
  branches **79.55%**, functions **86.22%**, lines **88.55%**. The coverage ratchet
  passed without baseline changes. Markdown: **1,858 files, zero errors**.

## Requested local rebuild and schema dump

After validation, code was committed as
`8dd2d85a13a1e3c6a63c139ee62ca0f006fe3eb4`. Ran Compose build with `--no-cache` and
that exact `VCS_REF`, then recreated only `classifarr` with `--no-build --wait`.
The existing `/app/data` and `/data/media` mounts, ports and limits were preserved;
other applications were not replaced. No image was published or release created.

The resulting local image ID is
`sha256:1698431eae292dce86dd3add8b22edb291928719d02740781b5d3d0fc4b7c807`.
It reports the code commit above, Node 24.21.0, npm 12.2.0, Alpine 3.24.2 and
PostgreSQL 18.6. Container health and HTTP `/health` passed; read-only SQL confirmed
the new migration and retry table. There were no retained alerts or receipts to
replay in this local database; live Discord delivery is not claimed as tested.

**After the rebuild**, the existing `dumpSchema` generator ran twice using
PostgreSQL in a disposable instance of that exact image: starting schema upgrade,
idempotent migration replay, fresh snapshot load and re-dump. Both completed and
the committed snapshot had **zero drift**. The instance used no network, no host
data volumes, read-only root, tmpfs storage, UID 1000, dropped capabilities,
2 CPUs, 1 GiB and 128 PIDs. Ownership-checked cleanup removed only that disposable
database container; no application data was used in the dump.

Before replacement, a spot check showed about 418 MiB/2 GiB and 0.86% CPU. After
replacement, about 340 MiB/2 GiB and 0.92% CPU, 45 PIDs, zero restarts and no OOM
event. Near three minutes, about 398 MiB, 0.54% CPU and 41 PIDs. These are startup
samples, not sustained-load or memory-leak evidence.
The existing Compose file has a memory limit but no CPU quota; this change does
not silently change installation-wide resource policy.

The dispatcher registered successfully and no dispatcher failure was logged.
Read-only post-start inspection found **two existing `legacy_owner_unknown`
warnings and one library source-item skip warning**, all from `mediaSync`; no
ERROR records were present in that observation window. Rebuilding did not repair
those ingestion records. No ownership was fabricated, takeover forced or warning
suppressed. Operational follow-up should review these blocked/skipped imports
before treating the deployment as fully recovered.

## Limits, recommendation and next item

Recommendation stack: **durable receipt → bounded retained body → saved cooldown
→ intent-checked dispatcher → positive completion evidence**.

The benefit is restart-aware recovery from confirmed throttling without duplicate
replay after an ambiguous write. The costs are short-lived private-content storage,
conservative cancellation and scheduling delay. This is not lossless delivery.
Fresh/unconfigured bots make no provider requests, but the scheduler still performs
bounded local retention checks. No-op passes suppress routine start/completion
logs; meaningful work logs only aggregate counts and failures use fixed messages.

Next notification change: capture bounded durable intent **before channel lookup/preparation**. Those
failures and cooldown refusals before receipt creation still have no retry buffer.
Add explicit cancellation/expiry reasons to operator review as part of that step.
Never reconstruct legacy payloads or replay uncertain sends to improve success rates.

GitHub MCP and the saved CLI login returned zero open Classifarr PRs; none could
be randomly selected. No PR merge, release or tag is part of this work.
