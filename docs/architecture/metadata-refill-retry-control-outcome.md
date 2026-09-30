# Metadata refill retry control — outcome

Date: 2026-09-30. Implements [the design and research](metadata-refill-retry-control-design.md).

## Result

Refill and queued-task execution now respect the existing retry controller.
Previously analyzed items with OMDb, web-search or legacy Tavily retry records
no longer generate redundant standard metadata tasks. A task already queued
before a wait reads current retry control before optional-provider enrichment.
First-pass local analysis and independent TMDb observation remain available.

| Scenario | Before | After |
| --- | --- | --- |
| OMDb 503 creates a one-hour retry wait | Refill selects the item again | Five repeated selection and refill sweeps add no tasks |
| Old metadata task executes during that wait | Enters optional-provider enrichment | Skips those calls and safely completes independent work |
| Retry becomes due or credentials change | Retry processor can recover | Same recovery remains available; refill does not become a second retry controller |
| Ingestion handoff completes with a deferred retry | Refill can keep adding work | Queue settles; shared AI readiness gate returns ready in the regression fixture |

The reproduction uses actual provider error handling, retry persistence,
credential-generation triggers, task claims and PostgreSQL transactions. HTTP is
injected at the transport boundary: it is deterministic fault testing, not a live
OMDb request or proof of Internet behavior. Retry rows, attempts and wait evidence
remain unchanged by observation and refilling. Both initial regression tests
failed before the implementation and passed afterward.

The AI readiness advisory key is now 2025, distinct from the existing 2023
refill/restore key and 2024 runtime-maintenance key. A static uniqueness test and
two-session PostgreSQL test cover the separation. Existing restore coordination
was not redefined. This removes an unintended coordination collision introduced
with the missing-readiness worker; it does not change restore authorization.

## Validation

- Focused unit validation: seven suites / 167 tests passed.
- Targeted PostgreSQL validation: seven suites / 94 tests passed, including
  metadata retry control, AI backfill, credential-scoped waits, source identity,
  source/write fencing and retry resource fixtures.
- The final refill suite passed 25 tests, including the additional end-to-end
  queue-settlement/AI-readiness assertion. It covers all three optional retry
  types across pending, processing, completed, failed and skipped states; due
  time and credential recovery; movie/TV independent observation; first-pass
  local analysis; an unrelated legacy TMDb retry; and bounded cursor progression.
  An actual analyzed query plan over a 10,000-row unrelated retry backlog also
  checks that the one-item page uses bounded indexed retry lookups rather than
  scanning that backlog. This is plan evidence, not a production latency benchmark.
- Server lint, type checking and both dependency checks passed. Ownership review
  reports no unreviewed drift and preserves existing unresolved writer paths;
  it is not a claim that all historical writers are safe.

Full regression suites passed: 1,556 backend suites / 47,236 tests and 411
frontend files / 5,795 tests. Backend coverage is 90.23% statements/lines,
85.07% branches and 92.03% functions. The coverage ratchet passed without any
baseline changes. ESM import/mock-shape, npm CLI, copyright and Markdown gates
also passed. The PostgreSQL runs above are targeted integration validation,
not a claim that the entire integration suite ran.

No schema migration, API contract or UI change was required. The changelog is
updated under Unreleased. Live containers, routing, settings and library data
were not changed; there is no release, version bump or deployment in this round.
GitHub MCP returned no open Classifarr PRs to select; none was applied or merged.

## Recommendation and next component

Keep the shared retry-control policy. It removes a competing retry path while
preserving the existing due-time, credential, quota and terminal-outcome rules.
The trade-off is deliberate: retained failed/skipped records require the existing
explicit retry/reconciliation path. A snapshot check is not a distributed
provider-call lease, and no-result providers that create no retry remain outside
this specific fix. See the design for alternatives and limits.

Next, close the **no-result, no-retry-record** paths in optional-provider
enrichment. Code inspection identifies OMDb's in-memory daily-limit short circuit,
missing-key return and provider-type-mismatch return as examples that can leave
no durable outcome. This change intentionally covers existing retry records;
it does not claim those other paths are fixed. Reproduce them and implement
bounded durable waiting/terminal outcomes without scheduling disabled providers.

Then replace the isolated resource study's no-op adapter with bounded provider
faults and recovery. Measure unique items, provider attempts, waits and recovery
separately before proposing live CPU/PID caps; the previous repeat-task counts
must not be treated as successful enrichment throughput.
