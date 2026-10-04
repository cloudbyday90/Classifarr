# Discord delivery deferral — outcome

Date: 2026-10-04. Starting revision: `4aee52f3`. Branch: `main`.
Node 24.21.0 / npm 12.2.0. See the
[design, alternatives and verified sources](discord-delivery-deferral-design.md).

## Changes

Initial classification alerts now use a single-attempt POST adapter, preserving
the installed Discord SDK's serialization of buttons, mentions, embeds and receipt
markers. The adapter has no SDK send queue, automatic HTTP retries, redirects or
attachment downloads. It limits outgoing JSON and response bodies to 256 KiB,
aborts a stalled request after 15 seconds, and honors the bot client's shutdown
signal. Surrounding database work has its existing separate statement/lock bounds.

A single PostgreSQL row preserves provider cooldowns across processes and
restarts. Initial-send admission and explicit delivery verification share it.
Concurrent observations keep the longest delay; malformed/missing 429 delays
remain paused instead of guessing. No raw token, payload or provider error body
is added to durable state or logs.

Only a fully received 429 with persisted cooldown, or a pre-send cooldown check,
can mark a receipt `deferred`. Later ordinary callers may re-admit it only with
the same intent/configuration and a remaining three-attempt lifetime budget.
They reuse the original nonce. Lost acknowledgements, timeouts and other uncertain
writes are never made retryable. Positive delivery evidence cannot be downgraded
by a late deferral; stale attempt completions are fenced.

Settings now distinguishes Deferred from Unconfirmed, with short text and
page-scoped counts. Opening/refreshing the panel still makes no provider call or
send. Existing named client API calls, authentication, administrator checks and
explicit verification behavior are unchanged; `deferred` extends the receipt
state returned by the existing review endpoint.

The recovery-change skill shaped the evidence-gated retries, persistent cooldown,
shutdown cancellation and isolated failure tests. The ownership manifest was
updated only for the reviewed migration and generated snapshot. No ingestion
relations or unresolved ownership debt were changed or relabelled as safe.

## Verification

- Real loopback writer: **18 cases**, covering SDK serialization, delay parsing,
  400/401/403/404/500/503, 429 persistence failure, redirects, malformed/oversized
  responses, wrong message scope, caller cancellation and client shutdown.
  Stalled socket closure is observed; there are no live Discord requests.
- Isolated PostgreSQL: **4 suites / 70 tests passed**, including **20 new cases**
  for restart persistence, competing claims, exhausted budgets, configuration and
  classification changes, legacy fingerprints, lost acknowledgements, shared
  read/write cooldown and safe review projection. Fixture-clock changes test
  eligibility, not elapsed deployment/soak behavior.
- PostgreSQL 18.6 / pgvector 0.8.7: upgrade from HEAD, idempotent migration replay,
  fresh snapshot load and zero-drift round trip passed in an owned disposable
  container with no application volumes or network.
- Isolated Linux: **3 suites / 25 tests passed, no skips**, including the native
  HTTP fixtures and Linux directory-fsync case. Locked dependency image:
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`.
- Browser: **20/20 passed** across five repeated runs. Mobile 320px and desktop
  1280px checks cover keyboard access, status text, no overflow, explicit
  verification and no polling/replay. The 320px screenshot was inspected.
- Final focused Windows service/transport/verification/wiring: **63 passed**;
  lifecycle rerun: **13 passed**. Frontend component tests, server/client type checks,
  server/client lint, build, dependency-use checks, migration integrity,
  copyright, npm flags, static imports and ESM mock-shape checks passed.
- Full backend coverage: **1,664 suites / 51,160 tests passed**. One Windows-only
  skip is the separately passing Linux filesystem test, not an untested success.
- Full frontend coverage: **434 files / 6,293 tests passed**. Coverage ratchet
  passed without baseline changes. Backend statements/lines **90.06%**, branches
  **85.52%**, functions **91.51%**; frontend statements **86.67%**, branches
  **79.55%**, functions **86.22%**, lines **88.55%**.
- Staged secret scan passed; no leaks. Markdown: **1,854 files, zero errors**.

The initial PostgreSQL fixture expected string counts, while this repository
intentionally decodes safe bigint values as numbers. Corrected the fixture
assertions and reran all four suites successfully. No production contract was
changed to accommodate the tests.

## Limits and next recommendation

This is not an automatic outbox. A cooldown before first admission creates no
receipt or durable payload, and a deferred receipt has no scheduled replay.
Existing unrelated SDK callers (channel lookup, edits, test/system alerts) are
not covered by the new shared cooldown. The adapter persists observed 429 delays;
proactive sharing of exhausted-bucket headers on successful responses is still
follow-up work. Already admitted parallel requests can
finish before a newly observed limit; this is not a distributed quota reservation.
An invalid provider delay requires reviewed maintenance rather than automatic
unpausing. Crashes before receiving/persisting new limit information cannot retain
information the process never durably recorded.

Recommended stack remains: durable receipt admission → single-attempt bounded
POST → shared provider cooldown → evidence-gated re-admission → passive/manual
confirmation. The benefit is explicit, restart-safe failure behavior; the cost
is a small adapter and conservative waiting across channels.

Next: bring channel/preparation reads and exhausted-bucket observations under
shared bounded provider admission, then add
a small durable outbox dispatcher for proven-unsent work. Define payload
retention, stale configuration/decision cancellation and finite scheduling
budgets first. Never use that dispatcher to replay uncertain or legacy receipts.

GitHub MCP and the saved CLI login both reported **zero open Classifarr PRs**.
No random PR could be selected; none was merged. No release, live recovery,
application database mutation or Docker deployment was performed.
