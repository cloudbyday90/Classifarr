# Provider-response diagnosis and backfill outcome

Date: 2026-09-13. Scope: local inventory-description refresh, not live routing.

## Implemented

The previous worker hid the distinction between transport failures, malformed
provider data and unrelated refresh failures. It also reset failure backoff after
a busy/yielded pass. The implementation now preserves unresolved failure state
until the current eligible description backlog is cached.

The authoritative embedding validator retains its existing `INVALID_EMBEDDING`
contract and adds fixed shape, dimension, numeric, float32, zero-vector and batch
reason codes. A separate ESM diagnostic adapter identifies local HTTP/access,
stream, byte-limit, UTF-8, JSON, model and batch failures. Provider error bodies
are discarded; arbitrary error messages, nested causes and credentials are not
copied into diagnostics. Sparse batches cannot bypass validation through array
iteration gaps.

A small recovery service owns bounded exponential retry delays, jitter and
deduplicated logging. Persistent access/request/model-inspection failures receive
hourly rechecks. Ordinary delays start at 60–75 seconds and cap at one hour;
scheduler timing and foreground work can delay the actual attempt further.
There are no immediate adapter retries. Each admitted worker pass retains the
existing two-minute deadline, eight-vector batches and 64-description budget.

## What the operator sees

Module `InventoryDescriptionRecovery` records:

- Warning: **Description provider data unavailable; automatic backfill scheduled**.
  `code` identifies the failed check; `phase` identifies inspection, embedding or
  general refresh. `problem`, `steps`, `recovery`, `occurrences` and
  `retryAfterSeconds` explain the automatic response and any follow-up needed.
- Info: **Description backfill caught up**. The original code and number of
  descriptions committed during recovery are included. If nothing new was
  committed, the message explicitly says that no new provider response was
  validated; another writer or changed inventory may have removed the backlog.

Typical steps:

1. For `transport`, `timeout` or `http_busy`, let automatic recovery run after a
   temporary outage. If it persists, check provider availability from Classifarr.
2. For `http_auth`, `http_missing` or `http_rejected`, check endpoint/access rules,
   the selected installed model and provider request/context-length logs.
3. For `model`, `representation`, `dimensions` or numeric-vector failures, verify
   the selected local model supports embeddings and inspect provider logs at the
   warning time. Do not manually edit, pad or truncate vectors.
4. For `unknown`, inspect Classifarr database/refresh logs. This code does not blame
   the provider or assert that its response was malformed.

Unchanged codes produce at most one warning per 30 minutes per process, with
bounded occurrence counts. The scheduler still records failed task execution;
this is not suppression of operational health history. Recovery does not delete
historical warnings. No additional acknowledgements, screen panels or controls
were added; existing SWR UI behavior is unchanged.

## Self-healing and persistence boundary

The existing PostgreSQL cache is the durable checkpoint, keyed by description and
model representation. Failed batches are not written. Scheduled passes reread
current eligible inventory, inspect the local model and skip completed entries.
New batches commit only after vector validation, model revalidation and admission
checks. Changed models use their own namespace; no fallback model is substituted.

Missing work is rediscovered after process restart, but retry timing and warning
deduplication are process-local. A restart can produce a new initial warning and
retry schedule. Invalid responses are never reconstructed or silently accepted.
Persistently invalid input can still block the front of the pending batch list;
bounded per-input isolation is the next recovery improvement, not claimed here.

## Local verification

The focused suite passed 25,134 tests across eight suites, including the repository
code-health checks. Real PostgreSQL integration passed four tests, including
partial failure followed by restart-safe backfill through actual pgvector writes.
Repository preflight, type checks, lint, ESM checks and documentation lint passed.

The full frontend regression passed 368 suites / 5,114 tests. Coverage was 85.61%
statements, 77.54% branches, 85.08% functions and 87.66% lines. No frontend code or
API contract was changed.

Full backend regression passed 1,290 suites / 37,396 tests. Coverage was 90.14%
statements/lines, 82.55% branches and 92.22% functions. A final focused rerun also
passed all 25,134 tests after hardening diagnostic error-field access.
The combined coverage ratchet passed without changing its thresholds.

An isolated HTTP mock provider inside local Compose exercised the shipped
transport, validator, batch writer and refresh worker:

- Eight valid descriptions committed before a wrong-dimension response failed.
- A repeat failure produced one deduplicated warning across both failures.
- A busy pass preserved exponential delays of 60 then 120 seconds (jitter fixed
  only in this synthetic test).
- Provider recovery backfilled two descriptions, with eight prior cache hits.
- A recreated worker found all ten checkpoints and generated no new embeddings.
- One completion event reported two validated descriptions committed in recovery.
- No real library writes or paid-provider calls; Compose remained healthy with a
  read-only root filesystem.

This is failure/recovery evidence, not a classification-accuracy benchmark or a
claim that a particular historical provider defect was reproduced.

## Recommendations and remaining scope

Adopt strict diagnosis, single-layer bounded retries, existing durable checkpoints
and model/source checks. Benefits: clearer failures, automatic resumption and fewer
duplicate warnings. Costs: deferred recovery under load and no ability to repair
arbitrary provider output. The alternatives and official sources are documented in
the [design](provider-response-backfill-design.md).

Next: isolate repeatedly failing descriptions so one bad input cannot delay
learning across otherwise healthy movie and TV libraries. Use bounded per-input
retry state and fair scheduling, preserving media-neutral mechanics and validation.
Cloud adapters and live-classification query replay remain separate work.

Follow-up: [description failure isolation](description-isolation-outcome.md) now
adds durable, bounded per-description retries. The preceding results describe this
original change; the follow-up records its separate design, verification and
remaining profile-publication limitation.

GitHub MCP found no open Classifarr PR during selection, so no PR was applied or
merged. All six workflows for predecessor `31aeabca` were successful. No release,
tag, dependency update, schema migration or version bump is part of this change.
