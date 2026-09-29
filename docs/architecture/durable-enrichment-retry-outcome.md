# Durable enrichment retry outcome

## Implemented behavior

Enrichment retries now persist a next-attempt timestamp. Atomic claims reject
early work and active dependency cooldowns, including requests made through the
manual processing endpoint. Recreating the service does not erase those waits.
The existing advisory-lock scheduler checks every minute and processes at most
50 items per retry type per dispatch; it does not drain until empty.

Provider readiness is checked after claiming a due item, before making its
network request, and again for the next item. Unconfigured/unavailable routes
wait without consuming item attempts. OMDb quota races wait until the next UTC
day; current web-search quota failures defer to the existing router's readiness
policy. The historical Tavily monthly reset remains a UTC calendar boundary.

Transient provider failures persist a dependency cooldown, stop that batch and
use bounded jittered backoff. A concurrent result cannot shorten an existing
cooldown. Due time, cooldown, retry outcome and derived item state commit or
roll back together inside the existing claim/source write guard. Successful
evidence and fallback handoffs retain the previous transactional guarantees.

Two related bugs were corrected:

- A monthly wait marker survived claiming the row, while last_attempt_at moved
  forward. A later non-quota failure could therefore wait another month. Claiming
  due monthly work now clears the marker; the next failure gets an ordinary delay.
- The routed Tavily quota handler read `lastError.code`, but the router exposes
  `lastError.errorCode`. The handler now recognizes the actual contract.

Queue-owned OMDb lookups perform one transport attempt per lookup rather than
multiplying transport retries by queue retries. An IMDb miss can still use a
title lookup. Other OMDb callers keep their existing behavior.

## Safety and limits

- Migration 301 adds due times, an indexed pending-work lookup and a two-key
  dependency cooldown table. It does not delete data, change attempt budgets,
  invent legacy ownership or reopen terminal records.
- Movie/TV eligibility, enabled libraries, source identity and current claim
  tokens remain mandatory. No music admission or library-specific exception was
  added. Existing reviewed legacy recovery remains necessary for unknown owners.
- Cooldowns govern this retry queue, not every provider caller in the platform.
  Already in-flight calls may finish; stale results cannot acquire new authority.
  This is not an exactly-once HTTP guarantee.
- Availability checks are local configuration/quota/router checks, not proof that
  credentials will be accepted remotely. Authentication and other permanent
  failures retain the bounded existing failure policy; automatic credential
  repair is not claimed.
- Backoff uses equal jitter, initially 30–60 seconds and capped at one hour.
  Adapter-supplied retry delays can extend that to the existing 24-hour limit.
  Readiness waits are rechecked after 60 seconds. Scheduler load can add latency;
  a due time is an earliest attempt, not a promised completion time.
- The queue's existing statistics distinguish pending waits from actionable
  pending work. No API shape, routing policy or new runtime dependency was added.

## Verification

Focused verification passed 55 PostgreSQL tests for scheduling, ownership and
reviewed legacy recovery, including UTC resets and unrelated TMDb counters.
Final full-suite results:

| Gate | Result |
| --- | --- |
| Backend | 1,531 suites; 46,322 tests passed |
| Real PostgreSQL | 196 suites; 2,308 tests passed; one opt-in suite/test skipped |
| Frontend | 405 files; 5,714 tests passed |
| Coverage ratchet | Passed, no baseline lowered |
| Lint, type checks, CI preflight and ownership review | Passed |
| ESM imports/mock shapes and four policy gates | Passed |
| Production frontend build | Passed |
| Migration integrity and isolated authoritative schema comparison | Passed |
| Markdown | 1,646 documents checked; zero issues |

Total: 54,344 passing tests, excluding the 12 installation checks below. Backend
coverage: statements/lines 90.24%, branches 84.92%, functions 92.13%. Frontend:
statements 86.02%, branches 78.55%, functions 85.48%, lines 87.97%. The opt-in
AI-provider fault Compose test was not enabled; this is not a claim that it ran.

Integration testing caught and corrected an explicit SQL parameter typing issue
in the new enqueue expression. Final review also added a regression proving that
web-search cooldowns cannot defer unrelated TMDb counters. The final backend
coverage run used frozen runtime files; focused PostgreSQL tests were rerun on
the final implementation. All provider traffic in these tests is mocked; only
disposable test databases/containers are used. No live deployment or operator
attestation occurred.

### Installation evidence

The clean-source installation drill passed all 12 checks at
`2026-09-29T11:02:03.686Z` for code commit
`b904c20679a96f015073cb6f7e30c98f8047a15f`.

- Published baseline: `v0.48.4-beta`, source
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e` and verified image
  `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Tested candidate image:
  `sha256:02af70e4d5d996e86c55a46914af24d3da8c067a6c5465ed3cfd536e9160a1ea`.
- PostgreSQL 18.6: fresh installation and upgraded data both reached 301
  migrations; the published baseline had 222.
- Passed provenance, fresh operational seeds, startup scheduling, backfill crash
  recovery, published startup/export, persisted-volume migrations, interrupted
  restore, rejection of unverified startup, verified rollback/retry, movie/TV
  recovery-to-learning, normal restart/profiles and upgraded startup scheduling.
- Disposable Compose project
  `classifarr-upgrade-drill-8d19a53be6b55ecdfcad73946d701196`, its volumes/network
  and candidate image were cleaned up. The local schema-test image is retained.
- The live `classifarr` container remained on image
  `sha256:8993f6dfa53f74b4fe05bf8d3e81df568f00612b9b8742f1be40c5cfb170c63d`,
  started `2026-09-29T01:16:51.534281224Z`, healthy with zero restarts and no OOM.

The ignored local receipt is `.tmp/ci/runtime-installation-acceptance.json`.
It binds the clean code revision to the checks above; this documentation-only
follow-up does not change the tested runtime. The drill is not a live deployment,
release, provider credential test or proof of stopped legacy writers.

## Recommendation and next component

The [design](durable-enrichment-retry-design.md) contains official September 2026
research, alternatives, pros/cons and the selected stack: modular Node ESM,
PostgreSQL, the existing scheduler/router, Jest/PostgreSQL/Vitest. Benefits are
durable progress and transactional safety without another operational service;
the costs are indexed polling and scheduler-interval latency.

Two GitHub MCP searches found no open PRs in `cloudbyday90/Classifarr` during
this round. No random open PR could be selected, implemented or merged.

Next: configuration-version-aware provider recovery. Distinguish invalid
credentials from item failures, pause the affected dependency until its
configuration changes or a controlled health check succeeds, then resume due
work without resetting item budgets. Acceptance should demonstrate one bad key
cannot consume an entire library's retry budgets, with a concise reason and
next action in the UI. Reuse existing provider configuration and diagnostics
rather than creating another general-purpose dashboard.
