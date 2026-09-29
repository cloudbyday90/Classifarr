# Shared web-search pacing outcome

## Delivered

Automatic Brave, Tavily and Serper searches and recovery probes now share durable
request pacing alongside credit admission. Credit limits alone did not prevent
several workers from sending requests inside the same provider rate window.

Two small ESM modules separate HTTP timing policy from PostgreSQL persistence.
Admission checks the current configuration, takes the provider transaction lock,
checks pacing, reserves credits and advances the next slot atomically. A denied
slot consumes neither credits nor an item attempt. No lock remains open over HTTP.

Validated response hints extend a generation-scoped wait. Brave's aligned limit,
remaining and reset headers contribute only exhausted, finite windows; an
unexhausted monthly window no longer supplies an inappropriate long probe delay.
Old responses cannot change replacement credentials' pacing or health. A verified
probe transfers its valid wait to the new credential generation. Ordinary settings
saves do not erase a wait, and recreated storage instances read the same DB state.

Retry scheduling now preserves the earliest positive admission wait among
deferred provider alternatives, without imposing a dependency-wide pause on other
providers. Fresh cache hits bypass admission. Settings describe the conservative
policy using existing accessible status semantics. Unreleased notes are updated.

## Safety and limits

- The one-second minimum admission interval is local policy, not an account's
  purchased request rate. Upstream waits are capped at 30 days; a 429 without a
  usable hint waits 60 seconds. Network delay and other applications can still
  cause throttling.
- Timing persistence stores no keys, raw headers or response bodies. Invalid
  hints are bounded at the HTTP boundary. Transactions have bounded waits.
- Database admission failure prevents HTTP. Failed feedback persistence does not
  repeat a paid request or remove the base admission slot, but cannot guarantee
  that an additional upstream wait was saved during an outage.
- Explicit connection tests, external applications and older binaries do not
  participate. Update cooperating instances together.
- The additive migration changes no media ownership, routing authority or
  classification policy. Existing indirect-SQL ownership-analysis debt remains
  explicitly recorded, not silently marked resolved.
- No runtime dependency, background daemon, release, tag, version bump or live
  deployment was added. HTTP tests use fixture credentials and mocks/local HTTP;
  no live or paid provider request was required.

## Verification

| Gate | Result |
| --- | --- |
| Backend with coverage | 1,537 suites; 46,560 tests passed |
| Frontend with coverage | 406 files; 5,719 tests passed |
| PostgreSQL integration | 200 suites; 2,365 tests passed; one opt-in suite/test skipped |
| Coverage ratchet | Passed; no baseline lowered |
| Clean-source installation acceptance | All 12 checks passed |

The full suites passed 54,644 tests, excluding focused reruns and installation
checks. Focused verification passed 266 backend tests and 62 PostgreSQL tests.
The database tests cover competing callers for all three providers, monotonic
waits, recreated storage instances, settings saves, credential replacement, stale
health feedback, shared probe/search admission, legacy Tavily, cache access and
exact item due times without a dependency-wide cooldown. Policy/client tests
cover malformed and oversized hints, aligned exhausted windows, real HTTP probe
fixtures and observer failure without repeated HTTP.

Backend coverage: statements/lines 90.20%, branches 84.94%, functions 92.03%.
Frontend coverage: statements 86.02%, branches 78.58%, functions 85.47%, lines
87.96%. Lint, type checks, CI preflight, ESM checks, migration checks, four policy
gates and the production UI build passed. All 1,654 Markdown documents passed
lint. Test logs and coverage artifacts remain ignored local evidence.

## Installation evidence

The clean-source acceptance receipt completed at `2026-09-29T13:42:24.158Z` for
runtime commit `188d84b0c988f1f59ba18fd8e5ea3b08b3778fa4`. All 12 checks passed.
Subsequent changes only document results and do not alter the tested runtime.

- Published baseline: `v0.48.4-beta`, revision
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`, verified image
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Candidate image:
  `sha256:267faeadc914a675ddf35a8e7ef5b8b547339c1a706279fd4486d2288bc12ec9`.
- PostgreSQL 18.6: fresh and upgraded candidates reached 304 migrations; the
  published baseline had 222. Schema snapshot generation and authoritative
  comparison also passed independently.
- Passed fresh seeds, scheduled progress, backfill crash recovery, baseline
  export, persisted-volume migration, interrupted restore, unsafe-startup
  rejection, verified retry, movie/TV handoff and verified restart.
- Disposable project `classifarr-upgrade-drill-31cca66b7d9436275ef91de84adf0b7f`,
  its volumes, network and candidate image were removed. Only reproducible test
  data was deleted. The separate `classifarr:test` test image was retained.
- Receipt: `.tmp/ci/runtime-installation-acceptance.json` (ignored local evidence).
  The live container remained healthy with zero restarts, started
  `2026-09-29T01:16:51.534281224Z`, on image
  `sha256:8993f6dfa53f74b4fe05bf8d3e81df568f00612b9b8742f1be40c5cfb170c63d`.

## Recommendation and next component

Keep modular Node ESM services, PostgreSQL transaction locks and durable pacing,
the existing scheduler/router, Vue settings and real-database tests. This survives
process restarts without another infrastructure service. The trade-offs are
brief DB contention and intentionally conservative throughput. Per-process
sleeping cannot coordinate replicas; an external limiter adds operational cost
without a demonstrated need. The separate [design and official research](web-search-pacing-design.md)
records alternatives and September 2026 provider, PostgreSQL, HTTP and W3C guidance.

Next: **cache-aware, due-time retry dispatch**. Current dispatch can claim a due
item before learning that its providers are waiting, and the processing loop
stops its batch on the first deferral. This is bounded, but can delay cached work
behind that item and generate avoidable claim/defer writes during long waits.
Extend the existing wake-up mechanism to consider provider availability and item
due times while preserving cache access, fair progress and atomic final admission.
Do not add a second daemon or bypass quota/credential checks. Acceptance should
cover cached work behind a blocked request, mixed-provider backlogs, restart,
credential replacement and absence of busy loops or duplicate credit charges.

GitHub MCP searches found no open Classifarr PRs during this round. No PR could be
randomly selected or implemented, and none was merged.
