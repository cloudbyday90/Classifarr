# Discord shared HTTP admission — outcome

Date: 2026-10-04. Starting revision: `a2999180`. Branch: `main`.
Node 24.21.0 / npm 12.2.0. See the
[design, alternatives and official research](discord-shared-admission-design.md).

## Implemented

Bot channel lookups, edits, test/system alerts, receipt sends and verification
reads now share one on-demand admission gate and the existing PostgreSQL cooldown.
Successful exhausted-limit responses preserve their result and save the next
allowed time. If that save fails, one bounded in-memory observation holds later
bot calls until an on-demand persistence attempt succeeds. Warnings are fixed,
sanitized and deduplicated per unsaved episode.
Exhausted error responses also retain their limits and original refusal status.

The SDK receives the response body and non-scheduling headers unchanged. The gate
consumes bot bucket scheduling headers so the SDK cannot independently create
another bucket sleep. Preemptive SDK global throttling uses a sanitized deferral.
HTTP 429 responses cannot trigger SDK replay. Interaction-token calls stay outside
the bot cooldown and reject their own 429 without automatic replay.

SDK requests have a 15-second cancellation budget covering queue wait and retries,
with a 16-request per-client outstanding cap. The shared bot HTTP gate also caps
active work at 16. Existing body limits remain: 4 MiB for SDK calls and 256 KiB for
receipt sends/verification. No work is scheduled while idle.

New logic is split into ESM admission, SDK budget and runtime-wiring modules.
The recovery-change skill guided the design-first contracts, success-preservation
rule, race tests and isolated database evidence. There is no schema, API, frontend,
Compose, credential or dependency change, and no new dispatcher or background job.

## Verification

- Real SDK/native HTTP: **13 new loopback cases**, alongside the existing
  transport fixtures. Covers cross-client and native/SDK sharing, exhausted
  success, failed persistence, interaction exemption, preemptive limits, queued
  successors, cancellation before/after queue listener attachment, shutdown and
  the outstanding request cap. No live Discord connection or message is used.
- Gate and request-budget units: **19 cases** for admission, capacity, races,
  failure repair, body preservation, fixed diagnostics and cancellation.
- Isolated PostgreSQL: **4 suites / 73 tests passed**, including three new cases
  for independent-gate/restart persistence, competing observations and a real SQL
  rollback after a successful provider response. The delivery receipt remains
  delivered while further calls fail closed. Synthetic responses isolate that
  transaction test; the separate loopback fixtures prove actual HTTP behavior.
- Isolated Linux: **4 suites / 32 tests passed**, including the native HTTP
  wrappers and Linux directory-fsync case; no skips. Read-only source mount,
  synthetic fixtures, no network or application data volumes. Locked image:
  `sha256:48613d647997b9486ba2112c4090256920b3c2369ffdac189e23c70b95441e3c`.
- Final focused Windows service/transport/verification checks: **74 passed**;
  final quota-error/transport rerun: **27 passed**. Settings/wiring: **28 suites /
  303 tests passed**.
- Server/client type checks and lint, frontend production build, normal and
  production dependency-use checks, migration integrity, copyright, npm flags,
  static import and ESM mock-shape gates passed. Ownership review passed with no
  baseline edits; its pre-existing unresolved paths remain unauthorized, not
  relabelled production-compatible. No ingestion relations changed.
- Staged secret scan found no leaks. Markdown: **1,856 files, zero errors**.
- Full backend coverage: **1,666 suites / 51,223 tests passed**. One Windows skip
  is the separately passing Linux filesystem case, not an untested success.
  Final focused validation after the quota-error adjustment and broad run:
  **6 suites / 32,192 tests passed**, including code-health checks.
- Full frontend coverage: **434 files / 6,293 tests passed**. Backend coverage:
  statements/lines **90.06%**, branches **85.52%**, functions **91.49%**.
  Frontend: statements **86.67%**, branches **79.55%**, functions **86.22%**,
  lines **88.55%**. The coverage ratchet passed without baseline changes.

The real SDK test exposed its pre-aborted queue-listener race: cancellation can
precede listener attachment, so the promise may settle only after the preceding
bounded request. The HTTP-boundary signal check prevents that cancelled request
from sending. A separate same-bucket test catches orphan SDK bucket sleep timers;
the adapter prevents duplicate bot scheduling instead of leaving those timers.

The code-health gate also required its intentional-error-handling explanation on
the catch line. Persistence already emits the fixed warning and retains the hold;
the annotation documents why the successful response must not be discarded.

## Limits and next item

This is a conservative installation-wide bot pause, not a distributed per-bucket
quota scheduler. Unrelated bot channels can wait. Already admitted HTTP calls can
finish after a new observation. A crash can lose an observation whose save failed;
successfully persisted holds survive restarts and configuration changes.

The cancellation budget aborts actual HTTP; database settlement has its existing
separate timeouts. Gateway connections, attachment preparation, SDK sweep timers,
short SDK global-backstop timers and non-bot webhook bucket timers are not replaced.
No live deployment or sustained resource-soak claim is made.

Recommended stack: **durable receipt admission → bounded single-attempt sends →
shared cooldown → evidence-gated re-admission → passive/manual confirmation**.
The benefit is consistent, restart-aware behavior with bounded work; the cost is
conservative throughput and a small maintained SDK boundary adapter.

Next: a durable, bounded dispatcher for **proven-unsent** notifications. Define
payload retention, stale configuration/decision cancellation, finite attempts and
scheduling budgets first. Never replay uncertain or legacy unmarked receipts.

GitHub MCP and the saved CLI login both returned **zero open Classifarr PRs**;
there was no eligible random PR to implement. No PR was merged. No release,
application database mutation, live recovery or Docker deployment was performed.
