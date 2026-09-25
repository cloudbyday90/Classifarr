# Cached AI adjudication replay: outcome

Status: Unreleased, September 25, 2026. See the separate
[design and official research](cached-adjudication-replay-design.md) for alternatives,
pros/cons and the recommendation stack.

## Delivered

The existing source-pair job now emits `automatic_source_pair.v3`, adding an
`aiReplay` section to its retrieval and deterministic policy reports. Existing
v1/v2 checkpoints remain readable; the evaluator revision forces a fresh v3 run.
Unchanged evidence reuses the checkpoint. No second scheduler or public API/UI.

At most 25 eligible pairs are selected without correction labels, interleaving
movie and TV cases when both are available. Each admitted arm uses the existing
production adjudication prompt and response reducer. Unsupported modes, missing
metadata/evidence and over-budget prompts are unavailable, not inferred successes.
This does not evaluate initial classification or verification AI modes.

Responses must match the exact prompt, ordered candidate identities, response
contract and fixed generation settings. The batch pins configuration and a model
artifact digest. Automatic replay never contacts that model: it measures captured
behavior, not proof of the current artifact behind a mutable model tag.
Configuration, policy, evidence or cache changes invalidate the aggregate.

## Capture and query

Read the existing private aggregate without generation:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --automatic-source-pair-status
```

Explicitly request at most ten new local generation calls:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --capture-source-pair-ai --max-calls 10
```

Inside the application image, replace `server/src/scripts/` with `/app/src/scripts/`.
Both commands require the installation's private database environment. The capture
command is not read-only: it replaces only its dedicated response-cache batch.
It does not classify, route, change policies or mint routing receipts.

Capture requires configured local Ollama, an installed completion-capable model,
valid cached embedding representation, sufficient evidence and resource admission.
There is no provider fallback, model pull or cloud inference. The mandatory budget
is 1–50 new calls; a batch covers at most 25 case pairs / 50 distinct requests.
Identical requests reuse one response. Repeating a capture reuses matching retained
responses and fills remaining misses within the new budget. `missing` reports the
requests left uncaptured. No per-item approval is introduced.

Preparation uses the same isolated worker with a 120-second deadline. The whole
capture has a 20-minute deadline and shares the existing database-scoped memory
admission with heavy discovery/evaluation jobs. Generation uses 8,192 context
tokens, a 256-output-token cap, temperature zero, seed 42 and thinking disabled.
Model identity is checked by the existing client. A final evidence/model check
precedes atomic publication. Interruption, provider failure or drift preserves the
previous complete batch; a fully completed budgeted subset may still have misses.

## Interpreting results

`report.aiReplay` separates eligible, selected and budget-skipped pairs; each arm
reports cache hits/misses, unavailable preparation, proposals, abstentions and
invalid responses. Only two valid cached outcomes form a completed pair. Correction
grading uses the same conservative temporal screening as deterministic replay.
No current library membership is treated as truth.

`deferralsReduced` means cached abstention → cached proposal between the two
evidence arms. It does not mean an automatic route was permitted. Correct gains,
regressions and wrong proposals must be assessed alongside this number. Missing or
malformed responses are not counted as abstentions or correctness successes.

Latency and token totals are **historical effective arm usage**, including a reused
response wherever that arm consumes it. Do not sum them as unique billable calls.
Automatic replay makes zero provider calls; capture reports actual new calls and
reuse separately. Dollar cost and end-to-end accuracy are not measured.

## Privacy, retention and recovery

One singleton table stores at most a 1 MiB batch, with at most 50 responses of
16 KiB each. It stores request hashes, model provenance and usage, not prompts.
Raw model responses can contain private content and remain local database data;
backups need the same protection as the existing database. Status/logs contain
only fixed aggregate fields, never prompts, responses, model names or source IDs.

The seven-day expiry is checked when reading; the existing automatic job deletes
expired or future-dated batches before checking its evaluation cooldown, including
when evaluation is disabled. Physical cleanup resumes when the app/database is
available. TTL does not erase old external backups. No upgrade wipes existing logs.
Replacing a still-valid batch for the same model/configuration preserves its
original retention deadline, so repeatedly reusing responses cannot extend their
lifetime. New responses added to that batch may therefore expire sooner than seven
days. The stored capture time is this retention anchor, not the most recent refill.
Malformed batches are withheld. No routing setting changes, release or live
container update are part of this work.

The application smoke exposed an ordering-only false drift condition in the first
capture implementation. PostgreSQL may return equal vectors in a different order.
Capture now shares the existing logical snapshot fingerprint instead of hashing
transport serialization; changed vectors still invalidate publication.

## Verification

Local verification:

- Full backend coverage run: 1,434 suites and 42,314 tests passed.
- Full PostgreSQL integration run: 160 suites and 1,864 tests passed, with one
  existing suite/test skipped. Final focused checks passed 124 tests; the final
  PostgreSQL replay/cache checks passed 20 tests, including non-renewing retention.
- Coverage ratchet passed: backend statements/lines 90.36%, branches 84.11%,
  functions 92.29%. The unchanged frontend used its existing coverage report;
  its suite was not rerun.
- Type checks, backend lint, both unused-code checks, ESM checks, documentation,
  copyright and repository consistency gates passed. Lint retains one existing
  non-literal-file-path warning in `captureOperatorCorrectionFrozenPolicy.mjs`.
- The final application image built. A fresh, network-disabled container with no
  mounts booted healthy from the updated schema snapshot; schema comparison passed.
  Migration idempotency, size bounds, expiry, malformed/future data and rollback
  were verified against PostgreSQL.
- A separate disposable app used 400 synthetic movie/TV items and a loopback fake
  provider. Missing policy evidence generated zero calls. After supplying synthetic
  metadata, an explicit ten-call capture stored ten responses; subsequent one-call
  refills reused retained responses and respected the new-call budget. No real
  provider, user library data or live-container settings were used.

- The normal scheduler completed its replay at `2026-09-25T11:12:00.020Z`:
  300 eligible pairs, 25 selected, six completed cached pairs and 19 cache misses
  per arm. The fake provider's call counter remained unchanged through this run.
  Restarting only the disposable app preserved the complete report and evaluation
  timestamp; its health endpoint confirmed database connectivity afterward.

No real model-quality improvement is claimed from synthetic fixtures. The connected
GitHub search returned no open Classifarr PRs; no replacement PR was invented or
merged.

## Next component

Add an opt-in, durable recurring inference budget for cache filling: daily call/token
ceilings, one in-flight capture, cooldowns, cancellation and resumable work keyed to
the frozen request/model. Track coverage and rotate label-independent strata across
the retained 300-case cohort instead of repeatedly evaluating only the first 25.
Keep it separate from route authorization and default it
to zero new calls. Then evaluate real correction outcomes and stratified coverage
before changing thresholds. This removes repeated capture commands without turning
cache misses into unbounded model load or adding per-item user approval.
